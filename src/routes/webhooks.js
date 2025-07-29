const express = require('express');
const router = express.Router();
const webhookController = require('../controllers/webhookController');

// Basic Twilio webhook endpoints
router.post('/twilio/incoming', webhookController.handleIncomingCall);
router.post('/twilio/handle-recording', webhookController.handleRecording);
router.post('/twilio/handle-follow-up', webhookController.handleFollowUp);
router.post('/twilio/recording-complete', (req, res) => res.status(200).send('OK'));
router.post('/twilio/follow-up-complete', (req, res) => res.status(200).send('OK'));
router.post('/twilio/status', webhookController.handleCallStatus);

// Interruption handling endpoints
router.post('/twilio/handle-interruption', webhookController.handleInterruption);
router.post('/twilio/handle-interruption-recording', webhookController.handleInterruptionRecording);
router.post('/twilio/partial-speech', webhookController.handlePartialSpeech);
router.post('/twilio/interruption-complete', (req, res) => res.status(200).send('OK'));
router.post('/twilio/transcription-complete', (req, res) => res.status(200).send('OK'));

module.exports = router;
