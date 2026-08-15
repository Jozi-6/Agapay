import express from 'express';
import cors from 'cors';
import bcrypt from 'bcrypt';
import multer from 'multer';
import db from './database.js';



import { generateToken, authMiddleware } from './auth.js';
import { logAudit, getAuditLogs, getAuditActions } from './auditLogger.js';
import { getReportFilters, getReportRecords, generateCsv, generateExcel, generatePdf } from './reportExporter.js';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Login endpoint
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }
  
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  
  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  
  const passwordMatch = await bcrypt.compare(password, user.password);
  
  if (!passwordMatch) {
    return res.status(401).json({ error: 'Invalid credentials' });
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
  
  res.json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role
    },
    token
  });
});

// Verify token endpoint
app.get('/api/verify', authMiddleware, (req, res) => {
  res.json({ user: req.user });
});

// Register endpoint (for development - note: this allows any role, should be restricted in production)
app.post('/api/register', async (req, res) => {
  const { email, password, name, role } = req.body;
  
  if (!email || !password || !name || !role) {
    return res.status(400).json({ error: 'All fields are required' });
  }
  
  const validRoles = ['ADMIN', 'AGRICULTURAL_TECHNOLOGIST', 'DATA_ENCODER'];
  if (!validRoles.includes(role)) {
    return res.status(400).json({ error: 'Invalid role' });
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
      return res.status(400).json({ error: 'Email already exists' });
    }
    res.status(500).json({ error: 'Registration failed' });
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
  
  const uniqueBarangays = [...new Set(allDABeneficiaries.map(b => b.barangay))].sort();
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
      barangays: uniqueBarangays,
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
  
  const uniqueBarangays = [...new Set(allLGUBeneficiaries.map(b => b.barangay))].sort();
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
      barangays: uniqueBarangays,
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
  const barangays = [...new Set(allReports.map(r => r.barangay))].sort();
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
  const allBarangays = db.prepare('SELECT DISTINCT barangay FROM beneficiaries ORDER BY barangay').all();
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
      barangays: allBarangays.map((b) => b.barangay),
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

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

// Keep the process alive
setInterval(() => {
  // Heartbeat to keep process alive
}, 1000);
