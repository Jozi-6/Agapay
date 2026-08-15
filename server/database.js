import Database from 'better-sqlite3';
import bcrypt from 'bcrypt';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, 'agapay.db');
const db = new Database(dbPath);

// Enable foreign keys
db.pragma('foreign_keys = ON');

// Create users table
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('ADMIN', 'AGRICULTURAL_TECHNOLOGIST', 'DATA_ENCODER')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// Check if we need to migrate from old schema to new schema
const oldTableExists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='beneficiaries'").get();
const newTableExists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='interventions'").get();

if (oldTableExists && !newTableExists) {
  console.log('Migrating from old schema to new schema...');
  
  // Drop old beneficiaries table if it has the old schema
  try {
    // Check the schema of the old table
    const tableInfo = db.pragma('table_info(beneficiaries)');
    const hasOldSchema = tableInfo.some(col => col.name === 'intervention');
    
    if (hasOldSchema) {
      db.exec('DROP TABLE IF EXISTS beneficiaries');
    }
  } catch (e) {
    console.log('Error checking old schema, recreating table...');
    db.exec('DROP TABLE IF EXISTS beneficiaries');
  }
}

// Create beneficiaries table (with enhanced fields)
db.exec(`
  CREATE TABLE IF NOT EXISTS beneficiaries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    first_name TEXT NOT NULL,
    middle_name TEXT,
    last_name TEXT NOT NULL,
    name TEXT NOT NULL,
    rsbsa_number TEXT,
    birthdate DATE,
    age INTEGER,
    address TEXT,
    barangay TEXT NOT NULL,
    contact_number TEXT,
    farm_location TEXT,
    crop_type TEXT,
    household TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// Create interventions table (to support multiple interventions per beneficiary)
db.exec(`
  CREATE TABLE IF NOT EXISTS interventions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    beneficiary_id INTEGER NOT NULL,
    intervention_type TEXT NOT NULL CHECK(intervention_type IN ('DA', 'LGU')),
    intervention_name TEXT NOT NULL,
    status TEXT DEFAULT 'Unclaimed' CHECK(status IN ('Claimed', 'Unclaimed', 'Pending')),
    intervention_date DATE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (beneficiary_id) REFERENCES beneficiaries(id) ON DELETE CASCADE
  )
`);

// Create crisis reports table (for crop damage and crisis reporting)
db.exec(`
  CREATE TABLE IF NOT EXISTS crisis_reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    beneficiary_id INTEGER NOT NULL,
    crisis_type TEXT NOT NULL CHECK(crisis_type IN ('Typhoon', 'Drought / El Niño', 'Flood', 'Earthquake', 'Pest and Disease', 'Water Crisis', 'Other Agricultural Crisis')),
    crisis_date DATE NOT NULL,
    barangay TEXT NOT NULL,
    farm_location TEXT,
    crop_type TEXT,
    crop_stage TEXT,
    total_area_hectares REAL,
    damaged_area_hectares REAL,
    production_loss_mt REAL,
    estimated_damage_cost REAL,
    remarks TEXT,
    status TEXT DEFAULT 'For Validation' CHECK(status IN ('For Validation', 'Validated', 'Rejected')),
    created_by INTEGER,
    validated_by INTEGER,
    validated_date DATE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (beneficiary_id) REFERENCES beneficiaries(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id),
    FOREIGN KEY (validated_by) REFERENCES users(id)
  )
`);

// Migrations: add new columns if they don't exist yet (SQLite has no ADD COLUMN IF NOT EXISTS)
function addColumnIfMissing(table, column, definition) {
  const columns = db.pragma(`table_info(${table})`);
  if (!columns.some((col) => col.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    console.log(`Added column '${column}' to '${table}'`);
  }
}

// Beneficiary validation status (Agricultural Technologist workflow)
addColumnIfMissing('beneficiaries', 'validation_status', "TEXT DEFAULT 'Pending'");

// GPS coordinates and photo attachments for damage / crisis reports
addColumnIfMissing('crisis_reports', 'latitude', 'REAL');
addColumnIfMissing('crisis_reports', 'longitude', 'REAL');
addColumnIfMissing('crisis_reports', 'photos', 'TEXT');




// Create audit trail table (for system activity logging)
db.exec(`
  CREATE TABLE IF NOT EXISTS audit_trail (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    username TEXT NOT NULL,
    user_role TEXT NOT NULL,
    action TEXT NOT NULL,
    module TEXT NOT NULL,
    record_type TEXT,
    record_id INTEGER,
    record_affected TEXT,
    description TEXT,
    ip_address TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )
