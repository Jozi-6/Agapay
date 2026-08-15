import db from './database.js';

export function logAudit({
  userId,
  username,
  userRole,
  action,
  module,
  recordType = null,
  recordId = null,
  recordAffected = null,
  description = null,
  ipAddress = null
}) {
  try {
    const stmt = db.prepare(`
      INSERT INTO audit_trail (
        user_id, username, user_role, action, module,
        record_type, record_id, record_affected, description, ip_address
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      userId,
      username,
      userRole,
      action,
      module,
      recordType,
      recordId,
      recordAffected,
      description,
      ipAddress
    );
    
    return true;
  } catch (error) {
    console.error('Failed to log audit record:', error);
    return false;
  }
}

export function getAuditLogs(filters = {}) {
  try {
    let query = `
      SELECT 
        id,
        user_id,
        username,
        user_role,
        action,
        module,
        record_type,
        record_id,
        record_affected,
        description,
        ip_address,
        created_at
      FROM audit_trail
      WHERE 1=1
    `;
    
    const params = [];
    
    if (filters.userId) {
      query += ' AND user_id = ?';
      params.push(filters.userId);
    }
    
    if (filters.username) {
      query += ' AND username LIKE ?';
      params.push(`%${filters.username}%`);
    }
    
    if (filters.action) {
      query += ' AND action = ?';
      params.push(filters.action);
    }
    
    if (filters.module) {
      query += ' AND module = ?';
      params.push(filters.module);
    }
    
    if (filters.startDate) {
      query += ' AND created_at >= ?';
      params.push(filters.startDate);
    }
    
    if (filters.endDate) {
      query += ' AND created_at <= ?';
      params.push(filters.endDate);
    }
    
    query += ' ORDER BY created_at DESC';
    
    if (filters.limit) {
      query += ' LIMIT ?';
      params.push(filters.limit);
    }
    
    const stmt = db.prepare(query);
    return stmt.all(...params);
  } catch (error) {
    console.error('Failed to fetch audit logs:', error);
    return [];
  }
}

export function getAuditActions() {
  try {
    const stmt = db.prepare(`
      SELECT DISTINCT action 
      FROM audit_trail 
      ORDER BY action
    `);
    return stmt.all().map(row => row.action);
  } catch (error) {
    console.error('Failed to fetch audit actions:', error);
    return [];
  }
}

export function getAuditModules() {
  try {
    const stmt = db.prepare(`
      SELECT DISTINCT module 
      FROM audit_trail 
      ORDER BY module
    `);
    return stmt.all().map(row => row.module);
  } catch (error) {
    console.error('Failed to fetch audit modules:', error);
    return [];
  }
}
