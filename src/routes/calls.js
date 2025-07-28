const express = require('express');
const router = express.Router();

// GET /api/calls - Get all calls
router.get('/', (req, res) => {
  res.json({ message: 'Calls endpoint - coming soon' });
});

// POST /api/calls/incoming - Handle new incoming call
router.post('/incoming', (req, res) => {
  res.json({ message: 'Incoming call handler - coming soon' });
});

// GET /api/calls/:sessionId - Get call details
router.get('/:sessionId', (req, res) => {
  res.json({ 
    message: 'Call details - coming soon',
    sessionId: req.params.sessionId 
  });
});

module.exports = router;
