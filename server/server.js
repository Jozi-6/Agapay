import express from 'express';
import cors from 'cors';
import bcrypt from 'bcrypt';
import multer from 'multer';
import XLSX from 'xlsx';
import { randomUUID } from 'crypto';
import db from './database.js';
import { OFFICIAL_BARANGAYS, isValidBarangay, getBarangayValidationError } from './constants.js';


import { generateToken, authMiddleware } from './auth.js';
import { logAudit, getAuditLogs, getAuditActions } from './auditLogger.js';
import { getReportFilters, getReportRecords, generateCsv, generateExcel, generatePdf } from './reportExporter.js';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

const EXCEL_REQUIRED_COLUMNS = ['first_name', 'last_name', 'barangay', 'birthdate', 'lgu_intervention'];
const excelPreviewStore = new Map();
const EXCEL_PREVIEW_TTL_MS = 15 * 60 * 1000;

function monthDateRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return {
    start: start.toISOString(),
    end: end.toISOString()
  };
}

function calculateAgeFromBirthdate(birthdate) {
  const birthDateObj = new Date(birthdate);
  if (Number.isNaN(birthDateObj.getTime())) {
    return null;
  }

  const today = new Date();
  let age = today.getFullYear() - birthDateObj.getFullYear();
  const monthDiff = today.getMonth() - birthDateObj.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDateObj.getDate())) {
    age--;
  }

  return age;
}

function detectQueueIssue(beneficiary) {
  if (!beneficiary.rsbsa_number) {
    return 'Missing RSBSA Number';
  }
  if (!beneficiary.barangay) {
    return 'Awaiting Barangay Confirmation';
  }
  if (!beneficiary.contact_number) {
    return 'Missing Contact Number';
  }
  if (!beneficiary.address) {
    return 'Missing Address';
  }
  if (beneficiary.validation_status === 'Pending') {
    return 'Awaiting Validation';
  }
  return null;
}

function cleanupExpiredExcelPreviews() {
  const now = Date.now();
  for (const [token, payload] of excelPreviewStore.entries()) {
    if (now - payload.createdAt > EXCEL_PREVIEW_TTL_MS) {
      excelPreviewStore.delete(token);
    }
  }
}

// Login endpoint
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({
      success: false,
      message: 'Email and password are required'
    });
  }

  try {
    const normalizedEmail = String(email).trim().toLowerCase();
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(normalizedEmail);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    const passwordMatch = await bcrypt.compare(String(password), user.password);

    if (!passwordMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    const token = generateToken(user);

    logAudit({
      userId: user.id,
      username: user.name,
      userRole: user.role,
      action: 'Logged In',
      module: 'Authentication',
      recordType: 'user',
      recordId: user.id,
      recordAffected: user.email,
      description: 'User logged in to the system'
    });

    return res.json({
      success: true,
      message: 'Login successful',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role
      },
      token
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error. Please try again.'
    });
  }
});

// Verify token endpoint
app.get('/api/verify', authMiddleware, (req, res) => {
  res.json({
    success: true,
    message: 'Token is valid',
    user: req.user
  });
});

// Register endpoint (for development - note: this allows any role, should be restricted in production)
app.post('/api/register', async (req, res) => {
  const { email, password, name, role } = req.body;
  
  if (!email || !password || !name || !role) {
    return res.status(400).json({
      success: false,
      message: 'All fields are required'
    });
  }
  
  const validRoles = ['ADMIN', 'AGRICULTURAL_TECHNOLOGIST', 'DATA_ENCODER'];
  if (!validRoles.includes(role)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid role'
    });
  }
  
  const saltRounds = 10;
  const hashedPassword = bcrypt.hashSync(password, saltRounds);
  
  try {
    const result = db.prepare(`
      INSERT INTO users (email, password, name, role) 
      VALUES (?, ?, ?, ?)
    `).run(email, hashedPassword, name, role);
    
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid);
    const token = generateToken(user);

    logAudit({
      userId: user.id,
      username: user.name,
      userRole: user.role,
      action: 'Added User',
      module: 'User Management',
      recordType: 'user',
      recordId: user.id,
      recordAffected: user.email,
      description: `Added new ${role.replace('_', ' ')} account`
    });
    
    res.json({
      success: true,
      message: 'Registration successful',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role
      },
      token
    });
  } catch (error) {
    if (error.code === 'SQLITE_CONSTRAINT') {
      return res.status(400).json({
        success: false,
        message: 'Email already exists'
      });
    }
    res.status(500).json({
      success: false,
      message: 'Registration failed'
    });
  }
});

