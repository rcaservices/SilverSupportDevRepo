const app = require('./src/app');
const logger = require('./src/utils/logger');

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || 'localhost';

const server = app.listen(PORT, HOST, () => {
  logger.info(`🚀 AI Technical Support Service running on http://${HOST}:${PORT}`);
  logger.info(`📊 Admin Dashboard available at http://localhost:3001`);
  logger.info(`📞 Twilio Webhook: ${process.env.TWILIO_WEBHOOK_URL || 'Not configured'}`);
  logger.info(`🎤 Voice Authentication: Enabled`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received. Shutting down gracefully...');
  server.close(() => {
    logger.info('Process terminated');
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT received. Shutting down gracefully...');
  server.close(() => {
    logger.info('Process terminated');
  });
});

module.exports = server;
