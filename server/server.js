import express from 'express';
import cors from 'cors';
import bcrypt from 'bcrypt';
import multer from 'multer';
import XLSX from 'xlsx';
import { randomUUID } from 'crypto';
import db from './database.js';
import { OFFICIAL_BARANGAYS, isValidBarangay, getBarangayValidationError } from './constants.js';
import { DA_INTERVENTIONS, MLGU_INTERVENTIONS, INTERVENTION_SOURCES, isValidInterventionForSource } from './interventions.js';

import { generateToken, createAuthMiddleware, requireRole, requireAdmin, requireAgritech, requireDataEncoder } from './auth.js';

// Create auth middleware with db instance
const authMiddleware = createAuthMiddleware(db);
import { logAudit, getAuditLogs, getAuditActions } from './auditLogger.js';
import { getReportFilters, getReportRecords, generateCsv, generateExcel, generatePdf } from './reportExporter.js';

const app = express();
const PORT = process.env.PORT || 3001;

const allowedOrigins = process.env.ALLOWED_ORIGINS 
  ? process.env.ALLOWED_ORIGINS.split(',') 
  : ['http://localhost:5173', 'http://127.0.0.1:5173', 'https://jozi-6.github.io'];

app.use(cors({
  origin: allowedOrigins,
  credentials: true
}));
app.use(express.json());

// RSBSA Disclaimer for UI usage
const RSBSA_DISCLAIMER = "RSBSA information maintained by OMAG for local administrative purposes.";

const EXCEL_IMPORT_TYPES = {
  BENEFICIARY: 'beneficiary',
  CRISIS_REPORT: 'crisis_report'
};

const EXCEL_IMPORT_SCHEMAS = {
  [EXCEL_IMPORT_TYPES.BENEFICIARY]: {
    label: 'Beneficiary Records',
    aliases: {
      first_name: ['first_name', 'first name'],
      last_name: ['last_name', 'last name'],
      barangay: ['barangay'],
      birthdate: ['birthdate'],
      lgu_intervention: ['lgu_intervention', 'lgu intervention', 'intervention']
    }
  },
  [EXCEL_IMPORT_TYPES.CRISIS_REPORT]: {
    label: 'Crisis Reports',
    aliases: {
      crisis_type: ['crisis_type', 'crisis type', 'crisis', 'type'],
      barangay: ['barangay'],
      farmer_name: ['farmer_name', 'farmer name', 'beneficiary_name', 'beneficiary name', 'beneficiary', 'farmer']
    }
  }
};

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

