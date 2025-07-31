// File: src/utils/emailService.js (FIXED)
const nodemailer = require('nodemailer');
const logger = require('./logger');
const { Client } = require('pg');

class EmailService {
  constructor() {
    this.transporter = null;
    this.initializeTransporter();
  }

  initializeTransporter() {
    try {
      // FIXED: Use createTransport (not createTransporter)
      this.transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT) || 587,
        secure: process.env.SMTP_PORT === '465', // true for port 465, false for other ports
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
        // Additional configuration for common providers
        ...(process.env.SMTP_HOST === 'smtp.gmail.com' && {
          service: 'gmail'
        })
      });

      // Verify connection configuration
      if (process.env.NODE_ENV !== 'test') {
        this.transporter.verify((error, success) => {
          if (error) {
            logger.error('Email transporter verification failed:', error);
          } else {
            logger.info('Email server is ready to send messages');
          }
        });
      }
    } catch (error) {
      logger.error('Failed to initialize email transporter:', error);
    }
  }

  async sendSignupConfirmation(familyEmail, seniorName, signupDetails) {
    try {
      if (!this.transporter) {
        throw new Error('Email transporter not initialized');
      }

      const mailOptions = {
        from: {
          name: 'SilverSupport.ai',
          address: process.env.FROM_EMAIL || 'support@silversupport.ai'
        },
        to: familyEmail,
        subject: `${seniorName} is ready for SilverSupport! Next steps inside`,
        html: this.generateSignupConfirmationHTML(seniorName, signupDetails),
        text: this.generateSignupConfirmationText(seniorName, signupDetails)
      };

      const result = await this.transporter.sendMail(mailOptions);
      
      // Log email delivery
      await this.logEmailDelivery(familyEmail, 'signup_confirmation', result.messageId, 'sent');
      
      logger.info('Signup confirmation email sent', {
        messageId: result.messageId,
        to: familyEmail,
        seniorName
      });

      return { success: true, messageId: result.messageId };
    } catch (error) {
      // Log email failure
      await this.logEmailDelivery(familyEmail, 'signup_confirmation', null, 'failed', error.message);
      
      logger.error('Failed to send signup confirmation email', {
        error: error.message,
        to: familyEmail,
        seniorName
      });
      return { success: false, error: error.message };
    }
  }

  generateSignupConfirmationHTML(seniorName, details) {
    const callLimit = this.getCallLimitForTier(details.selectedTier);
    const supportNumber = process.env.SUPPORT_PHONE_NUMBER || '1-800-SUPPORT';
    const websiteUrl = process.env.WEBSITE_URL || 'https://silversupport.ai';
    
    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Welcome to SilverSupport.ai</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f4f4f4;">
        <div style="max-width: 600px; margin: 0 auto; background-color: white; box-shadow: 0 0 10px rgba(0,0,0,0.1);">
          <div style="background: linear-gradient(135deg, #667eea, #764ba2); color: white; padding: 30px; text-align: center;">
            <h1 style="margin: 0 0 10px 0; font-size: 28px;">🎉 ${seniorName} is all signed up!</h1>
            <p style="margin: 0; font-size: 16px; opacity: 0.9;">Welcome to SilverSupport.ai</p>
          </div>
          
          <div style="padding: 30px; background: white;">
            <p>Great news! We've successfully set up <strong>${seniorName}</strong> in our system with the <strong>${details.selectedTier}</strong> plan.</p>
            
            <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3>📞 Next Steps (Important!)</h3>
              <div style="margin: 15px 0; padding: 15px; border-left: 4px solid #667eea; background: white;">
                <strong style="color: #667eea;">Step 1:</strong> Have ${seniorName} call 
                <div style="font-size: 18px; font-weight: bold; color: #667eea; background: #f0f4ff; padding: 10px; border-radius: 5px; display: inline-block; margin: 5px 0;">${supportNumber}</div>
              </div>
              <div style="margin: 15px 0; padding: 15px; border-left: 4px solid #667eea; background: white;">
                <strong style="color: #667eea;">Step 2:</strong> We'll guide them through a quick 5-minute voice enrollment
              </div>
              <div style="margin: 15px 0; padding: 15px; border-left: 4px solid #667eea; background: white;">
                <strong style="color: #667eea;">Step 3:</strong> They're ready to get help anytime!
              </div>
            </div>
            
            <h3>🤖 What ${seniorName} should expect:</h3>
            <ul>
              <li>A friendly AI that learns and recognizes their voice</li>
              <li>No passwords, buttons, or complicated menus</li>
              <li>Help with computers, tablets, phones, WiFi, and more</li>
              <li>Patient, senior-friendly support</li>
            </ul>
            
            <div style="background: #e3f2fd; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3>📋 Your Plan Details</h3>
              <ul>
                <li><strong>Plan:</strong> ${details.selectedTier.charAt(0).toUpperCase() + details.selectedTier.slice(1)}</li>
                <li><strong>Monthly Calls:</strong> ${callLimit}</li>
                <li><strong>24/7 Availability:</strong> Yes</li>
              </ul>
            </div>
            
            <p><strong>Questions?</strong> Reply to this email or call ${supportNumber}</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  generateSignupConfirmationText(seniorName, details) {
    const callLimit = this.getCallLimitForTier(details.selectedTier);
    const supportNumber = process.env.SUPPORT_PHONE_NUMBER || '1-800-SUPPORT';
    
    return `
🎉 ${seniorName} is all signed up for SilverSupport.ai!

NEXT STEPS (IMPORTANT):
1. Have ${seniorName} call ${supportNumber}
2. We'll guide them through a quick 5-minute voice enrollment
3. They're ready to get help anytime!

WHAT TO EXPECT:
- A friendly AI that learns their voice
- No passwords or complicated menus  
- Help with computers, tablets, phones, and more
- Patient, senior-friendly support

YOUR PLAN:
- Plan: ${details.selectedTier.charAt(0).toUpperCase() + details.selectedTier.slice(1)}
- Monthly Calls: ${callLimit}
- 24/7 Availability: Yes

Questions? Reply to this email or call ${supportNumber}

---
SilverSupport.ai - Making technology accessible for seniors
    `;
  }

  async logEmailDelivery(recipient, emailType, messageId, status, errorMessage = null) {
    try {
      const client = new Client({
        connectionString: process.env.DATABASE_URL
      });
      
      await client.connect();
      await client.query(`
        INSERT INTO email_logs (recipient_email, email_type, message_id, status, error_message)
        VALUES ($1, $2, $3, $4, $5)
      `, [recipient, emailType, messageId, status, errorMessage]);
      
      await client.end();
    } catch (error) {
      logger.error('Failed to log email delivery:', error);
    }
  }

  getCallLimitForTier(tier) {
    const limits = {
      'basic': 50,
      'premium': 200,
      'family': 500
    };
    return limits[tier] || 50;
  }

  // Health check method for monitoring
  async healthCheck() {
    try {
      if (!this.transporter) {
        return { healthy: false, error: 'Transporter not initialized' };
      }
      
      await this.transporter.verify();
      return { healthy: true, message: 'Email service is operational' };
    } catch (error) {
      return { healthy: false, error: error.message };
    }
  }
}

module.exports = new EmailService();