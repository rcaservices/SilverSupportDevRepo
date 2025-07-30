const express = require('express');
const webhookController = require('../controllers/webhookController');
const validateTwilioSignature = require('../middleware/twilioAuth');

const router = express.Router();

// Apply Twilio signature validation to all webhook routes
router.use('/twilio/*', validateTwilioSignature);

// Main call flow routes
router.post('/twilio/incoming', webhookController.handleIncomingCall);
router.post('/twilio/voice-auth', webhookController.handleVoiceAuth);
router.post('/twilio/support-request', webhookController.handleSupportRequest);

// Enrollment flow routes
router.post('/twilio/complete-enrollment', webhookController.handleCompleteEnrollment);
router.post('/twilio/re-enrollment', webhookController.handleCompleteEnrollment);

// Signup flow routes
router.post('/twilio/signup-response', webhookController.handleSignupResponse);

// Follow-up and status routes
router.post('/twilio/follow-up', webhookController.handleFollowUp);
router.post('/twilio/status', webhookController.handleCallStatus);

// Legacy route for backward compatibility
router.post('/twilio/handle-recording', webhookController.handleRecording);

module.exports = router;
