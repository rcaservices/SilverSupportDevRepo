const express = require('express');
const router = express.Router();
const webhookController = require('../controllers/webhookController');

// Twilio webhook endpoints
router.post('/twilio/incoming', webhookController.handleIncomingCall);
router.post('/twilio/handle-recording', webhookController.handleRecording);
router.post('/twilio/handle-follow-up', webhookController.handleFollowUp);
router.post('/twilio/recording-complete', (req, res) => res.status(200).send('OK'));
router.post('/twilio/follow-up-complete', (req, res) => res.status(200).send('OK'));
router.post('/twilio/status', webhookController.handleCallStatus);

module.exports = router;
