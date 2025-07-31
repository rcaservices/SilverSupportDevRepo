// File: src/utils/emailService.js
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
      this.transporter = nodemailer.createTransporter({
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
        <style>
          body { 
            font-family: Arial, sans-serif; 
            line-height: 1.6; 
            color: #333; 
            margin: 0; 
            padding: 0; 
            background-color: #f4f4f4;
          }
          .container { 
            max-width: 600px; 
            margin: 0 auto; 
            background-color: white;
            box-shadow: 0 0 10px rgba(0,0,0,0.1);
          }
          .header { 
            background: linear-gradient(135deg, #667eea, #764ba2); 
            color: white; 
            padding: 30px; 
            text-align: center; 
            border-radius: 0;
          }
          .header h1 {
            margin: 0 0 10px 0;
            font-size: 28px;
          }
          .header p {
            margin: 0;
            font-size: 16px;
            opacity: 0.9;
          }
          .content { 
            padding: 30px; 
            background: white;
          }
          .cta-button { 
            background: #667eea; 
            color: white !important; 
            padding: 15px 30px; 
            text-decoration: none; 
            border-radius: 5px; 
            display: inline-block; 
            margin: 20px 0;
            font-weight: bold;
          }
          .steps { 
            background: #f8f9fa; 
            padding: 20px; 
            border-radius: 8px; 
            margin: 20px 0; 
            border: 1px solid #e9ecef;
          }
          .step { 
            margin: 15px 0; 
            padding: 15px; 
            border-left: 4px solid #667eea; 
            background: white;
            border-radius: 0 4px 4px 0;
          }
          .step strong {
            color: #667eea;
          }
          .plan-details {
            background: #e3f2fd;
            padding: 20px;
            border-radius: 8px;
            margin: 20px 0;
            border: 1px solid #bbdefb;
          }
          .footer {
            background: #f8f9fa;
            padding: 20px;
            text-align: center;
            border-top: 1px solid #e9ecef;
            font-size: 14px;
            color: #666;
          }
          .phone-number {
            font-size: 18px;
            font-weight: bold;
            color: #667eea;
            background: #f0f4ff;
            padding: 10px;
            border-radius: 5px;
            display: inline-block;
            margin: 5px 0;
          }
          ul {
            padding-left: 20px;
          }
          li {
            margin: 8px 0;
          }
          .warning {
            background: #fff3cd;
            border: 1px solid #ffeaa7;
            padding: 15px;
            border-radius: 5px;
            margin: 20px 0;
            color: #856404;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎉 ${seniorName} is all signed up!</h1>
            <p>Welcome to SilverSupport.ai - AI Technical Support for Seniors</p>
          </div>
          
          <div class="content">
            <p>Great news! We've successfully set up <strong>${seniorName}</strong> in our system with the <strong>${details.selectedTier}</strong> plan.</p>
            
            <div class="steps">
              <h3>📞 Next Steps (Important!)</h3>
              <div class="step">
                <strong>Step 1:</strong> Have ${seniorName} call 
                <div class="phone-number">${supportNumber}</div>
              </div>
              <div class="step">
                <strong>Step 2:</strong> We'll guide them through a quick 5-minute voice enrollment - no passwords needed!
              </div>
              <div class="step">
                <strong>Step 3:</strong> They're ready to get help anytime by just calling and talking naturally!
              </div>
            </div>
            
            <h3>🤖 What ${seniorName} should expect:</h3>
            <ul>
              <li>A friendly AI that learns and recognizes their voice</li>
              <li>No passwords, buttons, or complicated menus</li>
              <li>Help with computers, tablets, phones, WiFi, and more</li>
              <li>Patient, senior-friendly support that never rushes</li>
              <li>Seamless transfer to human agents when needed</li>
            </ul>
            
            <div class="plan-details">
              <h3>📋 Your Plan Details</h3>
              <ul>
                <li><strong>Plan:</strong> ${details.selectedTier.charAt(0).toUpperCase() + details.selectedTier.slice(1)}</li>
                <li><strong>Monthly AI Calls:</strong> ${callLimit}</li>
                <li><strong>Enrollment Expires:</strong> ${new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString()}</li>
                <li><strong>24/7 Availability:</strong> Yes</li>
                <li><strong>Human Backup:</strong> Always available</li>
              </ul>
            </div>
            
            <div style="text-align: center;">
              <a href="${websiteUrl}/dashboard" class="cta-button">View Family Dashboard</a>
            </div>
            
            <div class="warning">
              <strong>⏰ Important:</strong> This enrollment expires in 30 days if not completed. ${seniorName} can call anytime to get started!
            </div>
            
            <p><strong>Questions?</strong> Reply to this email or call ${supportNumber}</p>
          </div>
          
          <div class="footer">
            <p>This email was sent to ${familyEmail} regarding ${seniorName}'s SilverSupport.ai enrollment.</p>
            <p>SilverSupport.ai - Making technology accessible for seniors</p>
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

WHAT ${seniorName} SHOULD EXPECT:
- A friendly AI that learns and recognizes their voice
- No passwords, buttons, or complicated menus  
- Help with computers, tablets, phones, WiFi, and more
- Patient, senior-friendly support that never rushes
- Seamless transfer to human agents when needed

YOUR PLAN DETAILS:
- Plan: ${details.selectedTier.charAt(0).toUpperCase() + details.selectedTier.slice(1)}
- Monthly AI Calls: ${callLimit}
- Enrollment Expires: ${new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString()}
- 24/7 Availability: Yes
- Human Backup: Always available

⏰ IMPORTANT: This enrollment expires in 30 days if not completed.

Questions? Reply to this email or call ${supportNumber}

---
SilverSupport.ai - Making technology accessible for seniors
    `;
  }

  async sendSuspiciousActivityAlert(details) {
    try {
      const alertEmail = process.env.ALERT_EMAIL;
      if (!alertEmail || !this.transporter) {
        return;
      }

      const mailOptions = {
        from: {
          name: 'SilverSupport.ai Security',
          address: process.env.FROM_EMAIL || 'alerts@silversupport.ai'
        },
        to: alertEmail,
        subject: '🚨 Suspicious Activity Detected - SilverSupport.ai',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: #f44336; color: white; padding: 20px; text-align: center;">
              <h2>🚨 Security Alert</h2>
            </div>
            <div style="padding: 20px; background: #f9f9f9;">
              <h3>Suspicious Activity Detected</h3>
              <table style="width: 100%; border-collapse: collapse;">
                <tr style="background: white;">
                  <td style="padding: 10px; border: 1px solid #ddd;"><strong>IP Address:</strong></td>
                  <td style="padding: 10px; border: 1px solid #ddd;">${details.ip}</td>
                </tr>
                <tr style="background: #f9f9f9;">
                  <td style="padding: 10px; border: 1px solid #ddd;"><strong>Activity Count:</strong></td>
                  <td style="padding: 10px; border: 1px solid #ddd;">${details.activities.length}</td>
                </tr>
                <tr style="background: white;">
                  <td style="padding: 10px; border: 1px solid #ddd;"><strong>Time Window:</strong></td>
                  <td style="padding: 10px; border: 1px solid #ddd;">Last hour</td>
                </tr>
                <tr style="background: #f9f9f9;">
                  <td style="padding: 10px; border: 1px solid #ddd;"><strong>Reasons:</strong></td>
                  <td style="padding: 10px; border: 1px solid #ddd;">${details.activities.map(a => a.reason).join(', ')}</td>
                </tr>
                <tr style="background: white;">
                  <td style="padding: 10px; border: 1px solid #ddd;"><strong>Action Taken:</strong></td>
                  <td style="padding: 10px; border: 1px solid #ddd; color: ${details.blocked ? 'red' : 'orange'};">
                    ${details.blocked ? '🚫 IP Blocked' : '👀 Monitoring'}
                  </td>
                </tr>
              </table>
              <div style="margin-top: 20px; padding: 15px; background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 5px;">
                <strong>Recommendation:</strong> Review logs and consider additional security measures if this continues.
              </div>
            </div>
          </div>
        `,
        text: `
🚨 SECURITY ALERT - SilverSupport.ai

Suspicious Activity Detected:
- IP Address: ${details.ip}
- Activity Count: ${details.activities.length}
- Time Window: Last hour
- Reasons: ${details.activities.map(a => a.reason).join(', ')}
- Action Taken: ${details.blocked ? 'IP Blocked' : 'Monitoring'}

Recommendation: Review logs and consider additional security measures if this continues.
        `
      };

      const result = await this.transporter.sendMail(mailOptions);
      await this.logEmailDelivery(alertEmail, 'security_alert', result.messageId, 'sent');
      
      logger.info('Suspicious activity alert sent', { messageId: result.messageId });
    } catch (error) {
      logger.error('Failed to send suspicious activity alert', error);
    }
  }

  async sendWelcomeEmail(subscriberEmail, subscriberName, accountDetails) {
    try {
      if (!this.transporter) {
        throw new Error('Email transporter not initialized');
      }

      const mailOptions = {
        from: {
          name: 'SilverSupport.ai',
          address: process.env.FROM_EMAIL || 'support@silversupport.ai'
        },
        to: subscriberEmail,
        subject: `Welcome to SilverSupport.ai, ${subscriberName}! You're all set up.`,
        html: this.generateWelcomeHTML(subscriberName, accountDetails),
        text: this.generateWelcomeText(subscriberName, accountDetails)
      };

      const result = await this.transporter.sendMail(mailOptions);
      await this.logEmailDelivery(subscriberEmail, 'welcome', result.messageId, 'sent');
      
      logger.info('Welcome email sent', {
        messageId: result.messageId,
        to: subscriberEmail,
        subscriberName
      });

      return { success: true, messageId: result.messageId };
    } catch (error) {
      await this.logEmailDelivery(subscriberEmail, 'welcome', null, 'failed', error.message);
      logger.error('Failed to send welcome email', error);
      return { success: false, error: error.message };
    }
  }

  generateWelcomeHTML(subscriberName, details) {
    const supportNumber = process.env.SUPPORT_PHONE_NUMBER || '1-800-SUPPORT';
    
    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Welcome to SilverSupport.ai</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f4f4f4; }
          .container { max-width: 600px; margin: 0 auto; background-color: white; box-shadow: 0 0 10px rgba(0,0,0,0.1); }
          .header { background: linear-gradient(135deg, #28a745, #20c997); color: white; padding: 30px; text-align: center; }
          .content { padding: 30px; }
          .phone-number { font-size: 18px; font-weight: bold; color: #28a745; background: #f0fff4; padding: 10px; border-radius: 5px; display: inline-block; margin: 5px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎉 Welcome ${subscriberName}!</h1>
            <p>Your voice enrollment is complete - you're ready for AI support!</p>
          </div>
          <div class="content">
            <p>Congratulations! Your voice has been enrolled and you can now get technical support anytime by simply calling:</p>
            <div class="phone-number">${supportNumber}</div>
            
            <h3>🎯 How it works:</h3>
            <ul>
              <li>Just call and speak naturally - no buttons to press</li>
              <li>Our AI recognizes your voice automatically</li>
              <li>Get help with computers, phones, tablets, and more</li>
              <li>If needed, we'll connect you to a human expert</li>
            </ul>
            
            <p>That's it! Technology support is now just a phone call away.</p>
            
            <p><strong>Questions?</strong> Just call ${supportNumber} - we're here 24/7!</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  generateWelcomeText(subscriberName, details) {
    const supportNumber = process.env.SUPPORT_PHONE_NUMBER || '1-800-SUPPORT';
    
    return `
🎉 Welcome ${subscriberName}!

Your voice enrollment is complete - you're ready for AI support!

Congratulations! Your voice has been enrolled and you can now get technical support anytime by simply calling: ${supportNumber}

HOW IT WORKS:
- Just call and speak naturally - no buttons to press
- Our AI recognizes your voice automatically  
- Get help with computers, phones, tablets, and more
- If needed, we'll connect you to a human expert

That's it! Technology support is now just a phone call away.

Questions? Just call ${supportNumber} - we're here 24/7!

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