// Dashboard statistics endpoint
app.get('/api/admin/statistics', authMiddleware, (req, res) => {
  if (req.user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  const totalBeneficiaries = db.prepare('SELECT COUNT(*) as count FROM beneficiaries').get();
  const pendingRSBSA = db.prepare("SELECT COUNT(*) as count FROM beneficiaries WHERE rsbsa_number IS NULL").get();
  const activeInterventions = db.prepare('SELECT COUNT(*) as count FROM interventions').get();
  const daInterventions = db.prepare("SELECT COUNT(*) as count FROM interventions WHERE intervention_type = 'DA'").get();

  res.json({
    totalBeneficiaries: totalBeneficiaries.count,
    pendingRSBSA: pendingRSBSA.count,
    activeInterventions: activeInterventions.count,
    activeDisasterReports: daInterventions.count
  });
});

// Beneficiaries search endpoint
app.get('/api/admin/beneficiaries', authMiddleware, (req, res) => {
  if (req.user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  const { search } = req.query;
  let query = 'SELECT * FROM beneficiaries';
  const params = [];

  if (search) {
    query += ' WHERE name LIKE ? OR first_name LIKE ? OR last_name LIKE ? OR rsbsa_number LIKE ? OR barangay LIKE ?';
    const searchTerm = `%${search}%`;
    params.push(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm);
  }

  const beneficiaries = db.prepare(query).all(...params);
  
  res.json({
    beneficiaries: beneficiaries.map(b => ({
      id: b.id,
      name: b.name,
      firstName: b.first_name,
      lastName: b.last_name,
      rsbsaNumber: b.rsbsa_number,
      barangay: b.barangay,
      household: b.household
    }))
  });
});

// DA Interventions endpoint (updated for new schema)
app.get('/api/admin/da-interventions', authMiddleware, (req, res) => {
  if (req.user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  const { search, rsbsa, barangay, intervention } = req.query;
  
  let query = `
    SELECT DISTINCT b.id, b.first_name, b.last_name, b.name, b.rsbsa_number, b.barangay, b.household, i.intervention_name, i.status, i.intervention_date
    FROM beneficiaries b
    JOIN interventions i ON b.id = i.beneficiary_id
    WHERE i.intervention_type = 'DA'
  `;
  const params = [];

  if (search) {
    query += ' AND (b.name LIKE ? OR b.first_name LIKE ? OR b.last_name LIKE ? OR b.rsbsa_number LIKE ?)';
    const searchTerm = `%${search}%`;
    params.push(searchTerm, searchTerm, searchTerm, searchTerm);
  }

  if (rsbsa) {
    query += ' AND b.rsbsa_number LIKE ?';
    params.push(`%${rsbsa}%`);
  }

  if (barangay) {
    query += ' AND b.barangay = ?';
    params.push(barangay);
  }

  if (intervention) {
    query += ' AND i.intervention_name = ?';
    params.push(intervention);
  }

  const beneficiaries = db.prepare(query).all(...params);
  
  // Extract unique barangays and interventions for filters
  const allDABeneficiaries = db.prepare(`
    SELECT DISTINCT b.barangay, i.intervention_name
    FROM beneficiaries b
    JOIN interventions i ON b.id = i.beneficiary_id
    WHERE i.intervention_type = 'DA'
  `).all();
  
  const uniqueInterventions = [...new Set(allDABeneficiaries.map(i => i.intervention_name))].sort();

  res.json({
    beneficiaries: beneficiaries.map(b => ({
      id: b.id,
      name: b.name,
      rsbsaNumber: b.rsbsa_number,
      barangay: b.barangay,
      household: b.household,
      intervention: b.intervention_name,
      status: b.status,
      date: b.intervention_date
    })),
    filters: {
      barangays: OFFICIAL_BARANGAYS,
      interventions: uniqueInterventions
    }
  });
});

// LGU Interventions endpoint
app.get('/api/admin/lgu-interventions', authMiddleware, (req, res) => {
  if (req.user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  const { search, rsbsa, barangay, intervention } = req.query;
  
  let query = `
    SELECT DISTINCT b.id, b.first_name, b.last_name, b.name, b.rsbsa_number, b.barangay, b.household, i.intervention_name, i.status, i.intervention_date
    FROM beneficiaries b
    JOIN interventions i ON b.id = i.beneficiary_id
    WHERE i.intervention_type = 'LGU'
  `;
  const params = [];

  if (search) {
    query += ' AND (b.name LIKE ? OR b.first_name LIKE ? OR b.last_name LIKE ? OR b.rsbsa_number LIKE ?)';
    const searchTerm = `%${search}%`;
    params.push(searchTerm, searchTerm, searchTerm, searchTerm);
  }

  if (rsbsa) {
    query += ' AND b.rsbsa_number LIKE ?';
    params.push(`%${rsbsa}%`);
  }

  if (barangay) {
    query += ' AND b.barangay = ?';
    params.push(barangay);
  }

  if (intervention) {
    query += ' AND i.intervention_name = ?';
    params.push(intervention);
  }

  const beneficiaries = db.prepare(query).all(...params);
  
  // Extract unique barangays and interventions for filters
  const allLGUBeneficiaries = db.prepare(`
    SELECT DISTINCT b.barangay, i.intervention_name
    FROM beneficiaries b
    JOIN interventions i ON b.id = i.beneficiary_id
    WHERE i.intervention_type = 'LGU'
  `).all();
  
  const uniqueInterventions = [...new Set(allLGUBeneficiaries.map(i => i.intervention_name))].sort();

  res.json({
    beneficiaries: beneficiaries.map(b => ({
      id: b.id,
      name: b.name,
      rsbsaNumber: b.rsbsa_number,
      barangay: b.barangay,
      household: b.household,
      intervention: b.intervention_name,
      status: b.status,
      date: b.intervention_date
    })),
    filters: {
      barangays: OFFICIAL_BARANGAYS,
      interventions: uniqueInterventions
    }
  });
});

// Get all available interventions
app.get('/api/admin/interventions-list', authMiddleware, (req, res) => {
  if (req.user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  const interventionType = req.query.type || 'LGU'; // Default to LGU
  const interventions = db.prepare(`
    SELECT DISTINCT intervention_name 
    FROM interventions 
    WHERE intervention_type = ?
    ORDER BY intervention_name
  `).all(interventionType);

  res.json({
    interventions: interventions.map(i => i.intervention_name)
  });
});

// Add new beneficiary with intervention
app.post('/api/admin/add-beneficiary', authMiddleware, async (req, res) => {
  if (req.user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  const {
    firstName,
    middleName,
    lastName,
    birthdate,
    address,
    barangay,
    contactNumber,
    farmLocation,
    cropType,
    rsbsaNumber,
    lguIntervention,
    interventionStatus,
    interventionDate,
    household
  } = req.body;

  // Validate required fields
  if (!firstName || !lastName || !birthdate || !barangay || !lguIntervention) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  // Validate barangay
  if (!isValidBarangay(barangay)) {
    return res.status(400).json({ error: getBarangayValidationError() });
  }

  // Calculate age
  const birthDateObj = new Date(birthdate);
  const today = new Date();
  let age = today.getFullYear() - birthDateObj.getFullYear();
  const monthDiff = today.getMonth() - birthDateObj.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDateObj.getDate())) {
    age--;
  }

  // Check age >= 18
  if (age < 18) {
    return res.status(400).json({ error: 'Beneficiary must be 18 years old or above' });
  }

  // Check if beneficiary already exists
  let beneficiary = null;
  if (rsbsaNumber) {
    beneficiary = db.prepare('SELECT * FROM beneficiaries WHERE rsbsa_number = ?').get(rsbsaNumber);
  }

  try {
    let beneficiaryId;

    if (beneficiary) {
      // Update existing beneficiary
      beneficiaryId = beneficiary.id;
      db.prepare(`
        UPDATE beneficiaries 
        SET address = ?, contact_number = ?, farm_location = ?, crop_type = ?, household = ?
        WHERE id = ?
      `).run(address, contactNumber, farmLocation, cropType, household || beneficiary.household, beneficiaryId);
    } else {
      // Create new beneficiary
      const fullName = `${firstName} ${middleName || ''} ${lastName}`.trim();
      const result = db.prepare(`
        INSERT INTO beneficiaries (first_name, middle_name, last_name, name, rsbsa_number, birthdate, age, address, barangay, contact_number, farm_location, crop_type, household)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(firstName, middleName, lastName, fullName, rsbsaNumber || null, birthdate, age, address, barangay, contactNumber, farmLocation, cropType, household || '1 member');

      beneficiaryId = result.lastInsertRowid;
    }

    // Check if intervention already exists for this beneficiary
    const existingIntervention = db.prepare(`
      SELECT * FROM interventions 
      WHERE beneficiary_id = ? AND intervention_type = 'LGU' AND intervention_name = ?
    `).get(beneficiaryId, lguIntervention);

    if (!existingIntervention) {
      // Add intervention record
      db.prepare(`
        INSERT INTO interventions (beneficiary_id, intervention_type, intervention_name, status, intervention_date)
        VALUES (?, ?, ?, ?, ?)
      `).run(beneficiaryId, 'LGU', lguIntervention, interventionStatus || 'Unclaimed', interventionDate || new Date().toISOString().split('T')[0]);
    } else {
      return res.status(400).json({ error: 'This beneficiary already has this LGU intervention' });
    }

    logAudit({
      userId: req.user.id,
      username: req.user.name,
      userRole: req.user.role,
      action: beneficiary ? 'Updated Beneficiary' : 'Added Beneficiary',
      module: 'Beneficiary Management',
      recordType: 'beneficiary',
      recordId: beneficiaryId,
      recordAffected: beneficiary ? beneficiary.name : `${firstName} ${middleName || ''} ${lastName}`.trim(),
      description: beneficiary
        ? `Updated beneficiary record with ${lguIntervention} intervention`
        : `Added new beneficiary with ${lguIntervention} intervention`
    });

    res.json({
      success: true,
      message: 'Beneficiary added successfully',
      beneficiaryId: beneficiaryId
    });
  } catch (error) {
    console.error('Error adding beneficiary:', error);
    res.status(500).json({ error: 'Failed to add beneficiary' });
  }
});

// Get all crisis reports with filtering
app.get('/api/admin/crisis-reports', authMiddleware, (req, res) => {
  if (req.user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  const { crisisType, barangay, status, search } = req.query;

  let query = `
    SELECT cr.*, b.name as beneficiary_name
    FROM crisis_reports cr
    JOIN beneficiaries b ON cr.beneficiary_id = b.id
    WHERE 1=1
  `;
  const params = [];

  if (crisisType && crisisType !== 'All') {
    query += ' AND cr.crisis_type = ?';
    params.push(crisisType);
  }

  if (barangay && barangay !== 'All') {
    query += ' AND cr.barangay = ?';
    params.push(barangay);
  }

  if (status && status !== 'All') {
    query += ' AND cr.status = ?';
    params.push(status);
  }

  if (search) {
    query += ' AND (b.name LIKE ? OR b.first_name LIKE ? OR b.last_name LIKE ?)';
    const searchTerm = `%${search}%`;
    params.push(searchTerm, searchTerm, searchTerm);
  }

  query += ' ORDER BY cr.created_at DESC';

  const reports = db.prepare(query).all(...params);

  // Get unique crisis types, barangays, and statuses for filters
  const allReports = db.prepare(`
    SELECT DISTINCT crisis_type, barangay, status
    FROM crisis_reports
  `).all();

  const crisisTypes = [...new Set(allReports.map(r => r.crisis_type))].sort();
  const barangays = OFFICIAL_BARANGAYS;
  const statuses = [...new Set(allReports.map(r => r.status))].sort();

  res.json({
    reports: reports.map(r => ({
      id: r.id,
      beneficiaryId: r.beneficiary_id,
      beneficiaryName: r.beneficiary_name,
      crisisType: r.crisis_type,
      crisisDate: r.crisis_date,
      barangay: r.barangay,
      farmLocation: r.farm_location,
      cropType: r.crop_type,
      cropStage: r.crop_stage,
      totalAreaHectares: r.total_area_hectares,
      damagedAreaHectares: r.damaged_area_hectares,
      productionLossMt: r.production_loss_mt,
      estimatedDamageCost: r.estimated_damage_cost,
      remarks: r.remarks,
      status: r.status,
      createdAt: r.created_at
    })),
    filters: {
      crisisTypes,
      barangays,
      statuses
    }
  });
});

// Get crisis report summary statistics
app.get('/api/admin/crisis-reports/summary', authMiddleware, (req, res) => {
  if (req.user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  const { crisisType, barangay, status } = req.query;

  let query = 'SELECT * FROM crisis_reports WHERE 1=1';
  const params = [];

  if (crisisType && crisisType !== 'All') {
    query += ' AND crisis_type = ?';
    params.push(crisisType);
  }

  if (barangay && barangay !== 'All') {
    query += ' AND barangay = ?';
    params.push(barangay);
  }

  if (status && status !== 'All') {
    query += ' AND status = ?';
    params.push(status);
  }

  const reports = db.prepare(query).all(...params);

  const farmersAffected = reports.length;
  const totalAreaDamaged = reports.reduce((sum, r) => sum + (r.damaged_area_hectares || 0), 0);
  const productionLoss = reports.reduce((sum, r) => sum + (r.production_loss_mt || 0), 0);
  const estimatedCost = reports.reduce((sum, r) => sum + (r.estimated_damage_cost || 0), 0);

  res.json({
    farmersAffected,
    totalAreaDamaged: parseFloat(totalAreaDamaged.toFixed(2)),
    productionLoss: parseFloat(productionLoss.toFixed(2)),
    estimatedCost: Math.round(estimatedCost)
  });
});

// Create a new crisis report
app.post('/api/admin/crisis-reports', authMiddleware, (req, res) => {
  if (req.user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  const {
    beneficiaryId,
    crisisType,
    crisisDate,
    barangay,
    farmLocation,
    cropType,
    cropStage,
    totalAreaHectares,
    damagedAreaHectares,
    productionLossMt,
    estimatedDamageCost,
    remarks
  } = req.body;

  if (!beneficiaryId || !crisisType || !crisisDate || !barangay) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  // Validate barangay
  if (!isValidBarangay(barangay)) {
    return res.status(400).json({ error: getBarangayValidationError() });
  }

  try {
    const result = db.prepare(`
      INSERT INTO crisis_reports (
        beneficiary_id, crisis_type, crisis_date, barangay, farm_location, crop_type, crop_stage,
        total_area_hectares, damaged_area_hectares, production_loss_mt, estimated_damage_cost, remarks, created_by
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      beneficiaryId, crisisType, crisisDate, barangay, farmLocation, cropType, cropStage,
      totalAreaHectares, damagedAreaHectares, productionLossMt, estimatedDamageCost, remarks, req.user.id
    );

    const beneficiary = db.prepare('SELECT name FROM beneficiaries WHERE id = ?').get(beneficiaryId);

    logAudit({
      userId: req.user.id,
      username: req.user.name,
      userRole: req.user.role,
      action: 'Created Crisis Report',
      module: 'Crisis Reports',
      recordType: 'crisis_report',
      recordId: result.lastInsertRowid,
      recordAffected: beneficiary ? beneficiary.name : `Beneficiary #${beneficiaryId}`,
      description: `Created ${crisisType} report for ${barangay}`
    });

    res.json({
      success: true,
      message: 'Crisis report created successfully',
      reportId: result.lastInsertRowid
    });
  } catch (error) {
    console.error('Error creating crisis report:', error);
    res.status(500).json({ error: 'Failed to create crisis report' });
  }
});

// Validate a crisis report
app.put('/api/admin/crisis-reports/:id/validate', authMiddleware, (req, res) => {
  if (req.user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  const { id } = req.params;

  try {
    db.prepare(`
      UPDATE crisis_reports 
      SET status = 'Validated', validated_by = ?, validated_date = ?
      WHERE id = ?
    `).run(req.user.id, new Date().toISOString().split('T')[0], id);

    const report = db.prepare('SELECT crisis_type, barangay FROM crisis_reports WHERE id = ?').get(id);

    logAudit({
      userId: req.user.id,
      username: req.user.name,
      userRole: req.user.role,
      action: 'Validated Crisis Report',
      module: 'Crisis Reports',
      recordType: 'crisis_report',
      recordId: parseInt(id),
      recordAffected: report ? `${report.crisis_type} - ${report.barangay}` : `Crisis report #${id}`,
      description: 'Validated crisis report'
    });

    res.json({ success: true, message: 'Crisis report validated' });
  } catch (error) {
    console.error('Error validating crisis report:', error);
    res.status(500).json({ error: 'Failed to validate crisis report' });
  }
});

// ============================================================
// Agricultural Technologist endpoints
// ============================================================

// Agritech beneficiaries list (with optional pending-only filter)
app.get('/api/agritech/beneficiaries', authMiddleware, (req, res) => {
  if (req.user.role !== 'AGRICULTURAL_TECHNOLOGIST') {
    return res.status(403).json({ error: 'Agricultural Technologist access required' });
  }

  const { search, pending } = req.query;

  let query = `
    SELECT b.*,
           GROUP_CONCAT(DISTINCT i.intervention_name) AS intervention,
           MAX(i.status) AS status,
           MAX(i.intervention_date) AS intervention_date
    FROM beneficiaries b
    LEFT JOIN interventions i ON b.id = i.beneficiary_id
    WHERE 1=1
  `;
  const params = [];

  if (pending === 'true') {
    query += " AND (b.rsbsa_number IS NULL OR b.validation_status = 'Pending')";
  }

  if (search) {
    query += ' AND (b.name LIKE ? OR b.first_name LIKE ? OR b.last_name LIKE ? OR b.rsbsa_number LIKE ? OR b.barangay LIKE ?)';
    const searchTerm = `%${search}%`;
    params.push(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm);
  }

  query += ' GROUP BY b.id ORDER BY b.name ASC';

  const beneficiaries = db.prepare(query).all(...params);

  // Unique barangays and interventions for filter options
  const allInterventions = db.prepare('SELECT DISTINCT intervention_name FROM interventions ORDER BY intervention_name').all();

  res.json({
    beneficiaries: beneficiaries.map((b) => ({
      id: b.id,
      name: b.name,
      firstName: b.first_name,
      lastName: b.last_name,
      rsbsaNumber: b.rsbsa_number,
      barangay: b.barangay,
      household: b.household,
      farmLocation: b.farm_location,
      cropType: b.crop_type,
      intervention: b.intervention || 'None Assigned',
      status: b.status || 'Pending',
      date: b.intervention_date
    })),
    filters: {
      barangays: OFFICIAL_BARANGAYS,
      interventions: allInterventions.map((i) => i.intervention_name)
    }
  });
});

// Agritech validate beneficiary
app.put('/api/agritech/beneficiaries/:id/validate', authMiddleware, (req, res) => {
  if (req.user.role !== 'AGRICULTURAL_TECHNOLOGIST') {
    return res.status(403).json({ error: 'Agricultural Technologist access required' });
  }

  const { id } = req.params;

  try {
    const beneficiary = db.prepare('SELECT * FROM beneficiaries WHERE id = ?').get(id);
    if (!beneficiary) {
      return res.status(404).json({ error: 'Beneficiary not found' });
    }

    db.prepare("UPDATE beneficiaries SET validation_status = 'Validated' WHERE id = ?").run(id);

    logAudit({
      userId: req.user.id,
      username: req.user.name,
      userRole: req.user.role,
      action: 'Validated Beneficiary',
      module: 'Beneficiary Validation',
      recordType: 'beneficiary',
      recordId: parseInt(id),
      recordAffected: beneficiary.name,
      description: 'Validated beneficiary record'
    });

    res.json({ success: true, message: 'Beneficiary validated' });
  } catch (error) {
    console.error('Error validating beneficiary:', error);
    res.status(500).json({ error: 'Failed to validate beneficiary' });
  }
});

// Agritech reject beneficiary
app.put('/api/agritech/beneficiaries/:id/reject', authMiddleware, (req, res) => {
  if (req.user.role !== 'AGRICULTURAL_TECHNOLOGIST') {
    return res.status(403).json({ error: 'Agricultural Technologist access required' });
  }

  const { id } = req.params;

  try {
    const beneficiary = db.prepare('SELECT * FROM beneficiaries WHERE id = ?').get(id);
    if (!beneficiary) {
      return res.status(404).json({ error: 'Beneficiary not found' });
    }

    db.prepare("UPDATE beneficiaries SET validation_status = 'Rejected' WHERE id = ?").run(id);

    logAudit({
      userId: req.user.id,
      username: req.user.name,
      userRole: req.user.role,
      action: 'Rejected Beneficiary',
      module: 'Beneficiary Validation',
      recordType: 'beneficiary',
      recordId: parseInt(id),
      recordAffected: beneficiary.name,
      description: 'Rejected beneficiary record'
    });

    res.json({ success: true, message: 'Beneficiary rejected' });
  } catch (error) {
    console.error('Error rejecting beneficiary:', error);
    res.status(500).json({ error: 'Failed to reject beneficiary' });
  }
});

// Agritech interventions (DA or LGU)
app.get('/api/agritech/interventions', authMiddleware, (req, res) => {
  if (req.user.role !== 'AGRICULTURAL_TECHNOLOGIST') {
    return res.status(403).json({ error: 'Agricultural Technologist access required' });
  }

  const { type } = req.query;

  if (type !== 'DA' && type !== 'LGU') {
    return res.status(400).json({ error: 'Invalid intervention type' });
  }

  const { search } = req.query;

  let query = `
    SELECT DISTINCT b.id, b.first_name, b.last_name, b.name, b.rsbsa_number, b.barangay, b.household, i.intervention_name, i.status, i.intervention_date
    FROM beneficiaries b
    JOIN interventions i ON b.id = i.beneficiary_id
    WHERE i.intervention_type = ?
  `;
  const params = [type];

  if (search) {
    query += ' AND (b.name LIKE ? OR b.first_name LIKE ? OR b.last_name LIKE ? OR b.rsbsa_number LIKE ? OR b.barangay LIKE ?)';
    const searchTerm = `%${search}%`;
    params.push(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm);
  }

  query += ' ORDER BY b.name ASC';

  const beneficiaries = db.prepare(query).all(...params);

  res.json({
    beneficiaries: beneficiaries.map((b) => ({
      id: b.id,
      name: b.name,
      rsbsaNumber: b.rsbsa_number,
      barangay: b.barangay,
      household: b.household,
      intervention: b.intervention_name,
      status: b.status,
      date: b.intervention_date
    }))
  });
});

// Photo upload storage (in-memory; photos kept as metadata only for now)
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } });

// Agritech create damage report (crisis_reports with GPS + photos)
app.post('/api/agritech/damage-reports', authMiddleware, upload.array('photos', 5), (req, res) => {
  if (req.user.role !== 'AGRICULTURAL_TECHNOLOGIST') {
    return res.status(403).json({ error: 'Agricultural Technologist access required' });
  }

  const {
    disaster,
    barangay,
    farmerName,
    beneficiaryId,
    farmLocation,
    cropType,
    cropStage,
    totalArea,
    partialArea,
    latitude,
    longitude
  } = req.body;

  if (!disaster || !barangay || !farmerName || !latitude || !longitude) {
    return res.status(400).json({ error: 'Missing required fields (farmer name, barangay, GPS coordinates)' });
  }

  // Validate barangay
  if (!isValidBarangay(barangay)) {
    return res.status(400).json({ error: getBarangayValidationError() });
  }

  try {
    // Resolve beneficiary - use matching beneficiary if provided, otherwise find by name, or create a minimal record
    let beneficiary = null;

    if (beneficiaryId) {
      beneficiary = db.prepare('SELECT * FROM beneficiaries WHERE id = ?').get(beneficiaryId);
    }

    if (!beneficiary) {
      beneficiary = db.prepare('SELECT * FROM beneficiaries WHERE name = ?').get(farmerName);
    }

    if (!beneficiary) {
      const result = db.prepare(`
        INSERT INTO beneficiaries (first_name, last_name, name, rsbsa_number, barangay, farm_location, crop_type, household, validation_status)
        VALUES (?, ?, ?, NULL, ?, ?, ?, ?, 'Pending')
      `).run(
        farmerName.trim().split(' ')[0] || 'Unknown',
        farmerName.trim().split(' ').slice(1).join(' ') || farmerName.trim(),
        farmerName.trim(),
        barangay,
        farmLocation || null,
        cropType || null,
        '1 member'
      );
      beneficiary = db.prepare('SELECT * FROM beneficiaries WHERE id = ?').get(result.lastInsertRowid);
    }

    // Summarize photo metadata
    const photoNames = (req.files || []).map((file) => file.originalname);

    const result = db.prepare(`
      INSERT INTO crisis_reports (
        beneficiary_id, crisis_type, crisis_date, barangay, farm_location, crop_type, crop_stage,
        total_area_hectares, damaged_area_hectares, latitude, longitude, photos, remarks, status, created_by
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'For Validation', ?)
    `).run(
      beneficiary.id,
      disaster,
      new Date().toISOString().split('T')[0],
      barangay,
      farmLocation || null,
      cropType || null,
      cropStage || null,
      totalArea ? parseFloat(totalArea) : null,
      partialArea ? parseFloat(partialArea) : null,
      parseFloat(latitude),
      parseFloat(longitude),
      photoNames.length > 0 ? JSON.stringify(photoNames) : null,
      `Filed by Agricultural Technologist: ${farmerName}`,
      req.user.id
    );

    logAudit({
      userId: req.user.id,
      username: req.user.name,
      userRole: req.user.role,
      action: 'Filed Disaster Report',
      module: 'Disaster Reports',
      recordType: 'crisis_report',
      recordId: result.lastInsertRowid,
      recordAffected: `${disaster} - ${barangay}`,
      description: `Filed ${disaster} damage report for ${farmerName} (${barangay})`
    });

    res.json({
      success: true,
      message: 'Damage report submitted successfully',
      reportId: result.lastInsertRowid
    });
  } catch (error) {
    console.error('Error creating damage report:', error);
    res.status(500).json({ error: 'Failed to create damage report' });
  }
});

// Agritech list damage reports
app.get('/api/agritech/damage-reports', authMiddleware, (req, res) => {
  if (req.user.role !== 'AGRICULTURAL_TECHNOLOGIST') {
    return res.status(403).json({ error: 'Agricultural Technologist access required' });
  }

  const reports = db.prepare(`
    SELECT cr.*, b.name as farmer_name
    FROM crisis_reports cr
    JOIN beneficiaries b ON cr.beneficiary_id = b.id
    ORDER BY cr.created_at DESC
  `).all();

  res.json({
    reports: reports.map((r) => ({
      id: r.id,
      beneficiaryId: r.beneficiary_id,
      farmerName: r.farmer_name,
      disaster: r.crisis_type,
      crisisDate: r.crisis_date,
      barangay: r.barangay,
      farmLocation: r.farm_location,
      cropType: r.crop_type,
      cropStage: r.crop_stage,
      totalAreaHectares: r.total_area_hectares,
      damagedAreaHectares: r.damaged_area_hectares,
      latitude: r.latitude,
      longitude: r.longitude,
      photos: r.photos ? JSON.parse(r.photos) : [],
      status: r.status,
      createdAt: r.created_at
    }))
  });
});

// Audit Trail endpoints - Admin only
app.get('/api/admin/audit-trail', authMiddleware, (req, res) => {
  if (req.user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  try {
    const { username, action, startDate, endDate, limit } = req.query;
    
    const filters = {};
    if (username) filters.username = username;
    if (action) filters.action = action;
    if (startDate) filters.startDate = startDate;
    if (endDate) filters.endDate = endDate;
    if (limit) filters.limit = parseInt(limit);

    const auditLogs = getAuditLogs(filters);
    const actions = getAuditActions();

    res.json({
      auditLogs,
      actions,
      success: true
    });
  } catch (error) {
    console.error('Error fetching audit trail:', error);
    res.status(500).json({ error: 'Failed to fetch audit trail' });
  }
});

// Reports - available programs and distribution cycles (Admin only)
app.get('/api/admin/reports/filters', authMiddleware, (req, res) => {
  if (req.user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  try {
    const { programs, distributionCycles } = getReportFilters();
    res.json({ programs, distributionCycles });
  } catch (error) {
    console.error('Error fetching report filters:', error);
    res.status(500).json({ error: 'Failed to load report filters' });
  }
});

// Reports - generate and download report file (Admin only)
app.get('/api/admin/reports/generate', authMiddleware, async (req, res) => {
  if (req.user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  const { program, startDate, endDate, distributionCycle, format } = req.query;

  if (startDate && endDate && startDate > endDate) {
    return res.status(400).json({ error: 'Start Date cannot be later than End Date' });
  }

  const formatKey = (format || 'pdf').toLowerCase();

  if (!['pdf', 'xlsx', 'excel', 'csv'].includes(formatKey)) {
    return res.status(400).json({ error: 'Unsupported export format' });
  }

  try {
    const records = getReportRecords({ program, startDate, endDate, distributionCycle });

    if (records.length === 0) {
      return res.status(404).json({ error: 'No records found for the selected filters' });
    }

    logAudit({
      userId: req.user.id,
      username: req.user.name,
      userRole: req.user.role,
      action: 'Generated Report',
      module: 'Reports',
      recordType: 'report',
      recordId: null,
      recordAffected: `${program || 'All (DA & LGU)'} · ${distributionCycle || 'All Cycles'} · ${formatKey.toUpperCase()}`,
      description: `Generated ${formatKey.toUpperCase()} report (${records.length} records)`
    });

    const fileNameBase = `AGAPAY_Report_${new Date().toISOString().split('T')[0]}`;

    if (formatKey === 'csv') {
      const csv = generateCsv(records);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${fileNameBase}.csv"`);
      return res.send(csv);
    }

    if (formatKey === 'xlsx' || formatKey === 'excel') {
      const buffer = await generateExcel(records);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${fileNameBase}.xlsx"`);
      return res.send(buffer);
    }

    const buffer = await generatePdf(records);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileNameBase}.pdf"`);
    res.send(buffer);
  } catch (error) {
    console.error('Error generating report:', error);
    res.status(500).json({ error: 'Unable to generate report. Please try again.' });
  }
});

// ------------------------------------------------------------
// Shared Beneficiary Search (role-aware)
// ------------------------------------------------------------
app.get('/api/beneficiaries/search', authMiddleware, (req, res) => {
  if (!['ADMIN', 'AGRICULTURAL_TECHNOLOGIST', 'DATA_ENCODER'].includes(req.user.role)) {
    return res.status(403).json({ success: false, message: 'Access denied' });
  }

  const { q, limit = 25 } = req.query;
  const boundedLimit = Math.min(Math.max(parseInt(limit, 10) || 25, 1), 100);

  let query = `
    SELECT b.*, GROUP_CONCAT(DISTINCT i.intervention_name) AS interventions
    FROM beneficiaries b
    LEFT JOIN interventions i ON b.id = i.beneficiary_id
    WHERE 1=1
  `;
  const params = [];

  if (q) {
    query += ' AND (b.name LIKE ? OR b.rsbsa_number LIKE ? OR b.barangay LIKE ?)';
    const term = `%${String(q).trim()}%`;
    params.push(term, term, term);
  }

  query += ' GROUP BY b.id ORDER BY b.created_at DESC LIMIT ?';
  params.push(boundedLimit);

  const rows = db.prepare(query).all(...params);

  res.json({
    success: true,
    beneficiaries: rows.map((b) => ({
      id: b.id,
      name: b.name,
      firstName: b.first_name,
      lastName: b.last_name,
      rsbsaNumber: b.rsbsa_number,
      barangay: b.barangay,
      household: b.household,
      validationStatus: b.validation_status,
      interventions: b.interventions ? b.interventions.split(',') : [],
      createdAt: b.created_at
    }))
  });
});

// ------------------------------------------------------------
// Data Encoder: statistics + pending queue + low stock
// ------------------------------------------------------------
app.get('/api/encoding/statistics', authMiddleware, (req, res) => {
  if (req.user.role !== 'DATA_ENCODER') {
    return res.status(403).json({ success: false, message: 'Data Encoder access required' });
  }

  const range = monthDateRange();
  const encodedThisMonth = db.prepare(`
    SELECT COUNT(*) AS count
    FROM beneficiaries
    WHERE created_by = ?
      AND created_at >= ?
      AND created_at < ?
  `).get(req.user.id, range.start, range.end).count;

  const recordsToBeUpdated = db.prepare(`
    SELECT COUNT(*) AS count
    FROM beneficiaries
    WHERE rsbsa_number IS NULL
       OR validation_status = 'Pending'
       OR barangay IS NULL
       OR address IS NULL
       OR contact_number IS NULL
  `).get().count;

  const lowStockItems = db.prepare(`
    SELECT COUNT(*) AS count
    FROM inventory_items
    WHERE current_quantity <= low_stock_threshold
  `).get().count;

  res.json({
    success: true,
    encodedThisMonth,
    recordsToBeUpdated,
    lowStockItems
  });
});

app.get('/api/encoding/pending', authMiddleware, (req, res) => {
  if (req.user.role !== 'DATA_ENCODER') {
    return res.status(403).json({ success: false, message: 'Data Encoder access required' });
  }

  const rows = db.prepare(`
    SELECT id, name, rsbsa_number, barangay, address, contact_number, validation_status, created_at
    FROM beneficiaries
    WHERE rsbsa_number IS NULL
       OR validation_status = 'Pending'
       OR barangay IS NULL
       OR address IS NULL
       OR contact_number IS NULL
    ORDER BY created_at DESC
    LIMIT 50
  `).all();

  const queue = rows.map((row) => ({
    id: row.id,
    name: row.name,
    source: row.created_at ? 'Manual Entry' : 'System',
    issue: detectQueueIssue(row) || 'Needs record update',
    dateAdded: row.created_at
  }));

  res.json({ success: true, queue });
});

app.get('/api/inventory/low-stock', authMiddleware, (req, res) => {
  if (!['ADMIN', 'DATA_ENCODER'].includes(req.user.role)) {
    return res.status(403).json({ success: false, message: 'Access denied' });
  }

  const items = db.prepare(`
    SELECT id, item_name, current_quantity, low_stock_threshold, unit, updated_at
    FROM inventory_items
    WHERE current_quantity <= low_stock_threshold
    ORDER BY (low_stock_threshold - current_quantity) DESC, item_name ASC
  `).all();

  res.json({
    success: true,
    count: items.length,
    items: items.map((item) => ({
      id: item.id,
      name: item.item_name,
      quantity: item.current_quantity,
      threshold: item.low_stock_threshold,
      unit: item.unit,
      updatedAt: item.updated_at
    }))
  });
});

app.get('/api/dashboard/data-encoder', authMiddleware, (req, res) => {
  if (req.user.role !== 'DATA_ENCODER') {
    return res.status(403).json({ success: false, message: 'Data Encoder access required' });
  }

  const range = monthDateRange();
  const encodedThisMonth = db.prepare(`
    SELECT COUNT(*) AS count
    FROM beneficiaries
    WHERE created_by = ?
      AND created_at >= ?
      AND created_at < ?
  `).get(req.user.id, range.start, range.end).count;

  const recordsToBeUpdated = db.prepare(`
    SELECT COUNT(*) AS count
    FROM beneficiaries
    WHERE rsbsa_number IS NULL
       OR validation_status = 'Pending'
       OR barangay IS NULL
       OR address IS NULL
       OR contact_number IS NULL
  `).get().count;

  const lowStockItems = db.prepare(`
    SELECT COUNT(*) AS count
    FROM inventory_items
    WHERE current_quantity <= low_stock_threshold
  `).get().count;

  const pendingRows = db.prepare(`
    SELECT id, name, rsbsa_number, barangay, address, contact_number, validation_status, created_at
    FROM beneficiaries
    WHERE rsbsa_number IS NULL
       OR validation_status = 'Pending'
       OR barangay IS NULL
       OR address IS NULL
       OR contact_number IS NULL
    ORDER BY created_at DESC
    LIMIT 12
  `).all();

  res.json({
    success: true,
    profile: {
      id: req.user.id,
      name: req.user.name,
      role: req.user.role
    },
    stats: {
      encodedThisMonth,
      recordsToBeUpdated,
      lowStockItems
    },
    pendingQueue: pendingRows.map((row) => ({
      id: row.id,
      name: row.name,
      source: row.created_at ? 'Manual Entry' : 'System',
      issue: detectQueueIssue(row) || 'Needs record update',
      dateAdded: row.created_at
    }))
  });
});

// ------------------------------------------------------------
// Data Encoder beneficiary creation + interventions
// ------------------------------------------------------------
app.get('/api/data-encoder/interventions-list', authMiddleware, (req, res) => {
  if (req.user.role !== 'DATA_ENCODER') {
    return res.status(403).json({ success: false, message: 'Data Encoder access required' });
  }

  const interventionType = req.query.type || 'LGU';
  const interventions = db.prepare(`
    SELECT DISTINCT intervention_name
    FROM interventions
    WHERE intervention_type = ?
    ORDER BY intervention_name
  `).all(interventionType);

  res.json({ success: true, interventions: interventions.map((i) => i.intervention_name) });
});

app.get('/api/data-encoder/beneficiaries', authMiddleware, (req, res) => {
  if (req.user.role !== 'DATA_ENCODER') {
    return res.status(403).json({ success: false, message: 'Data Encoder access required' });
  }

  const { search } = req.query;
  let query = `
    SELECT b.*, GROUP_CONCAT(DISTINCT i.intervention_name) AS intervention
    FROM beneficiaries b
    LEFT JOIN interventions i ON b.id = i.beneficiary_id
    WHERE 1=1
  `;
  const params = [];

  if (search) {
    query += ' AND (b.name LIKE ? OR b.first_name LIKE ? OR b.last_name LIKE ? OR b.rsbsa_number LIKE ? OR b.barangay LIKE ?)';
    const searchTerm = `%${search}%`;
    params.push(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm);
  }

  query += ' GROUP BY b.id ORDER BY b.name ASC';
  const beneficiaries = db.prepare(query).all(...params);

  res.json({
    success: true,
    beneficiaries: beneficiaries.map((b) => ({
      id: b.id,
      name: b.name,
      firstName: b.first_name,
      lastName: b.last_name,
      rsbsaNumber: b.rsbsa_number,
      barangay: b.barangay,
      household: b.household,
      intervention: b.intervention || 'None Assigned'
    }))
  });
});

app.post('/api/data-encoder/add-beneficiary', authMiddleware, (req, res) => {
  if (req.user.role !== 'DATA_ENCODER') {
    return res.status(403).json({ success: false, message: 'Data Encoder access required' });
  }

  const {
    firstName,
    middleName,
    lastName,
    birthdate,
    address,
    barangay,
    contactNumber,
    farmLocation,
    cropType,
    rsbsaNumber,
    lguIntervention,
    interventionStatus,
    interventionDate,
    household
  } = req.body;

  if (!firstName || !lastName || !birthdate || !barangay || !lguIntervention) {
    return res.status(400).json({ success: false, message: 'Missing required fields' });
  }

  // Validate barangay
  if (!isValidBarangay(barangay)) {
    return res.status(400).json({ success: false, message: getBarangayValidationError() });
  }

  const age = calculateAgeFromBirthdate(birthdate);
  if (age == null) {
    return res.status(400).json({ success: false, message: 'Invalid birthdate format' });
  }
  if (age < 18) {
    return res.status(400).json({ success: false, message: 'Beneficiary must be 18 years old or above' });
  }

  let beneficiary = null;
  if (rsbsaNumber) {
    beneficiary = db.prepare('SELECT * FROM beneficiaries WHERE rsbsa_number = ?').get(rsbsaNumber);
  }

  try {
    let beneficiaryId;
    const fullName = `${firstName} ${middleName || ''} ${lastName}`.trim();

    if (beneficiary) {
      beneficiaryId = beneficiary.id;
      db.prepare(`
        UPDATE beneficiaries
        SET address = ?, contact_number = ?, farm_location = ?, crop_type = ?, household = ?, updated_by = ?
        WHERE id = ?
      `).run(address, contactNumber, farmLocation, cropType, household || beneficiary.household, req.user.id, beneficiaryId);
    } else {
      const result = db.prepare(`
        INSERT INTO beneficiaries (
          first_name, middle_name, last_name, name, rsbsa_number, birthdate, age, address, barangay,
          contact_number, farm_location, crop_type, household, created_by, updated_by
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        firstName,
        middleName,
        lastName,
        fullName,
        rsbsaNumber || null,
        birthdate,
        age,
        address,
        barangay,
        contactNumber,
        farmLocation,
        cropType,
        household || '1 member',
        req.user.id,
        req.user.id
      );

      beneficiaryId = result.lastInsertRowid;
    }

    const existingIntervention = db.prepare(`
      SELECT * FROM interventions
      WHERE beneficiary_id = ? AND intervention_type = 'LGU' AND intervention_name = ?
    `).get(beneficiaryId, lguIntervention);

    if (!existingIntervention) {
      db.prepare(`
        INSERT INTO interventions (beneficiary_id, intervention_type, intervention_name, status, intervention_date)
        VALUES (?, 'LGU', ?, ?, ?)
      `).run(
        beneficiaryId,
        lguIntervention,
        interventionStatus || 'Unclaimed',
        interventionDate || new Date().toISOString().split('T')[0]
      );
    }

    logAudit({
      userId: req.user.id,
      username: req.user.name,
      userRole: req.user.role,
      action: beneficiary ? 'Updated Beneficiary' : 'Added Beneficiary',
      module: 'Data Encoder',
      recordType: 'beneficiary',
      recordId: beneficiaryId,
      recordAffected: fullName,
      description: beneficiary
        ? `Updated beneficiary record with ${lguIntervention} intervention`
        : `Added beneficiary with ${lguIntervention} intervention`
    });

    res.json({
      success: true,
      message: beneficiary ? 'Beneficiary updated successfully' : 'Beneficiary added successfully',
      beneficiaryId
    });
  } catch (error) {
    console.error('Data Encoder add beneficiary error:', error);
    res.status(500).json({ success: false, message: 'Failed to save beneficiary record' });
  }
});

app.get('/api/data-encoder/intervention-records', authMiddleware, (req, res) => {
  if (req.user.role !== 'DATA_ENCODER') {
    return res.status(403).json({ success: false, message: 'Data Encoder access required' });
  }

  const { q } = req.query;
  let query = `
    SELECT i.id, i.intervention_type, i.intervention_name, i.status, i.intervention_date,
           b.id AS beneficiary_id, b.name, b.rsbsa_number, b.barangay
    FROM interventions i
    JOIN beneficiaries b ON b.id = i.beneficiary_id
    WHERE 1=1
  `;
  const params = [];

  if (q) {
    query += ' AND (b.name LIKE ? OR b.rsbsa_number LIKE ? OR b.barangay LIKE ? OR i.intervention_name LIKE ?)';
    const term = `%${String(q).trim()}%`;
    params.push(term, term, term, term);
  }

  query += ' ORDER BY i.intervention_date DESC, i.id DESC LIMIT 200';
  const rows = db.prepare(query).all(...params);

  res.json({
    success: true,
    records: rows.map((row) => ({
      id: row.id,
      type: row.intervention_type,
      intervention: row.intervention_name,
      status: row.status,
      date: row.intervention_date,
      beneficiaryId: row.beneficiary_id,
      beneficiaryName: row.name,
      rsbsaNumber: row.rsbsa_number,
      barangay: row.barangay
    }))
  });
});

// ------------------------------------------------------------
// Data Encoder disaster reports
// ------------------------------------------------------------
app.get('/api/data-encoder/disaster-reports', authMiddleware, (req, res) => {
  if (req.user.role !== 'DATA_ENCODER') {
    return res.status(403).json({ success: false, message: 'Data Encoder access required' });
  }

  const reports = db.prepare(`
    SELECT cr.*, b.name AS farmer_name
    FROM crisis_reports cr
    JOIN beneficiaries b ON cr.beneficiary_id = b.id
    ORDER BY cr.created_at DESC
  `).all();

  res.json({
    success: true,
    reports: reports.map((r) => ({
      id: r.id,
      beneficiaryId: r.beneficiary_id,
      farmerName: r.farmer_name,
      disaster: r.crisis_type,
      crisisDate: r.crisis_date,
      barangay: r.barangay,
      farmLocation: r.farm_location,
      cropType: r.crop_type,
      cropStage: r.crop_stage,
      totalAreaHectares: r.total_area_hectares,
      damagedAreaHectares: r.damaged_area_hectares,
      latitude: r.latitude,
      longitude: r.longitude,
      photos: r.photos ? JSON.parse(r.photos) : [],
      status: r.status,
      createdAt: r.created_at
    }))
  });
});

app.post('/api/data-encoder/disaster-reports', authMiddleware, upload.array('photos', 5), (req, res) => {
  if (req.user.role !== 'DATA_ENCODER') {
    return res.status(403).json({ success: false, message: 'Data Encoder access required' });
  }

  const {
    disaster,
    barangay,
    farmerName,
    beneficiaryId,
    farmLocation,
    cropType,
    cropStage,
    totalArea,
    partialArea,
    latitude,
    longitude
  } = req.body;

  if (!disaster || !barangay || !farmerName || !latitude || !longitude) {
    return res.status(400).json({ success: false, message: 'Missing required fields (farmer name, barangay, GPS coordinates)' });
  }

  // Validate barangay
  if (!isValidBarangay(barangay)) {
    return res.status(400).json({ success: false, message: getBarangayValidationError() });
  }

  try {
    let beneficiary = null;

    if (beneficiaryId) {
      beneficiary = db.prepare('SELECT * FROM beneficiaries WHERE id = ?').get(beneficiaryId);
    }

    if (!beneficiary) {
      beneficiary = db.prepare('SELECT * FROM beneficiaries WHERE name = ?').get(farmerName);
    }

    if (!beneficiary) {
      const splitName = farmerName.trim().split(' ');
      const generated = db.prepare(`
        INSERT INTO beneficiaries (first_name, last_name, name, barangay, farm_location, crop_type, household, validation_status, created_by, updated_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'Pending', ?, ?)
      `).run(
        splitName[0] || 'Unknown',
        splitName.slice(1).join(' ') || splitName[0] || 'Unknown',
        farmerName.trim(),
        barangay,
        farmLocation || null,
        cropType || null,
        '1 member',
        req.user.id,
        req.user.id
      );
      beneficiary = db.prepare('SELECT * FROM beneficiaries WHERE id = ?').get(generated.lastInsertRowid);
    }

    const photoNames = (req.files || []).map((file) => file.originalname);

    const result = db.prepare(`
      INSERT INTO crisis_reports (
        beneficiary_id, crisis_type, crisis_date, barangay, farm_location, crop_type, crop_stage,
        total_area_hectares, damaged_area_hectares, latitude, longitude, photos, remarks, status, created_by
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'For Validation', ?)
    `).run(
      beneficiary.id,
      disaster,
      new Date().toISOString().split('T')[0],
      barangay,
      farmLocation || null,
      cropType || null,
      cropStage || null,
      totalArea ? parseFloat(totalArea) : null,
      partialArea ? parseFloat(partialArea) : null,
      parseFloat(latitude),
      parseFloat(longitude),
      photoNames.length > 0 ? JSON.stringify(photoNames) : null,
      `Filed by Data Encoder: ${farmerName}`,
      req.user.id
    );

    logAudit({
      userId: req.user.id,
      username: req.user.name,
      userRole: req.user.role,
      action: 'Filed Disaster Report',
      module: 'Data Encoder',
      recordType: 'crisis_report',
      recordId: result.lastInsertRowid,
      recordAffected: `${disaster} - ${barangay}`,
      description: `Filed ${disaster} report for ${farmerName}`
    });

    res.json({ success: true, message: 'Damage report submitted successfully', reportId: result.lastInsertRowid });
  } catch (error) {
    console.error('Data Encoder damage report error:', error);
    res.status(500).json({ success: false, message: 'Failed to create damage report' });
  }
});

// ------------------------------------------------------------
// Data Encoder Excel Import (preview + confirm)
// ------------------------------------------------------------
const excelUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } });

app.post('/api/encoding/excel/preview', authMiddleware, excelUpload.single('file'), (req, res) => {
  if (req.user.role !== 'DATA_ENCODER') {
    return res.status(403).json({ success: false, message: 'Data Encoder access required' });
  }

  if (!req.file) {
    return res.status(400).json({ success: false, message: 'Excel file is required' });
  }

  const fileName = req.file.originalname || 'upload.xlsx';
  const lower = fileName.toLowerCase();
  if (!lower.endsWith('.xlsx') && !lower.endsWith('.xls')) {
    return res.status(400).json({ success: false, message: 'Only .xlsx and .xls files are supported' });
  }

  try {
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer', cellDates: true });
    const firstSheetName = workbook.SheetNames[0];

    if (!firstSheetName) {
      return res.status(400).json({ success: false, message: 'No worksheet found in the uploaded file' });
    }

    const sheet = workbook.Sheets[firstSheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

    if (!rows.length) {
      return res.status(400).json({ success: false, message: 'Uploaded sheet is empty' });
    }

    const headers = rows[0].map((header) => String(header || '').trim().toLowerCase());
    const missingColumns = EXCEL_REQUIRED_COLUMNS.filter((required) => !headers.includes(required));

    if (missingColumns.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Missing required columns in Excel file',
        missingColumns
      });
    }

    const rowsByHeader = rows.slice(1).map((row) => {
      const mapped = {};
      headers.forEach((header, index) => {
        mapped[header] = row[index] ?? '';
      });
      return mapped;
    });

    const seenKeys = new Set();
    const preview = [];
    const errors = [];

    rowsByHeader.forEach((row, index) => {
      const line = index + 2;
      const firstName = String(row.first_name || '').trim();
      const middleName = String(row.middle_name || '').trim();
      const lastName = String(row.last_name || '').trim();
      const barangay = String(row.barangay || '').trim();
      const rsbsaNumber = String(row.rsbsa_number || '').trim();
      const birthdateRaw = row.birthdate;
      const lguIntervention = String(row.lgu_intervention || '').trim();
      const contactNumber = String(row.contact_number || '').trim();

      const rowIssues = [];

      if (!firstName) rowIssues.push('Missing first_name');
      if (!lastName) rowIssues.push('Missing last_name');
      if (!barangay) rowIssues.push('Missing barangay');
      if (barangay && !isValidBarangay(barangay)) rowIssues.push('Invalid barangay - must be one of the 16 official barangays');
      if (!birthdateRaw) rowIssues.push('Missing birthdate');
      if (!lguIntervention) rowIssues.push('Missing lgu_intervention');

      const parsedBirthdate = birthdateRaw ? new Date(birthdateRaw) : null;
      const age = parsedBirthdate ? calculateAgeFromBirthdate(parsedBirthdate.toISOString()) : null;

      if (parsedBirthdate && Number.isNaN(parsedBirthdate.getTime())) {
        rowIssues.push('Invalid birthdate value');
      }
      if (age != null && age < 18) {
        rowIssues.push('Beneficiary must be 18 years old or above');
      }

      const duplicateKey = rsbsaNumber || `${firstName.toLowerCase()}-${lastName.toLowerCase()}-${barangay.toLowerCase()}`;
      if (seenKeys.has(duplicateKey)) {
        rowIssues.push('Duplicate record within upload file');
      } else {
        seenKeys.add(duplicateKey);
      }

      if (rsbsaNumber) {
        const existing = db.prepare('SELECT id FROM beneficiaries WHERE rsbsa_number = ?').get(rsbsaNumber);
        if (existing) {
          rowIssues.push('Duplicate RSBSA number already exists in database');
        }
      }

      if (contactNumber && !/^09\d{2}-\d{3}-\d{4}$/.test(contactNumber)) {
        rowIssues.push('Invalid contact_number format (expected 09XX-XXX-XXXX)');
      }

      const normalized = {
        firstName,
        middleName,
        lastName,
        birthdate: parsedBirthdate && !Number.isNaN(parsedBirthdate.getTime())
          ? parsedBirthdate.toISOString().split('T')[0]
          : '',
        address: String(row.address || '').trim(),
        barangay,
        contactNumber,
        farmLocation: String(row.farm_location || '').trim(),
        cropType: String(row.crop_type || '').trim(),
        rsbsaNumber: rsbsaNumber || null,
        lguIntervention,
        interventionStatus: String(row.intervention_status || '').trim() || 'Unclaimed',
        interventionDate: String(row.intervention_date || '').trim() || new Date().toISOString().split('T')[0],
        household: String(row.household || '').trim() || '1 member'
      };

      if (rowIssues.length > 0) {
        errors.push({ line, issues: rowIssues, row: normalized });
      }

      preview.push({ line, ...normalized, issues: rowIssues });
    });

    const previewToken = randomUUID();
    excelPreviewStore.set(previewToken, {
      createdAt: Date.now(),
      userId: req.user.id,
      fileName,
      headers,
      preview
    });

    cleanupExpiredExcelPreviews();

    logAudit({
      userId: req.user.id,
      username: req.user.name,
      userRole: req.user.role,
      action: 'Previewed Excel Import',
      module: 'Data Encoder',
      recordType: 'excel_import',
      recordId: null,
      recordAffected: fileName,
      description: `Excel preview generated (${preview.length} rows, ${errors.length} rows with issues)`
    });

    res.json({
      success: true,
      message: 'Preview generated',
      previewToken,
      headers,
      preview,
      errors,
      summary: {
        totalRows: preview.length,
        validRows: preview.length - errors.length,
        errorRows: errors.length
      }
    });
  } catch (error) {
    console.error('Excel preview error:', error);
    res.status(400).json({ success: false, message: 'Unable to parse Excel file. Please verify file format and columns.' });
  }
});

app.post('/api/encoding/excel/confirm', authMiddleware, (req, res) => {
  if (req.user.role !== 'DATA_ENCODER') {
    return res.status(403).json({ success: false, message: 'Data Encoder access required' });
  }

  const { previewToken } = req.body || {};
  if (!previewToken) {
    return res.status(400).json({ success: false, message: 'previewToken is required' });
  }

  const cached = excelPreviewStore.get(previewToken);
  if (!cached || cached.userId !== req.user.id) {
    return res.status(404).json({ success: false, message: 'Preview session expired or not found' });
  }

  if (Date.now() - cached.createdAt > EXCEL_PREVIEW_TTL_MS) {
    excelPreviewStore.delete(previewToken);
    return res.status(410).json({ success: false, message: 'Preview session expired. Please upload again.' });
  }

  const validRows = cached.preview.filter((row) => !row.issues || row.issues.length === 0);
  if (validRows.length === 0) {
    return res.status(400).json({ success: false, message: 'No valid rows to import. Fix errors and upload again.' });
  }

  const insertBeneficiary = db.prepare(`
    INSERT INTO beneficiaries (
      first_name, middle_name, last_name, name, rsbsa_number, birthdate, age, address, barangay,
      contact_number, farm_location, crop_type, household, created_by, updated_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertIntervention = db.prepare(`
    INSERT INTO interventions (beneficiary_id, intervention_type, intervention_name, status, intervention_date)
    VALUES (?, 'LGU', ?, ?, ?)
  `);

  let imported = 0;
  const skipped = [];

  const tx = db.transaction(() => {
    for (const row of validRows) {
      if (row.rsbsaNumber) {
        const exists = db.prepare('SELECT id FROM beneficiaries WHERE rsbsa_number = ?').get(row.rsbsaNumber);
        if (exists) {
          skipped.push({ line: row.line, reason: 'Duplicate RSBSA number already exists' });
          continue;
        }
      }

      const age = calculateAgeFromBirthdate(row.birthdate);
      if (age == null || age < 18) {
        skipped.push({ line: row.line, reason: 'Invalid age / birthdate' });
        continue;
      }

      const fullName = `${row.firstName} ${row.middleName || ''} ${row.lastName}`.trim();
      const result = insertBeneficiary.run(
        row.firstName,
        row.middleName,
        row.lastName,
        fullName,
        row.rsbsaNumber,
        row.birthdate,
        age,
        row.address,
        row.barangay,
        row.contactNumber,
        row.farmLocation,
        row.cropType,
        row.household,
        req.user.id,
        req.user.id
      );

      insertIntervention.run(
        result.lastInsertRowid,
        row.lguIntervention,
        row.interventionStatus || 'Unclaimed',
        row.interventionDate || new Date().toISOString().split('T')[0]
      );

      imported++;
    }
  });

  try {
    tx();
    excelPreviewStore.delete(previewToken);

    logAudit({
      userId: req.user.id,
      username: req.user.name,
      userRole: req.user.role,
      action: 'Confirmed Excel Import',
      module: 'Data Encoder',
      recordType: 'excel_import',
      recordId: null,
      recordAffected: cached.fileName,
      description: `Imported ${imported} row(s) from Excel (${skipped.length} skipped)`
    });

    res.json({
      success: true,
      message: 'Excel import completed',
      imported,
      skipped
    });
  } catch (error) {
    console.error('Excel confirm import error:', error);
    res.status(500).json({ success: false, message: 'Failed to import Excel rows' });
  }
});

// Ensure API misses still return JSON instead of HTML/text responses.
app.use('/api', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'API endpoint not found'
  });
});

app.use((err, req, res, next) => {
  console.error('Unhandled server error:', err);
  if (req.path.startsWith('/api')) {
    return res.status(500).json({
      success: false,
      message: 'Server error. Please try again.'
    });
  }
  return next(err);
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

// Keep the process alive
setInterval(() => {
  cleanupExpiredExcelPreviews();
}, 1000);