function normalizeExcelHeader(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function getImportTypeFromRequest(req) {
  const rawType = String(req.body?.importType || req.body?.type || req.query?.importType || req.query?.type || EXCEL_IMPORT_TYPES.BENEFICIARY).trim().toLowerCase();
  return rawType === 'crisis_report' || rawType === 'crisis-reports' || rawType === 'crisis reports' ? EXCEL_IMPORT_TYPES.CRISIS_REPORT : EXCEL_IMPORT_TYPES.BENEFICIARY;
}

function getMatchingHeader(headers, aliases) {
  const normalizedHeaders = new Set(headers.map(normalizeExcelHeader));
  for (const candidate of aliases) {
    const normalizedCandidate = normalizeExcelHeader(candidate);
    if (normalizedHeaders.has(normalizedCandidate)) {
      return candidate;
    }
  }
  return null;
}

function getExcelSchemaForImportType(importType) {
  return EXCEL_IMPORT_SCHEMAS[importType] || EXCEL_IMPORT_SCHEMAS[EXCEL_IMPORT_TYPES.BENEFICIARY];
}

function getExcelRowValue(row, aliases) {
  const normalizedRow = {};
  Object.keys(row || {}).forEach((key) => {
    normalizedRow[normalizeExcelHeader(key)] = row[key];
  });

  for (const alias of aliases) {
    const normalizedAlias = normalizeExcelHeader(alias);
    if (normalizedRow[normalizedAlias] !== undefined) {
      return normalizedRow[normalizedAlias];
    }
  }

  return '';
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

    // Check if user account is approved
    if (user.status !== 'approved') {
      return res.status(403).json({
        success: false,
        message: user.status === 'rejected' 
          ? 'Your account has been rejected. Please contact the administrator.' 
          : 'Your account is pending approval. Please wait for the administrator to approve your account.'
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

// Register endpoint (public signup - creates pending user)
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
  
  // Check if email already exists
  const existingUser = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase());
  if (existingUser) {
    return res.status(400).json({
      success: false,
      message: 'Email already registered'
    });
  }
  
  const saltRounds = 10;
  const hashedPassword = bcrypt.hashSync(password, saltRounds);
  
  try {
    const result = db.prepare(`
      INSERT INTO users (email, password, name, role, status) 
      VALUES (?, ?, ?, ?, 'pending')
    `).run(email.toLowerCase(), hashedPassword, name, role);
    
    const newUser = db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid);
    
    return res.json({
      success: true,
      message: 'Registration successful. Please wait for administrator approval.',
      user: {
        id: newUser.id,
        email: newUser.email,
        name: newUser.name,
        role: newUser.role,
        status: newUser.status
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    return res.status(500).json({
      success: false,
      message: 'Registration failed'
    });
  }
});

// Get pending users (admin only)
app.get('/api/admin/pending-users', authMiddleware, requireAdmin, (req, res) => {
  const pendingUsers = db.prepare(`
    SELECT id, email, name, role, created_at 
    FROM users 
    WHERE status = 'pending'
    ORDER BY created_at DESC
  `).all();
  
  res.json({
    success: true,
    pendingUsers
  });
});

// Approve user (admin only)
app.post('/api/admin/approve-user/:id', authMiddleware, requireAdmin, (req, res) => {
  const { id } = req.params;
  
  try {
    db.prepare(`
      UPDATE users 
      SET status = 'approved', approved_by = ?, approved_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(req.user.id, id);
    
    logAudit({
      userId: req.user.id,
      username: req.user.name,
      userRole: req.user.role,
      action: 'Approved User',
      module: 'User Management',
      recordType: 'user',
      recordId: id,
      description: `Approved user account with ID ${id}`
    });
    
    res.json({
      success: true,
      message: 'User approved successfully'
    });
  } catch (error) {
    console.error('User approval error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to approve user'
    });
  }
});

// Reject user (admin only)
app.post('/api/admin/reject-user/:id', authMiddleware, requireAdmin, (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;
  
  try {
    db.prepare(`
      UPDATE users 
      SET status = 'rejected', rejection_reason = ?
      WHERE id = ?
    `).run(reason || 'No reason provided', id);
    
    logAudit({
      userId: req.user.id,
      username: req.user.name,
      userRole: req.user.role,
      action: 'Rejected User',
      module: 'User Management',
      recordType: 'user',
      recordId: id,
      description: `Rejected user account with ID ${id}: ${reason || 'No reason provided'}`
    });
    
    res.json({
      success: true,
      message: 'User rejected successfully'
    });
  } catch (error) {
    console.error('User rejection error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reject user'
    });
  }
});

// Get all users (admin only)
app.get('/api/admin/users', authMiddleware, requireAdmin, (req, res) => {
  const users = db.prepare(`
    SELECT id, email, name, role, status, created_at, approved_at, rejection_reason
    FROM users
    ORDER BY created_at DESC
  `).all();
  
  res.json({
    success: true,
    users
  });
});

// Create user directly (admin only)
app.post('/api/admin/users', authMiddleware, requireAdmin, async (req, res) => {
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
  
  // Check if email already exists
  const existingUser = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase());
  if (existingUser) {
    return res.status(400).json({
      success: false,
      message: 'Email already registered'
    });
  }
  
  const saltRounds = 10;
  const hashedPassword = bcrypt.hashSync(password, saltRounds);
  
  try {
    const result = db.prepare(`
      INSERT INTO users (email, password, name, role, status, approved_by, approved_at) 
      VALUES (?, ?, ?, ?, 'approved', ?, CURRENT_TIMESTAMP)
    `).run(email.toLowerCase(), hashedPassword, name, role, req.user.id);
    
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid);
    
    logAudit({
      userId: req.user.id,
      username: req.user.name,
      userRole: req.user.role,
      action: 'Created User',
      module: 'User Management',
      recordType: 'user',
      recordId: user.id,
      recordAffected: user.email,
      description: `Created new ${role.replace('_', ' ')} account`
    });
    
    res.json({
      success: true,
      message: 'User created successfully',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        status: user.status
      }
    });
  } catch (error) {
    console.error('User creation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create user'
    });
  }
});

// Dashboard statistics endpoint
app.get('/api/admin/statistics', authMiddleware, requireAdmin, (req, res) => {
  const totalBeneficiaries = db.prepare('SELECT COUNT(*) as count FROM beneficiaries').get();
  const daBeneficiaries = db.prepare("SELECT COUNT(*) as count FROM beneficiaries b JOIN interventions i ON b.id = i.beneficiary_id WHERE i.intervention_type = 'DA'").get();
  const mlguBeneficiaries = db.prepare("SELECT COUNT(*) as count FROM beneficiaries b JOIN interventions i ON b.id = i.beneficiary_id WHERE i.intervention_type = 'LGU'").get();
  const claimedCount = db.prepare("SELECT COUNT(*) as count FROM interventions WHERE status = 'Claimed'").get();
  const unclaimedCount = db.prepare("SELECT COUNT(*) as count FROM interventions WHERE status = 'Unclaimed'").get();
  const daInterventions = db.prepare("SELECT COUNT(*) as count FROM interventions WHERE intervention_type = 'DA'").get();
  const mlguInterventions = db.prepare("SELECT COUNT(*) as count FROM interventions WHERE intervention_type = 'LGU'").get();
  const crisisReports = db.prepare('SELECT COUNT(*) as count FROM crisis_reports').get();

  res.json({
    totalBeneficiaries: totalBeneficiaries.count,
    daBeneficiaries: daBeneficiaries.count,
    mlguBeneficiaries: mlguBeneficiaries.count,
    claimed: claimedCount.count,
    unclaimed: unclaimedCount.count,
    daInterventions: daInterventions.count,
    mlguInterventions: mlguInterventions.count,
    crisisReports: crisisReports.count
  });
});

// Beneficiaries search endpoint with pagination and filtering
app.get('/api/admin/beneficiaries', authMiddleware, requireAdmin, (req, res) => {
  const { 
    search = '', 
    barangay = 'All', 
    interventionType = 'All', 
    status = 'All',
    page = 1,
    limit = 50
  } = req.query;
  
  const offset = (parseInt(page) - 1) * parseInt(limit);
  const limitNum = parseInt(limit);
  
  let query = `
    SELECT DISTINCT 
      b.id, b.name, b.rsbsa_number, b.barangay, b.address, b.contact_number,
      i.intervention_type, i.intervention_name, i.custom_intervention_name, i.status, i.quantity_received
    FROM beneficiaries b
    LEFT JOIN interventions i ON b.id = i.beneficiary_id
    WHERE 1=1
  `;
  
  const params = [];
  
  // Search by name, RSBSA, or barangay
  if (search) {
    query += ` AND (b.name LIKE ? OR b.rsbsa_number LIKE ? OR b.barangay LIKE ?)`;
    const searchPattern = `%${search}%`;
    params.push(searchPattern, searchPattern, searchPattern);
  }
  
  // Filter by barangay
  if (barangay !== 'All') {
    query += ` AND b.barangay = ?`;
    params.push(barangay);
  }
  
  // Filter by intervention type
  if (interventionType !== 'All') {
    query += ` AND i.intervention_type = ?`;
    params.push(interventionType);
  }
  
  // Filter by status
  if (status !== 'All') {
    query += ` AND i.status = ?`;
    params.push(status);
  }
  
  // Get total count
  const countQuery = query.replace('SELECT DISTINCT b.id, b.name, b.rsbsa_number, b.barangay, b.address, b.contact_number, i.intervention_type, i.intervention_name, i.custom_intervention_name, i.status, i.quantity_received', 'SELECT COUNT(DISTINCT b.id)');
  const totalCount = db.prepare(countQuery).get(...params);
  
  // Add pagination
  query += ` ORDER BY b.created_at DESC LIMIT ? OFFSET ?`;
  params.push(limitNum, offset);
  
  const beneficiaries = db.prepare(query).all(...params);
  
  // Format intervention display name and RSBSA display
  const formattedBeneficiaries = beneficiaries.map(b => ({
    ...b,
    intervention: b.custom_intervention_name || b.intervention_name || 'None',
    rsbsaNumber: b.intervention_type === 'DA' ? (b.rsbsa_number || 'N/A') : 'N/A',
    quantityReceived: b.quantity_received || null
  }));
  
  res.json({
    beneficiaries: formattedBeneficiaries,
    pagination: {
      total: totalCount.count,
      page: parseInt(page),
      limit: limitNum,
      totalPages: Math.ceil(totalCount.count / limitNum)
    }
  });
});

// DA Interventions endpoint with pagination and filtering
app.get('/api/admin/da-interventions', authMiddleware, requireAdmin, (req, res) => {
  const { 
    search = '', 
    rsbsa = '',
    barangay = 'All', 
    status = 'All',
    intervention = '',
    page = 1,
    limit = 50
  } = req.query;
  
  const offset = (parseInt(page) - 1) * parseInt(limit);
  const limitNum = parseInt(limit);

  const countParams = [];
  let countQuery = `
    SELECT COUNT(DISTINCT b.id) AS count
    FROM beneficiaries b
    JOIN interventions i ON b.id = i.beneficiary_id
    WHERE i.intervention_type = 'DA'
  `;

  if (search) {
    const searchTerm = `%${search}%`;
    countQuery += ' AND (b.name LIKE ? OR b.rsbsa_number LIKE ?)';
    countParams.push(searchTerm, searchTerm);
  }

  if (rsbsa) {
    const rsbsaTerm = `%${rsbsa}%`;
    countQuery += ' AND b.rsbsa_number LIKE ?';
    countParams.push(rsbsaTerm);
  }
  
  if (barangay !== 'All') {
    countQuery += ' AND b.barangay = ?';
    countParams.push(barangay);
  }
  
  if (status !== 'All') {
    countQuery += ' AND i.status = ?';
    countParams.push(status);
  }

  if (intervention) {
    countQuery += ' AND (i.intervention_name = ? OR i.custom_intervention_name = ?)';
    countParams.push(intervention, intervention);
  }

  const totalCount = db.prepare(countQuery).get(...countParams) || { count: 0 };

  const queryParams = [];
  let query = `
    SELECT DISTINCT 
      b.id, b.name, b.rsbsa_number, b.barangay, 
      i.intervention_name, i.custom_intervention_name, i.status, i.quantity_received, i.intervention_date
    FROM beneficiaries b
    JOIN interventions i ON b.id = i.beneficiary_id
    WHERE i.intervention_type = 'DA'
  `;

  if (search) {
    const searchTerm = `%${search}%`;
    query += ' AND (b.name LIKE ? OR b.rsbsa_number LIKE ?)';
    queryParams.push(searchTerm, searchTerm);
  }

  if (rsbsa) {
    const rsbsaTerm = `%${rsbsa}%`;
    query += ' AND b.rsbsa_number LIKE ?';
    queryParams.push(rsbsaTerm);
  }
  
  if (barangay !== 'All') {
    query += ' AND b.barangay = ?';
    queryParams.push(barangay);
  }
  
  if (status !== 'All') {
    query += ' AND i.status = ?';
    queryParams.push(status);
  }

  if (intervention) {
    query += ' AND (i.intervention_name = ? OR i.custom_intervention_name = ?)';
    queryParams.push(intervention, intervention);
  }
  
  // Add pagination
  query += ` ORDER BY i.created_at DESC LIMIT ? OFFSET ?`;
  queryParams.push(limitNum, offset);

  const beneficiaries = db.prepare(query).all(...queryParams);
  
  const formattedBeneficiaries = beneficiaries.map(b => ({
    ...b,
    intervention: b.custom_intervention_name || b.intervention_name,
    rsbsaNumber: b.rsbsa_number || 'N/A',
    quantityReceived: b.quantity_received || null
  }));

  res.json({
    beneficiaries: formattedBeneficiaries,
    pagination: {
      total: totalCount.count,
      page: parseInt(page),
      limit: limitNum,
      totalPages: Math.ceil(totalCount.count / limitNum)
    }
  });
});

// LGU Interventions endpoint with pagination and filtering
app.get('/api/admin/lgu-interventions', authMiddleware, requireAdmin, (req, res) => {
  const { 
    search = '', 
    rsbsa = '',
    barangay = 'All', 
    status = 'All',
    intervention = '',
    page = 1,
    limit = 50
  } = req.query;
  
  const offset = (parseInt(page) - 1) * parseInt(limit);
  const limitNum = parseInt(limit);

  const countParams = [];
  let countQuery = `
    SELECT COUNT(DISTINCT b.id) AS count
    FROM beneficiaries b
    JOIN interventions i ON b.id = i.beneficiary_id
    WHERE i.intervention_type = 'LGU'
  `;

  if (search) {
    const searchTerm = `%${search}%`;
    countQuery += ' AND (b.name LIKE ? OR b.barangay LIKE ?)';
    countParams.push(searchTerm, searchTerm);
  }

  if (rsbsa) {
    const rsbsaTerm = `%${rsbsa}%`;
    countQuery += ' AND b.rsbsa_number LIKE ?';
    countParams.push(rsbsaTerm);
  }
  
  if (barangay !== 'All') {
    countQuery += ' AND b.barangay = ?';
    countParams.push(barangay);
  }
  
  if (status !== 'All') {
    countQuery += ' AND i.status = ?';
    countParams.push(status);
  }

  if (intervention) {
    countQuery += ' AND (i.intervention_name = ? OR i.custom_intervention_name = ?)';
    countParams.push(intervention, intervention);
  }

  const totalCount = db.prepare(countQuery).get(...countParams) || { count: 0 };

  const queryParams = [];
  let query = `
    SELECT DISTINCT 
      b.id, b.name, b.rsbsa_number, b.barangay, 
      i.intervention_name, i.custom_intervention_name, i.status, i.quantity_received, i.intervention_date
    FROM beneficiaries b
    JOIN interventions i ON b.id = i.beneficiary_id
    WHERE i.intervention_type = 'LGU'
  `;

  if (search) {
    const searchTerm = `%${search}%`;
    query += ' AND (b.name LIKE ? OR b.barangay LIKE ?)';
    queryParams.push(searchTerm, searchTerm);
  }

  if (rsbsa) {
    const rsbsaTerm = `%${rsbsa}%`;
    query += ' AND b.rsbsa_number LIKE ?';
    queryParams.push(rsbsaTerm);
  }
  
  if (barangay !== 'All') {
    query += ' AND b.barangay = ?';
    queryParams.push(barangay);
  }
  
  if (status !== 'All') {
    query += ' AND i.status = ?';
    queryParams.push(status);
  }

  if (intervention) {
    query += ' AND (i.intervention_name = ? OR i.custom_intervention_name = ?)';
    queryParams.push(intervention, intervention);
  }
  
  // Add pagination
  query += ` ORDER BY i.created_at DESC LIMIT ? OFFSET ?`;
  queryParams.push(limitNum, offset);

  const beneficiaries = db.prepare(query).all(...queryParams);
  
  const formattedBeneficiaries = beneficiaries.map(b => ({
    ...b,
    intervention: b.custom_intervention_name || b.intervention_name,
    rsbsaNumber: 'N/A',
    quantityReceived: b.quantity_received || null
  }));

  res.json({
    beneficiaries: formattedBeneficiaries,
    pagination: {
      total: totalCount.count,
      page: parseInt(page),
      limit: limitNum,
      totalPages: Math.ceil(totalCount.count / limitNum)
    }
  });
});

// Get all available interventions
app.get('/api/admin/interventions-list', authMiddleware, requireAdmin, (req, res) => {
  if (req.user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  const interventionType = req.query.type || 'LGU'; // Default to LGU
  
  // Return predefined interventions based on type
  let interventions;
  if (interventionType === 'DA') {
    interventions = DA_INTERVENTIONS;
  } else if (interventionType === 'LGU') {
    interventions = MLGU_INTERVENTIONS;
  } else {
    interventions = [];
  }

  res.json({
    interventions: interventions
  });
});

// Add new beneficiary with intervention
app.post('/api/admin/add-beneficiary', authMiddleware, requireAdmin, async (req, res) => {
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
    beneficiaryType,
    lguIntervention,
    interventionStatus,
    interventionDate
  } = req.body;

  let interventionType = 'LGU';
  if (DA_INTERVENTIONS.includes(lguIntervention)) {
    interventionType = 'DA';
  } else if (MLGU_INTERVENTIONS.includes(lguIntervention)) {
    interventionType = 'LGU';
  }

  const normalizedBeneficiaryType = (beneficiaryType || interventionType || 'LGU').toUpperCase();
  if (!['DA', 'LGU'].includes(normalizedBeneficiaryType)) {
    return res.status(400).json({ error: 'Invalid beneficiary type' });
  }

  if (normalizedBeneficiaryType === 'DA' && (!rsbsaNumber || !String(rsbsaNumber).trim())) {
    return res.status(400).json({ error: 'RSBSA Number is required for DA beneficiaries.' });
  }

  if (!firstName || !lastName || !birthdate || !barangay || !lguIntervention) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  if (!isValidBarangay(barangay)) {
    return res.status(400).json({ error: getBarangayValidationError() });
  }

  const birthDateObj = new Date(birthdate);
  const today = new Date();
  let age = today.getFullYear() - birthDateObj.getFullYear();
  const monthDiff = today.getMonth() - birthDateObj.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDateObj.getDate())) {
    age--;
  }

  if (age < 18) {
    return res.status(400).json({ error: 'Beneficiary must be 18 years old or above' });
  }

  let beneficiary = null;
  if (rsbsaNumber) {
    beneficiary = db.prepare('SELECT * FROM beneficiaries WHERE rsbsa_number = ?').get(rsbsaNumber);
  }

  try {
    let beneficiaryId;

    if (beneficiary) {
      beneficiaryId = beneficiary.id;
      db.prepare(`
        UPDATE beneficiaries
        SET address = ?, contact_number = ?, farm_location = ?, crop_type = ?, beneficiary_type = ?, rsbsa_number = COALESCE(?, rsbsa_number)
        WHERE id = ?
      `).run(address, contactNumber, farmLocation, cropType, normalizedBeneficiaryType, rsbsaNumber || null, beneficiaryId);
    } else {
      const fullName = `${firstName} ${middleName || ''} ${lastName}`.trim();
      const result = db.prepare(`
        INSERT INTO beneficiaries (first_name, middle_name, last_name, name, beneficiary_type, rsbsa_number, birthdate, age, address, barangay, contact_number, farm_location, crop_type, household)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        firstName,
        middleName,
        lastName,
        fullName,
        normalizedBeneficiaryType,
        rsbsaNumber || null,
        birthdate,
        age,
        address,
        barangay,
        contactNumber,
        farmLocation,
        cropType,
        '1 member'
      );
      beneficiaryId = result.lastInsertRowid;
    }

    const existingIntervention = db.prepare(`
      SELECT * FROM interventions
      WHERE beneficiary_id = ? AND intervention_type = ? AND intervention_name = ?
    `).get(beneficiaryId, interventionType, lguIntervention);

    if (!existingIntervention) {
      db.prepare(`
        INSERT INTO interventions (beneficiary_id, intervention_type, intervention_name, status, intervention_date)
        VALUES (?, ?, ?, ?, ?)
      `).run(
        beneficiaryId,
        interventionType,
        lguIntervention,
        interventionStatus || 'Unclaimed',
        interventionDate || new Date().toISOString().split('T')[0]
      );
    } else {
      return res.status(400).json({ error: `This beneficiary already has this ${interventionType} intervention` });
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
      beneficiaryId
    });
  } catch (error) {
    console.error('Error adding beneficiary:', error);
    res.status(500).json({ error: 'Failed to add beneficiary' });
  }
});

// Get all crisis reports with filtering
app.get('/api/admin/crisis-reports', authMiddleware, requireAdmin, (req, res) => {
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
      farmerName: r.beneficiary_name,
      crisisType: r.crisis_type,
      disaster: r.crisis_type,
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
      createdAt: r.created_at,
      latitude: r.latitude,
      longitude: r.longitude,
      photos: (() => {
        if (!r.photos) return [];
        try {
          return JSON.parse(r.photos);
        } catch {
          return [];
        }
      })()
    })),
    filters: {
      crisisTypes,
      barangays,
      statuses
    }
  });
});

