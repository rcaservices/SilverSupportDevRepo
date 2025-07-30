const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');

// JWT authentication middleware for admin routes
const auth = (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ 
        error: 'Access denied. No token provided.' 
      });
    }
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    logger.error('Auth middleware error:', error);
    res.status(400).json({ 
      error: 'Invalid token.' 
    });
  }
};

module.exports = auth;
