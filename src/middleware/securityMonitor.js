// File: src/middleware/securityMonitor.js
const logger = require('../utils/logger');

// Track suspicious activity
const suspiciousActivity = new Map();
const SUSPICIOUS_THRESHOLD = parseInt(process.env.SUSPICIOUS_ACTIVITY_THRESHOLD) || 5;
const WINDOW_MS = 60 * 60 * 1000; // 1 hour

function trackSuspiciousActivity(ip, reason) {
  const now = Date.now();
  const key = ip;
  
  if (!suspiciousActivity.has(key)) {
    suspiciousActivity.set(key, []);
  }
  
  const activities = suspiciousActivity.get(key);
  // Clean old activities
  const recentActivities = activities.filter(activity => 
    now - activity.timestamp < WINDOW_MS
  );
  
  recentActivities.push({ timestamp: now, reason });
  suspiciousActivity.set(key, recentActivities);
  
  if (recentActivities.length >= SUSPICIOUS_THRESHOLD) {
    logger.warn('Suspicious activity detected', {
      ip,
      activities: recentActivities,
      count: recentActivities.length
    });
    
    // Log to database (import SecurityLogger dynamically to avoid circular dependency)
    const SecurityLogger = require('./securityLogger');
    SecurityLogger.logSecurityEvent('suspicious_activity', ip, {
      activities: recentActivities,
      threshold: SUSPICIOUS_THRESHOLD
    }, 'high');
    
    return true; // Suspicious
  }
  
  return false;
}

function securityMonitor(req, res, next) {
  const ip = req.ip;
  const userAgent = req.get('User-Agent') || '';
  const path = req.path;
  
  // Check for common attack patterns
  const suspiciousPatterns = [
    /\.\./,           // Directory traversal
    /<script/i,       // XSS attempts
    /union.*select/i, // SQL injection
    /eval\(/i,        // Code injection
    /javascript:/i    // JavaScript protocol
  ];
  
  const queryString = req.url;
  const body = JSON.stringify(req.body || {});
  
  let suspicious = false;
  let reason = '';
  
  // Check URL and body for suspicious patterns
  if (suspiciousPatterns.some(pattern => pattern.test(queryString + body))) {
    suspicious = true;
    reason = 'malicious_pattern';
  }
  
  // Check for empty User-Agent (common in automated attacks)
  if (!userAgent.trim()) {
    suspicious = true;
    reason = 'no_user_agent';
  }
  
  // Check for unusually high request frequency
  if (req.rateLimit && req.rateLimit.remaining < 5) {
    suspicious = true;
    reason = 'high_frequency';
  }
  
  // Track and respond to suspicious activity
  if (suspicious) {
    const isHighlySuspicious = trackSuspiciousActivity(ip, reason);
    
    if (isHighlySuspicious) {
      logger.error('Blocking highly suspicious request', {
        ip,
        path,
        reason,
        userAgent: userAgent.substring(0, 100)
      });
      
      return res.status(429).json({
        error: 'Too many suspicious requests',
        message: 'Your IP has been temporarily restricted'
      });
    }
  }
  
  // Log all requests to signup endpoint for monitoring
  if (path === '/api/subscribers/signup') {
    logger.info('Signup request monitored', {
      ip,
      userAgent: userAgent.substring(0, 100),
      suspicious,
      reason
    });
  }
  
  next();
}

module.exports = securityMonitor;