// Get crisis report summary statistics
app.get('/api/admin/crisis-reports/summary', authMiddleware, requireAdmin, (req, res) => {
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
app.post('/api/admin/crisis-reports', authMiddleware, requireAdmin, (req, res) => {
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
app.put('/api/admin/crisis-reports/:id/validate', authMiddleware, requireAdmin, (req, res) => {
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
app.get('/api/agritech/beneficiaries', authMiddleware, requireAgritech, (req, res) => {
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
app.put('/api/agritech/beneficiaries/:id/validate', authMiddleware, requireAgritech, (req, res) => {
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
app.put('/api/agritech/beneficiaries/:id/reject', authMiddleware, requireAgritech, (req, res) => {
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
app.get('/api/agritech/interventions', authMiddleware, requireAgritech, (req, res) => {
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

const handleAgritechCrisisReportList = (req, res) => {
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
};

const handleAgritechCrisisReportCreate = (req, res) => {
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
    estimatedCost,
    latitude,
    longitude
  } = req.body;

  if (!disaster || !barangay || !farmerName || !latitude || !longitude) {
    return res.status(400).json({ error: 'Missing required fields (farmer name, barangay, GPS coordinates)' });
  }

  if (!isValidBarangay(barangay)) {
    return res.status(400).json({ error: getBarangayValidationError() });
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
      const result = db.prepare(`
        INSERT INTO beneficiaries (first_name, last_name, name, rsbsa_number, barangay, farm_location, crop_type, household, created_by, updated_by)
        VALUES (?, ?, ?, NULL, ?, ?, ?, ?, ?, ?)
      `).run(
        farmerName.trim().split(' ')[0] || 'Unknown',
        farmerName.trim().split(' ').slice(1).join(' ') || farmerName.trim(),
        farmerName.trim(),
        barangay,
        farmLocation || null,
        cropType || null,
        '1 member',
        req.user.id,
        req.user.id
      );
      beneficiary = db.prepare('SELECT * FROM beneficiaries WHERE id = ?').get(result.lastInsertRowid);
    }

    const photoNames = (req.files || []).map((file) => file.originalname);

    const result = db.prepare(`
      INSERT INTO crisis_reports (
        beneficiary_id, crisis_type, crisis_date, barangay, farm_location, crop_type, crop_stage,
        total_area_hectares, damaged_area_hectares, production_loss_mt, estimated_damage_cost, latitude, longitude, photos, remarks, created_by
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
      null,
      estimatedCost ? parseFloat(estimatedCost) : null,
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
      action: 'Filed Crisis Report',
      module: 'Crisis Reports',
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
};

app.post('/api/agritech/crisis-reports', authMiddleware, requireAgritech, upload.array('photos', 5), handleAgritechCrisisReportCreate);
app.post('/api/agritech/damage-reports', authMiddleware, requireAgritech, upload.array('photos', 5), handleAgritechCrisisReportCreate);
app.get('/api/agritech/crisis-reports', authMiddleware, requireAgritech, handleAgritechCrisisReportList);
app.get('/api/agritech/damage-reports', authMiddleware, requireAgritech, handleAgritechCrisisReportList);

// Audit Trail endpoints - Admin only
app.get('/api/admin/audit-trail', authMiddleware, requireAdmin, (req, res) => {
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
app.get('/api/admin/reports/filters', authMiddleware, requireAdmin, (req, res) => {
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
app.get('/api/admin/reports/generate', authMiddleware, requireAdmin, async (req, res) => {
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
app.get('/api/encoding/statistics', authMiddleware, requireDataEncoder, (req, res) => {
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

app.get('/api/encoding/pending', authMiddleware, requireDataEncoder, (req, res) => {
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

app.get('/api/inventory/low-stock', authMiddleware, requireDataEncoder, (req, res) => {
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

app.get('/api/dashboard/data-encoder', authMiddleware, requireDataEncoder, (req, res) => {
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
app.get('/api/data-encoder/interventions-list', authMiddleware, requireDataEncoder, (req, res) => {
  if (req.user.role !== 'DATA_ENCODER') {
    return res.status(403).json({ success: false, message: 'Data Encoder access required' });
  }

  const interventionType = req.query.type || 'LGU';
  
  // Return predefined interventions based on type
  let interventions;
  if (interventionType === 'DA') {
    interventions = DA_INTERVENTIONS;
  } else if (interventionType === 'LGU') {
    interventions = MLGU_INTERVENTIONS;
  } else {
    interventions = [];
  }

  res.json({ success: true, interventions: interventions });
});

// Data Encoder beneficiaries endpoint with pagination and filtering
app.get('/api/data-encoder/beneficiaries', authMiddleware, requireDataEncoder, (req, res) => {
  const { 
    search = '', 
    barangay = 'All', 
    interventionType = 'All', 
    status = 'All',
    page = 1,
    limit = 50
  } = req.query;
  
  const offset = (parseInt(page) - 1) * parseInt(limit);
  const limitNum = parseInt(limit);
  
  let query = `
    SELECT DISTINCT 
      b.id, b.name, b.rsbsa_number, b.barangay, b.address, b.contact_number,
      i.intervention_type, i.intervention_name, i.custom_intervention_name, i.status, i.quantity_received
    FROM beneficiaries b
    LEFT JOIN interventions i ON b.id = i.beneficiary_id
    WHERE 1=1
  `;
  
  const params = [];
  
  // Search by name, RSBSA, or barangay
  if (search) {
    query += ` AND (b.name LIKE ? OR b.rsbsa_number LIKE ? OR b.barangay LIKE ?)`;
    const searchPattern = `%${search}%`;
    params.push(searchPattern, searchPattern, searchPattern);
  }
  
  // Filter by barangay
  if (barangay !== 'All') {
    query += ` AND b.barangay = ?`;
    params.push(barangay);
  }
  
  // Filter by intervention type
  if (interventionType !== 'All') {
    query += ` AND i.intervention_type = ?`;
    params.push(interventionType);
  }
  
  // Filter by status
  if (status !== 'All') {
    query += ` AND i.status = ?`;
    params.push(status);
  }
  
  // Get total count
  const countQuery = query.replace('SELECT DISTINCT b.id, b.name, b.rsbsa_number, b.barangay, b.address, b.contact_number, i.intervention_type, i.intervention_name, i.custom_intervention_name, i.status, i.quantity_received', 'SELECT COUNT(DISTINCT b.id)');
  const totalCount = db.prepare(countQuery).get(...params);
  
  // Add pagination
  query += ` ORDER BY b.created_at DESC LIMIT ? OFFSET ?`;
  params.push(limitNum, offset);
  
  const beneficiaries = db.prepare(query).all(...params);
  
  // Format intervention display name and RSBSA display
  const formattedBeneficiaries = beneficiaries.map(b => ({
    ...b,
    intervention: b.custom_intervention_name || b.intervention_name || 'None',
    rsbsaNumber: b.intervention_type === 'DA' ? (b.rsbsa_number || 'N/A') : 'N/A',
    quantityReceived: b.quantity_received || null
  }));
  
  res.json({
    beneficiaries: formattedBeneficiaries,
    pagination: {
      total: totalCount.count,
      page: parseInt(page),
      limit: limitNum,
      totalPages: Math.ceil(totalCount.count / limitNum)
    }
  });
});

// Update beneficiary intervention status endpoint
app.put('/api/data-encoder/beneficiaries/:id/intervention', authMiddleware, requireDataEncoder, (req, res) => {
  const { id } = req.params;
  const { status, customInterventionName, quantityReceived } = req.body;
  
  try {
    // Get current intervention record
    const currentIntervention = db.prepare(`
      SELECT * FROM interventions 
      WHERE beneficiary_id = ? 
      ORDER BY created_at DESC 
      LIMIT 1
    `).get(id);
    
    if (!currentIntervention) {
      return res.status(404).json({ error: 'Intervention not found' });
    }
    
    // Update intervention
    const updateFields = [];
    const updateParams = [];
    
    if (status) {
      updateFields.push('status = ?');
      updateParams.push(status);
    }
    
    if (customInterventionName !== undefined) {
      updateFields.push('custom_intervention_name = ?');
      updateParams.push(customInterventionName);
    }
    
    if (quantityReceived !== undefined) {
      updateFields.push('quantity_received = ?');
      updateParams.push(quantityReceived);
    }
    
    if (updateFields.length > 0) {
      updateParams.push(id);
      db.prepare(`
        UPDATE interventions 
        SET ${updateFields.join(', ')}
        WHERE id = ?
      `).run(...updateParams);
    }
    
    logAudit({
      userId: req.user.id,
      username: req.user.name,
      userRole: req.user.role,
      action: 'Updated Intervention Status',
      module: 'Data Encoder',
      recordType: 'intervention',
      recordId: currentIntervention.id,
      description: `Updated beneficiary ${id} intervention status to ${status || currentIntervention.status}`
    });
    
    res.json({
      success: true,
      message: 'Intervention updated successfully'
    });
  } catch (error) {
    console.error('Error updating intervention:', error);
    res.status(500).json({ error: 'Failed to update intervention' });
  }
});

app.post('/api/data-encoder/add-beneficiary', authMiddleware, requireDataEncoder, (req, res) => {
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
    beneficiaryType,
    lguIntervention,
    customInterventionName,
    interventionStatus,
    interventionDate,
    quantityReceived
  } = req.body;

  // Determine intervention type based on intervention name
  let interventionType = 'LGU';
  if (DA_INTERVENTIONS.includes(lguIntervention)) {
    interventionType = 'DA';
  } else if (MLGU_INTERVENTIONS.includes(lguIntervention)) {
    interventionType = 'LGU';
  }

  const normalizedBeneficiaryType = (beneficiaryType || interventionType || 'LGU').toUpperCase();
  if (!['DA', 'LGU'].includes(normalizedBeneficiaryType)) {
    return res.status(400).json({ success: false, message: 'Invalid beneficiary type' });
  }

  if (normalizedBeneficiaryType === 'DA' && (!rsbsaNumber || !String(rsbsaNumber).trim())) {
    return res.status(400).json({ success: false, message: 'RSBSA Number is required for DA beneficiaries.' });
  }

  if (!firstName || !lastName || !birthdate || !barangay || !lguIntervention) {
    return res.status(400).json({ success: false, message: 'Missing required fields' });
  }

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
        SET address = ?, contact_number = ?, farm_location = ?, crop_type = ?, beneficiary_type = ?, rsbsa_number = COALESCE(?, rsbsa_number), updated_by = ?
        WHERE id = ?
      `).run(address, contactNumber, farmLocation, cropType, normalizedBeneficiaryType, rsbsaNumber || null, req.user.id, beneficiaryId);
    } else {
      const result = db.prepare(`
        INSERT INTO beneficiaries (first_name, middle_name, last_name, name, beneficiary_type, rsbsa_number, birthdate, age, address, barangay, contact_number, farm_location, crop_type, household, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(firstName, middleName, lastName, fullName, normalizedBeneficiaryType, rsbsaNumber || null, birthdate, age, address, barangay, contactNumber, farmLocation, cropType, '1 member', req.user.id);

      beneficiaryId = result.lastInsertRowid;
    }

    const existingIntervention = db.prepare(`
      SELECT * FROM interventions
      WHERE beneficiary_id = ? AND intervention_type = ? AND intervention_name = ?
    `).get(beneficiaryId, interventionType, lguIntervention);

    if (!existingIntervention) {
      db.prepare(`
        INSERT INTO interventions (beneficiary_id, intervention_type, intervention_name, custom_intervention_name, status, quantity_received, intervention_date)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(beneficiaryId, interventionType, lguIntervention, customInterventionName || null, interventionStatus || 'Unclaimed', quantityReceived || null, interventionDate || new Date().toISOString().split('T')[0]);
    } else {
      return res.status(400).json({ success: false, message: `This beneficiary already has this ${interventionType} intervention` });
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

// Data Encoder intervention records endpoint
app.get('/api/data-encoder/intervention-records', authMiddleware, requireDataEncoder, (req, res) => {
  const { q } = req.query;
  let query = `
    SELECT i.id, i.intervention_type, i.intervention_name, i.custom_intervention_name, i.status, i.quantity_received, i.intervention_date,
           b.id AS beneficiary_id, b.name, b.rsbsa_number, b.barangay
    FROM interventions i
    JOIN beneficiaries b ON i.beneficiary_id = b.id
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
      intervention: row.custom_intervention_name || row.intervention_name,
      status: row.status,
      quantityReceived: row.quantity_received,
      date: row.intervention_date,
      beneficiaryId: row.beneficiary_id,
      beneficiaryName: row.name,
      rsbsaNumber: row.rsbsa_number,
      barangay: row.barangay
    }))
  });
});

// ------------------------------------------------------------
// Data Encoder crisis reports
// ------------------------------------------------------------
const handleDataEncoderCrisisReportList = (req, res) => {
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
};

const handleDataEncoderCrisisReportCreate = (req, res) => {
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
    estimatedCost,
    latitude,
    longitude
  } = req.body;

  if (!disaster || !barangay || !farmerName || !latitude || !longitude) {
    return res.status(400).json({ success: false, message: 'Missing required fields (farmer name, barangay, GPS coordinates)' });
  }

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
        INSERT INTO beneficiaries (first_name, last_name, name, barangay, farm_location, crop_type, household, created_by, updated_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
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
        total_area_hectares, damaged_area_hectares, production_loss_mt, estimated_damage_cost, latitude, longitude, photos, remarks, created_by
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
      null,
      estimatedCost ? parseFloat(estimatedCost) : null,
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
      action: 'Filed Crisis Report',
      module: 'Crisis Reports',
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
};

app.get('/api/data-encoder/crisis-reports', authMiddleware, requireDataEncoder, handleDataEncoderCrisisReportList);
app.get('/api/data-encoder/disaster-reports', authMiddleware, requireDataEncoder, handleDataEncoderCrisisReportList);
app.post('/api/data-encoder/crisis-reports', authMiddleware, requireDataEncoder, upload.array('photos', 5), handleDataEncoderCrisisReportCreate);
app.post('/api/data-encoder/disaster-reports', authMiddleware, requireDataEncoder, upload.array('photos', 5), handleDataEncoderCrisisReportCreate);

// ------------------------------------------------------------
// Data Encoder Excel Import (preview + confirm)
// ------------------------------------------------------------
const excelUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } });

app.post('/api/encoding/excel/preview', authMiddleware, requireDataEncoder, excelUpload.single('file'), (req, res) => {
  if (req.user.role !== 'DATA_ENCODER') {
    return res.status(403).json({ success: false, message: 'Data Encoder access required' });
  }

  if (!req.file) {
    return res.status(400).json({ success: false, message: 'Excel file is required' });
  }

  const importType = getImportTypeFromRequest(req);
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

    const rawHeaders = rows[0].map((header) => String(header || '').trim());
    const rowsByHeader = rows.slice(1).map((row) => {
      const mapped = { line: 0 };
      rawHeaders.forEach((header, index) => {
        const key = String(header || '').trim();
        mapped[key] = row[index] ?? '';
      });
      return mapped;
    });

    const preview = [];
    const errors = [];
    const schema = getExcelSchemaForImportType(importType);

    rowsByHeader.forEach((row, index) => {
      const line = index + 2;
      const normalizedRow = { line };

      rawHeaders.forEach((header) => {
        normalizedRow[header] = row[header] ?? '';
      });

      const farmerName = String(getExcelRowValue(row, schema.aliases.farmer_name || ['farmer_name']) || '').trim();
      const barangay = String(getExcelRowValue(row, schema.aliases.barangay || ['barangay']) || '').trim();
      const crisisType = String(getExcelRowValue(row, schema.aliases.crisis_type || ['crisis_type']) || '').trim();
      const firstName = String(getExcelRowValue(row, ['first_name', 'first name']) || '').trim();
      const lastName = String(getExcelRowValue(row, ['last_name', 'last name']) || '').trim();
      const birthdate = String(getExcelRowValue(row, ['birthdate']) || '').trim();
      const lguIntervention = String(getExcelRowValue(row, ['lgu_intervention', 'lgu intervention', 'intervention']) || '').trim();

      normalizedRow.farmerName = farmerName || `${firstName} ${lastName}`.trim() || '';
      normalizedRow.barangay = barangay || normalizedRow.barangay || '';
      normalizedRow.crisisType = crisisType || 'Other Agricultural Crisis';
      normalizedRow.firstName = firstName;
      normalizedRow.lastName = lastName;
      normalizedRow.birthdate = birthdate;
      normalizedRow.lguIntervention = lguIntervention;
      normalizedRow.issues = [];

      preview.push(normalizedRow);
    });

    const previewToken = randomUUID();
    excelPreviewStore.set(previewToken, {
      createdAt: Date.now(),
      userId: req.user.id,
      fileName,
      headers: rawHeaders,
      preview,
      importType,
      previewType: importType
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
      headers: rawHeaders,
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

app.post('/api/encoding/excel/confirm', authMiddleware, requireDataEncoder, (req, res) => {
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

  const importType = cached.importType || EXCEL_IMPORT_TYPES.BENEFICIARY;
  const insertBeneficiary = db.prepare(`
    INSERT INTO beneficiaries (
      first_name, middle_name, last_name, name, beneficiary_type, rsbsa_number, birthdate, age, address, barangay,
      contact_number, farm_location, crop_type, household, created_by, updated_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertCrisisReport = db.prepare(`
    INSERT INTO crisis_reports (
      beneficiary_id, crisis_type, crisis_date, barangay, farm_location, crop_type, crop_stage,
      total_area_hectares, damaged_area_hectares, production_loss_mt, estimated_damage_cost, latitude, longitude, photos, remarks, status, created_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  let imported = 0;
  const skipped = [];

  const tx = db.transaction(() => {
    for (const row of validRows) {
      if (importType === EXCEL_IMPORT_TYPES.CRISIS_REPORT) {
        const farmerName = String(row.farmerName || row.farmer_name || row.beneficiaryName || row.beneficiary || `${row.firstName || ''} ${row.lastName || ''}`.trim() || '').trim();
        const barangay = String(row.barangay || '').trim();
        const crisisType = String(row.crisisType || row.crisis_type || 'Other Agricultural Crisis').trim() || 'Other Agricultural Crisis';
        const normalizedCrisisType = ['Typhoon', 'Drought / El Niño', 'Flood', 'Earthquake', 'Pest and Disease', 'Water Crisis', 'Other Agricultural Crisis'].includes(crisisType)
          ? crisisType
          : 'Other Agricultural Crisis';
        const crisisDate = String(row.crisisDate || row.crisis_date || new Date().toISOString().split('T')[0]).trim() || new Date().toISOString().split('T')[0];
        const farmLocation = String(row.farmLocation || row.farm_location || '').trim();
        const cropType = String(row.cropType || row.crop_type || '').trim();
        const cropStage = String(row.cropStage || row.crop_stage || '').trim();
        const totalArea = row.totalArea ?? row.total_area_hectares ?? row.total_area ?? null;
        const damagedArea = row.damagedArea ?? row.damaged_area_hectares ?? row.damaged_area ?? null;
        const productionLossMt = row.productionLossMt ?? row.production_loss_mt ?? row.productionLoss ?? null;
        const estimatedDamageCost = row.estimatedDamageCost ?? row.estimated_damage_cost ?? row.estimatedCost ?? null;
        const latitude = row.latitude ?? null;
        const longitude = row.longitude ?? null;
        const remarks = row.remarks ?? row.notes ?? null;
        const status = String(row.status || 'For Validation').trim() || 'For Validation';

        if (!barangay) {
          skipped.push({ line: row.line, reason: 'Barangay is required' });
          continue;
        }

        let beneficiary = null;
        if (row.rsbsaNumber) {
          beneficiary = db.prepare('SELECT * FROM beneficiaries WHERE rsbsa_number = ?').get(String(row.rsbsaNumber).trim());
        }
        if (!beneficiary && farmerName) {
          beneficiary = db.prepare('SELECT * FROM beneficiaries WHERE name = ?').get(farmerName);
        }

        let fullName = farmerName || `${row.firstName || ''} ${row.lastName || ''}`.trim() || 'Unknown Farmer';
        if (!fullName || fullName === 'Unknown Farmer') {
          fullName = `${row.firstName || row.first_name || ''} ${row.lastName || row.last_name || ''}`.trim() || 'Unknown Farmer';
        }
        if (!beneficiary) {
          const splitName = fullName.split(/\s+/).filter(Boolean);
          const firstName = splitName[0] || 'Unknown';
          const lastName = splitName.slice(1).join(' ') || 'Unknown';
          const beneficiaryResult = insertBeneficiary.run(
            firstName,
            '',
            lastName,
            fullName,
            'DA',
            row.rsbsaNumber ? String(row.rsbsaNumber).trim() : null,
            crisisDate,
            calculateAgeFromBirthdate(crisisDate) ?? 18,
            '',
            barangay,
            '',
            farmLocation,
            cropType,
            '1 member',
            req.user.id,
            req.user.id
          );
          beneficiary = db.prepare('SELECT * FROM beneficiaries WHERE id = ?').get(beneficiaryResult.lastInsertRowid);
        }

        insertCrisisReport.run(
          beneficiary.id,
          normalizedCrisisType,
          crisisDate,
          barangay,
          farmLocation || null,
          cropType || null,
          cropStage || null,
          totalArea !== null && totalArea !== undefined && totalArea !== '' ? parseFloat(totalArea) : null,
          damagedArea !== null && damagedArea !== undefined && damagedArea !== '' ? parseFloat(damagedArea) : null,
          productionLossMt !== null && productionLossMt !== undefined && productionLossMt !== '' ? parseFloat(productionLossMt) : null,
          estimatedDamageCost !== null && estimatedDamageCost !== undefined && estimatedDamageCost !== '' ? parseFloat(estimatedDamageCost) : null,
          latitude !== null && latitude !== undefined && latitude !== '' ? parseFloat(latitude) : null,
          longitude !== null && longitude !== undefined && longitude !== '' ? parseFloat(longitude) : null,
          null,
          remarks || null,
          status,
          req.user.id
        );

        imported++;
        continue;
      }

      const beneficiaryType = String(row.beneficiaryType || '').trim().toUpperCase() ||
        (DA_INTERVENTIONS.includes(row.lguIntervention) ? 'DA' : 'LGU');

      const insertIntervention = db.prepare(`
        INSERT INTO interventions (beneficiary_id, intervention_type, intervention_name, status, intervention_date)
        VALUES (?, ?, ?, ?, ?)
      `);

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

      if (beneficiaryType === 'DA' && (!row.rsbsaNumber || !String(row.rsbsaNumber).trim())) {
        skipped.push({ line: row.line, reason: 'RSBSA number is required for DA beneficiaries' });
        continue;
      }

      const fullName = `${row.firstName} ${row.middleName || ''} ${row.lastName}`.trim();
      const result = insertBeneficiary.run(
        row.firstName,
        row.middleName,
        row.lastName,
        fullName,
        beneficiaryType,
        row.rsbsaNumber || null,
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
        beneficiaryType,
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

// =============================================================
// DISTRIBUTION SCHEDULES
// =============================================================

// Get all distribution schedules (admin and agritech)
app.get('/api/distribution-schedules', authMiddleware, (req, res) => {
  const { source, status, page = 1, limit = 50 } = req.query;
  
  let query = `
    SELECT ds.*, 
           COUNT(sb.id) as beneficiary_count,
           u.name as created_by_name
    FROM distribution_schedules ds
    LEFT JOIN schedule_beneficiaries sb ON ds.id = sb.schedule_id
    LEFT JOIN users u ON ds.created_by = u.id
    WHERE 1=1
  `;
  const params = [];
  
  if (source && source !== 'All') {
    query += ' AND ds.source = ?';
    params.push(source);
  }
  
  if (status && status !== 'All') {
    query += ' AND ds.status = ?';
    params.push(status);
  }
  
  query += ' GROUP BY ds.id ORDER BY ds.distribution_date DESC, ds.created_at DESC';
  
  const schedules = db.prepare(query).all(...params);
  
  res.json({
    success: true,
    schedules: schedules.map(s => ({
      id: s.id,
      scheduleName: s.schedule_name,
      interventionType: s.intervention_type,
      interventionName: s.intervention_name,
      customInterventionName: s.custom_intervention_name,
      source: s.source,
      distributionDate: s.distribution_date,
      status: s.status,
      beneficiaryCount: s.beneficiary_count,
      createdBy: s.created_by_name,
      createdAt: s.created_at
    }))
  });
});

// Create distribution schedule (admin only)
app.post('/api/distribution-schedules', authMiddleware, requireAdmin, (req, res) => {
  const {
    scheduleName,
    interventionType,
    interventionName,
    customInterventionName,
    source,
    distributionDate,
    status = 'Scheduled'
  } = req.body;
  
  if (!scheduleName || !interventionType || !source || !distributionDate) {
    return res.status(400).json({ success: false, message: 'Missing required fields' });
  }
  
  if (!['DA', 'LGU'].includes(interventionType)) {
    return res.status(400).json({ success: false, message: 'Invalid intervention type' });
  }
  
  if (!['DA', 'MLGU'].includes(source)) {
    return res.status(400).json({ success: false, message: 'Invalid source' });
  }
  
  if (!['Scheduled', 'Active', 'Completed', 'Cancelled'].includes(status)) {
    return res.status(400).json({ success: false, message: 'Invalid status' });
  }
  
  try {
    const result = db.prepare(`
      INSERT INTO distribution_schedules (schedule_name, intervention_type, intervention_name, custom_intervention_name, source, distribution_date, status, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(scheduleName, interventionType, interventionName, customInterventionName || null, source, distributionDate, status, req.user.id);
    
    logAudit({
      userId: req.user.id,
      username: req.user.name,
      userRole: req.user.role,
      action: 'Created Distribution Schedule',
      module: 'Distribution Schedules',
      recordType: 'distribution_schedule',
      recordId: result.lastInsertRowid,
      recordAffected: scheduleName,
      description: `Created ${source} distribution schedule for ${interventionName}`
    });
    
    res.json({
      success: true,
      message: 'Distribution schedule created successfully',
      scheduleId: result.lastInsertRowid
    });
  } catch (error) {
    console.error('Error creating distribution schedule:', error);
    res.status(500).json({ success: false, message: 'Failed to create distribution schedule' });
  }
});

// Update distribution schedule status (admin only)
app.put('/api/distribution-schedules/:id/status', authMiddleware, requireAdmin, (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  
  if (!['Scheduled', 'Active', 'Completed', 'Cancelled'].includes(status)) {
    return res.status(400).json({ success: false, message: 'Invalid status' });
  }
  
  try {
    const schedule = db.prepare('SELECT * FROM distribution_schedules WHERE id = ?').get(id);
    if (!schedule) {
      return res.status(404).json({ success: false, message: 'Distribution schedule not found' });
    }
    
    db.prepare('UPDATE distribution_schedules SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(status, id);
    
    logAudit({
      userId: req.user.id,
      username: req.user.name,
      userRole: req.user.role,
      action: 'Updated Distribution Schedule Status',
      module: 'Distribution Schedules',
      recordType: 'distribution_schedule',
      recordId: parseInt(id),
      recordAffected: schedule.schedule_name,
      description: `Updated status to ${status}`
    });
    
    res.json({ success: true, message: 'Distribution schedule status updated' });
  } catch (error) {
    console.error('Error updating distribution schedule:', error);
    res.status(500).json({ success: false, message: 'Failed to update distribution schedule' });
  }
});

// Get beneficiaries for a specific schedule
app.get('/api/distribution-schedules/:id/beneficiaries', authMiddleware, (req, res) => {
  const { id } = req.params;
  const { status } = req.query;
  
  let query = `
    SELECT sb.*, b.name as beneficiary_name, b.rsbsa_number, b.barangay
    FROM schedule_beneficiaries sb
    JOIN beneficiaries b ON sb.beneficiary_id = b.id
    WHERE sb.schedule_id = ?
  `;
  const params = [id];
  
  if (status && status !== 'All') {
    query += ' AND sb.distribution_status = ?';
    params.push(status);
  }
  
  query += ' ORDER BY b.name ASC';
  
  const beneficiaries = db.prepare(query).all(...params);
  
  res.json({
    success: true,
    beneficiaries: beneficiaries.map(b => ({
      id: b.id,
      beneficiaryId: b.beneficiary_id,
      beneficiaryName: b.beneficiary_name,
      rsbsaNumber: b.rsbsa_number,
      barangay: b.barangay,
      quantityAllocated: b.quantity_allocated,
      quantityDistributed: b.quantity_distributed,
      distributionStatus: b.distribution_status,
      distributedAt: b.distributed_at,
      remarks: b.remarks
    }))
  });
});

// Add beneficiaries to distribution schedule
app.post('/api/distribution-schedules/:id/beneficiaries', authMiddleware, (req, res) => {
  const { id } = req.params;
  const { beneficiaryIds, quantityAllocated } = req.body;
  
  if (!Array.isArray(beneficiaryIds) || beneficiaryIds.length === 0) {
    return res.status(400).json({ success: false, message: 'Beneficiary IDs required' });
  }
  
  try {
    const schedule = db.prepare('SELECT * FROM distribution_schedules WHERE id = ?').get(id);
    if (!schedule) {
      return res.status(404).json({ success: false, message: 'Distribution schedule not found' });
    }
    
    beneficiaryIds.forEach(beneficiaryId => {
      db.prepare(`
        INSERT INTO schedule_beneficiaries (schedule_id, beneficiary_id, quantity_allocated, distribution_status)
        VALUES (?, ?, ?, 'Pending')
      `).run(id, beneficiaryId, quantityAllocated || null);
    });
    
    logAudit({
      userId: req.user.id,
      username: req.user.name,
      userRole: req.user.role,
      action: 'Added Beneficiaries to Schedule',
      module: 'Distribution Schedules',
      recordType: 'distribution_schedule',
      recordId: parseInt(id),
      recordAffected: schedule.schedule_name,
      description: `Added ${beneficiaryIds.length} beneficiaries to distribution schedule`
    });
    
    res.json({ success: true, message: 'Beneficiaries added to schedule successfully' });
  } catch (error) {
    console.error('Error adding beneficiaries to schedule:', error);
    res.status(500).json({ success: false, message: 'Failed to add beneficiaries to schedule' });
  }
});

// Record distribution for a beneficiary
app.put('/api/distribution-schedules/:id/beneficiaries/:beneficiaryId/distribute', authMiddleware, (req, res) => {
  const { id, beneficiaryId } = req.params;
  const { quantityDistributed, remarks } = req.body;
  
  try {
    const scheduleBeneficiary = db.prepare(`
      SELECT sb.*, ds.intervention_name, ds.intervention_type, ds.source
      FROM schedule_beneficiaries sb
      JOIN distribution_schedules ds ON sb.schedule_id = ds.id
      WHERE sb.schedule_id = ? AND sb.beneficiary_id = ?
    `).get(id, beneficiaryId);
    
    if (!scheduleBeneficiary) {
      return res.status(404).json({ success: false, message: 'Schedule beneficiary not found' });
    }
    
    if (scheduleBeneficiary.distribution_status === 'Distributed') {
      return res.status(400). json({ success: false, message: 'Already distributed' });
    }
    
    db.prepare(`
      UPDATE schedule_beneficiaries 
      SET quantity_distributed = ?, distribution_status = 'Distributed', distributed_at = CURRENT_TIMESTAMP, distributed_by = ?, remarks = ?
      WHERE id = ?
    `).run(quantityDistributed || scheduleBeneficiary.quantity_allocated, req.user.id, remarks || null, scheduleBeneficiary.id);
    
    // Update intervention status to Claimed
    db.prepare(`
      UPDATE interventions 
      SET status = 'Claimed', quantity_received = ?
      WHERE beneficiary_id = ? AND intervention_type = ? AND intervention_name = ?
    `).run(quantityDistributed || scheduleBeneficiary.quantity_allocated, beneficiaryId, scheduleBeneficiary.intervention_type, scheduleBeneficiary.intervention_name);
    
    logAudit({
      userId: req.user.id,
      username: req.user.name,
      userRole: req.user.role,
      action: 'Recorded Distribution',
      module: 'Distribution Schedules',
      recordType: 'distribution_schedule',
      recordId: parseInt(id),
      recordAffected: scheduleBeneficiary.beneficiary_name,
      description: `Recorded distribution of ${scheduleBeneficiary.intervention_name} for beneficiary ${scheduleBeneficiary.beneficiary_name}`
    });
    
    res.json({ success: true, message: 'Distribution recorded successfully' });
  } catch (error) {
    console.error('Error recording distribution:', error);
    res.status(500).json({ success: false, message: 'Failed to record distribution' });
  }
});

// =============================================================
// INVENTORY MANAGEMENT
// =============================================================

// Get all inventory items
app.get('/api/inventory', authMiddleware, (req, res) => {
  const items = db.prepare(`
    SELECT 
      ii.*,
      COALESCE(SUM(CASE WHEN it.transaction_type = 'Out' THEN it.quantity ELSE 0 END), 0) as total_distributed
    FROM inventory_items ii
    LEFT JOIN inventory_transactions it ON ii.id = it.inventory_item_id
    GROUP BY ii.id
    ORDER BY ii.item_name
  `).all();
  
  res.json({
    success: true,
    items: items.map(item => ({
      id: item.id,
      itemName: item.item_name,
      currentQuantity: item.current_quantity,
      lowStockThreshold: item.low_stock_threshold,
      unit: item.unit,
      totalDistributed: item.total_distributed,
      isLowStock: item.current_quantity <= item.low_stock_threshold,
      updatedAt: item.updated_at
    }))
  });
});

// Add inventory item (admin only)
app.post('/api/inventory', authMiddleware, requireAdmin, (req, res) => {
  const { itemName, category, currentQuantity, lowStockThreshold, unit } = req.body;
  
  if (!itemName || !currentQuantity || !unit) {
    return res.status(400).json({ success: false, message: 'Missing required fields' });
  }
  
  try {
    const result = db.prepare(`
      INSERT INTO inventory_items (item_name, category, current_quantity, low_stock_threshold, unit)
      VALUES (?, ?, ?, ?, ?)
    `).run(itemName, category || null, currentQuantity, lowStockThreshold || 10, unit);
    
    logAudit({
      userId: req.user.id,
      username: req.user.name,
      userRole: req.user.role,
      action: 'Added Inventory Item',
      module: 'Inventory',
      recordType: 'inventory_item',
      recordId: result.lastInsertRowid,
      recordAffected: itemName,
      description: `Added ${currentQuantity} ${unit} of ${itemName} to inventory`
    });
    
    res.json({
      success: true,
      message: 'Inventory item added successfully',
      itemId: result.lastInsertRowid
    });
  } catch (error) {
    console.error('Error adding inventory item:', error);
    res.status(500).json({ success: false, message: 'Failed to add inventory item' });
  }
});

// Update inventory item (admin only)
app.put('/api/inventory/:id', authMiddleware, requireAdmin, (req, res) => {
  const { id } = req.params;
  const { currentQuantity, lowStockThreshold, unit } = req.body;
  
  try {
    const item = db.prepare('SELECT * FROM inventory_items WHERE id = ?').get(id);
    if (!item) {
      return res.status(404).json({ success: false, message: 'Inventory item not found' });
    }
    
    const updates = [];
    const params = [];
    
    if (currentQuantity !== undefined) {
      updates.push('current_quantity = ?');
      params.push(currentQuantity);
    }
    
    if (lowStockThreshold !== undefined) {
      updates.push('low_stock_threshold = ?');
      params.push(lowStockThreshold);
    }
    
    if (unit !== undefined) {
      updates.push('unit = ?');
      params.push(unit);
    }
    
    if (updates.length > 0) {
      updates.push('updated_at = CURRENT_TIMESTAMP');
      params.push(id);
      db.prepare(`UPDATE inventory_items SET ${updates.join(', ')} WHERE id = ?`).run(...params);
    }
    
    logAudit({
      userId: req.user.id,
      username: req.user.name,
      userRole: req.user.role,
      action: 'Updated Inventory Item',
      module: 'Inventory',
      recordType: 'inventory_item',
      recordId: parseInt(id),
      recordAffected: item.item_name,
      description: 'Updated inventory item details'
    });
    
    res.json({ success: true, message: 'Inventory item updated successfully' });
  } catch (error) {
    console.error('Error updating inventory item:', error);
    res.status(500).json({ success: false, message: 'Failed to update inventory item' });
  }
});

// Get inventory transactions
app.get('/api/inventory/:id/transactions', authMiddleware, (req, res) => {
  const { id } = req.params;
  
  const transactions = db.prepare(`
    SELECT it.*, ii.item_name, u.name as performed_by_name
    FROM inventory_transactions it
    JOIN inventory_items ii ON it.inventory_item_id = ii.id
    LEFT JOIN users u ON it.performed_by = u.id
    WHERE it.inventory_item_id = ?
    ORDER BY it.created_at DESC
    LIMIT 100
  `).all(id);
  
  res.json({
    success: true,
    transactions: transactions.map(t => ({
      id: t.id,
      transactionType: t.transaction_type,
      quantity: t.quantity,
      previousQuantity: t.previous_quantity,
      newQuantity: t.new_quantity,
      relatedScheduleId: t.related_schedule_id,
      relatedBeneficiaryId: t.related_beneficiary_id,
      performedBy: t.performed_by_name,
      remarks: t.remarks,
      createdAt: t.created_at
    }))
  });
});

// Record inventory transaction (admin only)
app.post('/api/inventory/:id/transaction', authMiddleware, requireAdmin, (req, res) => {
  const { id } = req.params;
  const { transactionType, quantity, relatedScheduleId, relatedBeneficiaryId, remarks } = req.body;
  
  if (!transactionType || !quantity) {
    return res.status(400).json({ success: false, message: 'Missing required fields' });
  }
  
  if (!['In', 'Out', 'Adjustment'].includes(transactionType)) {
    return res.status(400).json = ({ success: false, message: 'Invalid transaction type' });
  }
  
  try {
    const item = db.prepare('SELECT * FROM inventory_items WHERE id = ?').get(id);
    if (!item) {
      return res.status(404).json({ success: false, message: 'Inventory item not found' });
    }
    
    const quantityNum = parseFloat(quantity);
    let newQuantity = item.current_quantity;
    
    if (transactionType === 'Out') {
      if (quantityNum > item.current_quantity) {
        return res.status(400).json({ 
          success: false, 
          message: `Insufficient stock. Available: ${item.current_quantity} ${item.unit}, Requested: ${quantityNum} ${item.unit}` 
        });
      }
      newQuantity = item.current_quantity - quantityNum;
    } else if (transactionType === 'In') {
      newQuantity = item.current_quantity + quantityNum;
    } else {
      newQuantity = quantityNum;
    }
    
    if (newQuantity < 0) {
      return res.status(400).json({ success: false, message: 'Quantity cannot be negative' });
    }
    
    db.prepare(`
      INSERT INTO inventory_transactions (inventory_item_id, transaction_type, quantity, previous_quantity, new_quantity, related_schedule_id, related_beneficiary_id, performed_by, remarks)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, transactionType, quantityNum, item.current_quantity, newQuantity, relatedScheduleId || null, relatedBeneficiaryId || null, req.user.id, remarks || null);
    
    db.prepare('UPDATE inventory_items SET current_quantity = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(newQuantity, id);
    
    logAudit({
      userId: req.user.id,
      username: req.user.name,
      userRole: req.user.role,
      action: 'Recorded Inventory Transaction',
      module: 'Inventory',
      recordType: 'inventory_item',
      recordId: parseInt(id),
      recordAffected: item.item_name,
      description: `${transactionType} ${quantityNum} ${item.unit} - New total: ${newQuantity} ${item.unit}`
    });
    
    res.json({
      success: true,
      message: 'Inventory transaction recorded successfully',
      newQuantity
    });
  } catch (error) {
    console.error('Error recording inventory transaction:', error);
    res.status(500).json({ success: false, message: 'Failed to record inventory transaction' });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

// Keep the process alive
setInterval(() => {
  cleanupExpiredExcelPreviews();
}, 1000);