`);

// Seed data function
function seedDatabase() {
  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get();
  
  if (userCount.count === 0) {
    const saltRounds = 10;
    
    // Admin - Municipal Agriculturist
    const adminPassword = bcrypt.hashSync('admin123', saltRounds);
    db.prepare(`
      INSERT INTO users (email, password, name, role) 
      VALUES (?, ?, ?, ?)
    `).run('admin@agapay.gov', adminPassword, 'Municipal Agriculturist', 'ADMIN');
    
    // Agricultural Technologist
    const techPassword = bcrypt.hashSync('tech123', saltRounds);
    db.prepare(`
      INSERT INTO users (email, password, name, role) 
      VALUES (?, ?, ?, ?)
    `).run('tech@agapay.gov', techPassword, 'Agricultural Technologist', 'AGRICULTURAL_TECHNOLOGIST');
    
    // Data Encoder
    const encoderPassword = bcrypt.hashSync('encoder123', saltRounds);
    db.prepare(`
      INSERT INTO users (email, password, name, role) 
      VALUES (?, ?, ?, ?)
    `).run('encoder@agapay.gov', encoderPassword, 'Data Encoder', 'DATA_ENCODER');
    
    console.log('Database seeded with test users');
  }

  // Seed beneficiaries
  const beneficiaryCount = db.prepare('SELECT COUNT(*) as count FROM beneficiaries').get();
  
  if (beneficiaryCount.count === 0) {
    // Juan Dela Cruz - DA Seeds
    const juanId = db.prepare(`
      INSERT INTO beneficiaries (first_name, middle_name, last_name, name, rsbsa_number, birthdate, age, address, barangay, contact_number, farm_location, crop_type, household) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run('Juan', 'Abenoja', 'Dela Cruz', 'Juan Abenoja Dela Cruz', 'RSBSA-0231', '1980-05-15', 44, 'Purok 1', 'Poblacion', '09123456789', 'Poblacion (2 hectares)', 'Cabbage', '3 members').lastInsertRowid;

    db.prepare(`
      INSERT INTO interventions (beneficiary_id, intervention_type, intervention_name, status, intervention_date) 
      VALUES (?, ?, ?, ?, ?)
    `).run(juanId, 'DA', 'Seeds', 'Claimed', '2024-01-15');

    // Maria Santos - LGU Fertilizer
    const mariaId = db.prepare(`
      INSERT INTO beneficiaries (first_name, middle_name, last_name, name, rsbsa_number, birthdate, age, address, barangay, contact_number, farm_location, crop_type, household) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run('Maria', 'Gonzales', 'Santos', 'Maria Gonzales Santos', 'RSBSA-0198', '1985-08-20', 39, 'Purok 2', 'Samoki', '09234567890', 'Samoki (1.5 hectares)', 'Lettuce', '1 member').lastInsertRowid;

    db.prepare(`
      INSERT INTO interventions (beneficiary_id, intervention_type, intervention_name, status, intervention_date) 
      VALUES (?, ?, ?, ?, ?)
    `).run(mariaId, 'LGU', 'Complete Fertilizer', 'Claimed', '2024-02-20');

    // Pedro Reyes - LGU Newly Registered
    const pedroId = db.prepare(`
      INSERT INTO beneficiaries (first_name, middle_name, last_name, name, rsbsa_number, birthdate, age, address, barangay, contact_number, farm_location, crop_type, household) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run('Pedro', 'Garcia', 'Reyes', 'Pedro Garcia Reyes', null, '1990-03-10', 34, 'Purok 3', 'Bontoc Ili', '09345678901', 'Bontoc Ili (1 hectare)', 'Tomato', '2 members').lastInsertRowid;

    db.prepare(`
      INSERT INTO interventions (beneficiary_id, intervention_type, intervention_name, status, intervention_date) 
      VALUES (?, ?, ?, ?, ?)
    `).run(pedroId, 'LGU', 'Production Input', 'Unclaimed', '2024-03-01');

    console.log('Database seeded with test beneficiaries and interventions');
  }

  // Seed crisis reports
  const crisisReportCount = db.prepare('SELECT COUNT(*) as count FROM crisis_reports').get();
  
  if (crisisReportCount.count === 0) {
    // Get a beneficiary to associate with the crisis reports
    const beneficiary = db.prepare('SELECT id FROM beneficiaries LIMIT 1').get();
    if (beneficiary) {
      // Add sample crisis reports
      db.prepare(`
        INSERT INTO crisis_reports (beneficiary_id, crisis_type, crisis_date, barangay, farm_location, crop_type, crop_stage, total_area_hectares, damaged_area_hectares, production_loss_mt, estimated_damage_cost, remarks, status) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(beneficiary.id, 'Typhoon', '2024-07-15', 'Poblacion', 'Poblacion Farm', 'Cabbage', 'Vegetative', 1.20, 0.80, 2.4, 72000, 'Severe damage from typhoon', 'Validated');

      const bene2 = db.prepare('SELECT id FROM beneficiaries LIMIT 1 OFFSET 1').get();
      if (bene2) {
        db.prepare(`
          INSERT INTO crisis_reports (beneficiary_id, crisis_type, crisis_date, barangay, farm_location, crop_type, crop_stage, total_area_hectares, damaged_area_hectares, production_loss_mt, estimated_damage_cost, remarks, status) 
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(bene2.id, 'Pest and Disease', '2024-08-01', 'Samoki', 'Samoki Farm', 'Lettuce', 'Reproductive', 0.95, 0.45, 1.5, 54000, 'Crop affected by pest infestation', 'For Validation');
      }

      const bene3 = db.prepare('SELECT id FROM beneficiaries LIMIT 1 OFFSET 2').get();
      if (bene3) {
        db.prepare(`
          INSERT INTO crisis_reports (beneficiary_id, crisis_type, crisis_date, barangay, farm_location, crop_type, crop_stage, total_area_hectares, damaged_area_hectares, production_loss_mt, estimated_damage_cost, remarks, status) 
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(bene3.id, 'Drought / El Niño', '2024-06-20', 'Bontoc Ili', 'Bontoc Ili Farm', 'Tomato', 'Maturing', 1.00, 0.30, 1.2, 45000, 'Drought caused significant crop loss', 'Validated');
      }

      console.log('Database seeded with test crisis reports');
    }
  }
}

// seedDatabase();

export default db;
