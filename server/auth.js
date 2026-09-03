import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'agapay-secret-key-change-in-production';

export function generateToken(user) {
  return jwt.sign(
    { 
      id: user.id, 
      email: user.email, 
      role: user.role,
      name: user.name 
    },
    JWT_SECRET,
    { expiresIn: '24h' }
  );
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
}

// Create a middleware factory that accepts db instance
export function createAuthMiddleware(db) {
  return (req, res, next) => {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }
    
    const token = authHeader.substring(7);
    const decoded = verifyToken(token);
    
    if (!decoded) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
    
    // Check if user account is approved
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(decoded.id);
    
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }
    
    if (user.status !== 'approved') {
      return res.status(403).json({ 
        error: 'Account not approved',
        message: 'Your account is pending approval or has been rejected'
      });
    }
    
    req.user = decoded;
    next();
  };
}

// Legacy authMiddleware for backwards compatibility
export function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }
  
  const token = authHeader.substring(7);
  const decoded = verifyToken(token);
  
  if (!decoded) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
  
  req.user = decoded;
  next();
}

export function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ 
        error: 'Access denied',
        message: 'You do not have permission to access this resource'
      });
    }
    
    next();
  };
}

export function requireAdmin(req, res, next) {
  return requireRole('ADMIN')(req, res, next);
}

export function requireAgritech(req, res, next) {
  return requireRole('ADMIN', 'AGRICULTURAL_TECHNOLOGIST')(req, res, next);
}

export function requireDataEncoder(req, res, next) {
  return requireRole('ADMIN', 'DATA_ENCODER')(req, res, next);
}
