// File: server.js
// Production-ready server with proper error handling and graceful shutdown

const config = require('./src/config/environment');
const logger = require('./src/utils/logger');

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception', { error: error.message, stack: error.stack });
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection', { reason, promise });
  process.exit(1);
});

// Graceful shutdown handling
const shutdown = async (signal) => {
  logger.info(`Received ${signal}, starting graceful shutdown`);
  
  try {
    if (server) {
      server.close(() => {
        logger.info('HTTP server closed');
      });
    }

    // Give services time to finish current requests
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Shutdown services
    const ServiceManager = require('./src/services/ServiceManager');
    await ServiceManager.shutdown();
    
    logger.info('Graceful shutdown complete');
    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown', { error: error.message });
    process.exit(1);
  }
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

async function startServer() {
  try {
    logger.info('Starting SilverSupport AI Technical Support Service', {
      version: '1.1.0',
      environment: config.get('node_env'),
      port: config.get('port'),
      features: config.getServiceStatus()
    });

    // Initialize services first
    const ServiceManager = require('./src/services/ServiceManager');
    await ServiceManager.initializeServices();

    // Load the Express app
    const app = require('./src/app');
    
    // Start the HTTP server
    const server = app.listen(config.get('port'), config.get('host'), () => {
      logger.info(`🚀 SilverSupport AI running on ${config.get('host')}:${config.get('port')}`, {
        environment: config.get('node_env'),
        enabledServices: ServiceManager.getEnabledServices(),
        health: ServiceManager.getOverallHealth()
      });

      // Log service status
      const serviceStatus = ServiceManager.getServiceStatus();
      logger.info('Service Status:', serviceStatus);

      if (config.get('services.twilio.enabled')) {
        logger.info('📞 Twilio Voice Services: Enabled');
      } else {
        logger.warn('📞 Twilio Voice Services: Disabled - Voice calls will not work');
      }

      if (ServiceManager.getService('anthropic') || ServiceManager.getService('openai')) {
        logger.info('🤖 AI Services: Enabled');
      } else {
        logger.warn('🤖 AI Services: Disabled - Using fallback responses');
      }

      logger.info('🎤 Voice Authentication:', config.get('features.voiceAuth') ? 'Enabled' : 'Disabled');
      logger.info('👨‍👩‍👧‍👦 Family Portal:', config.get('features.familyPortal') ? 'Enabled' : 'Disabled');
      
      if (config.isDevelopment()) {
        logger.info('📊 Admin Dashboard: http://localhost:3001');
        logger.info('🔧 Development Mode: Additional logging enabled');
      }
    });

    // Set global server reference for graceful shutdown
    global.server = server;

    return server;

  } catch (error) {
    logger.error('Failed to start server', { 
      error: error.message, 
      stack: error.stack 
    });
    process.exit(1);
  }
}

// Start the server
startServer().catch((error) => {
  logger.error('Server startup failed', { error: error.message });
  process.exit(1);
});