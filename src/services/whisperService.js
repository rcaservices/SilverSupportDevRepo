const { OpenAI } = require('openai');
const fs = require('fs');
const https = require('https');
const http = require('http');
const path = require('path');
const logger = require('../utils/logger');

class WhisperService {
  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
  }

  // Wait for a specified number of milliseconds
  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Download audio file from Twilio with authentication and retry logic
  async downloadAudio(url, filename, maxRetries = 3) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        logger.info(`Download attempt ${attempt}/${maxRetries} for: ${url}`);
        
        if (attempt > 1) {
          // Wait longer between retries
          const waitTime = attempt * 2000; // 2s, 4s, 6s
          logger.info(`Waiting ${waitTime}ms before retry...`);
          await this.sleep(waitTime);
        }
        
        const success = await this.attemptDownload(url, filename);
        if (success) {
          return;
        }
      } catch (error) {
        logger.warn(`Download attempt ${attempt} failed: ${error.message}`);
        if (attempt === maxRetries) {
          throw error;
        }
      }
    }
  }

  // Single download attempt
  async attemptDownload(url, filename) {
    return new Promise((resolve, reject) => {
      const file = fs.createWriteStream(filename);
      const protocol = url.startsWith('https:') ? https : http;
      
      // Create basic auth header for Twilio
      const auth = Buffer.from(`${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64');
      
      const options = {
        headers: {
          'Authorization': `Basic ${auth}`,
          'User-Agent': 'AI-Support-Service/1.0'
        }
      };
      
      const request = protocol.get(url, options, (response) => {
        if (response.statusCode === 404) {
          file.close();
          fs.unlink(filename, () => {});
          reject(new Error(`Recording not yet available (HTTP 404) - will retry`));
          return;
        }
        
        if (response.statusCode !== 200) {
          file.close();
          fs.unlink(filename, () => {});
          reject(new Error(`Failed to download audio: HTTP ${response.statusCode} - ${response.statusMessage}`));
          return;
        }
        
        logger.info(`Successfully authenticated with Twilio, downloading audio...`);
        response.pipe(file);
        
        file.on('finish', () => {
          file.close();
          logger.info(`Audio downloaded successfully: ${filename}`);
          resolve(true);
        });
        
        file.on('error', (err) => {
          fs.unlink(filename, () => {});
          reject(err);
        });
      });
      
      request.on('error', (err) => {
        file.close();
        fs.unlink(filename, () => {});
        reject(err);
      });
      
      request.setTimeout(15000, () => {
        request.destroy();
        file.close();
        fs.unlink(filename, () => {});
        reject(new Error('Download timeout'));
      });
    });
  }

  // Transcribe audio using Whisper with Twilio format handling
  async transcribeAudio(audioUrl, language = 'en') {
    try {
      logger.info(`Starting transcription for audio: ${audioUrl}`);
      
      // Wait a bit for Twilio to finish processing the recording
      logger.info('Waiting 3 seconds for Twilio to process recording...');
      await this.sleep(3000);
      
      // Create temp directory if it doesn't exist
      const tempDir = path.join(process.cwd(), 'temp');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
        logger.info(`Created temp directory: ${tempDir}`);
      }
      
      // Twilio recordings are usually in MP3 format
      const tempFilename = path.join(tempDir, `audio_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.mp3`);
      
      // Download audio file with authentication and retry logic
      await this.downloadAudio(audioUrl, tempFilename);
      
      // Check if file exists and has content
      const stats = fs.statSync(tempFilename);
      if (stats.size === 0) {
        throw new Error('Downloaded audio file is empty');
      }
      
      logger.info(`Audio file size: ${stats.size} bytes`);
      
      // Transcribe with Whisper
      const transcription = await this.openai.audio.transcriptions.create({
        file: fs.createReadStream(tempFilename),
        model: 'whisper-1',
        language: language,
        response_format: 'json',
        temperature: 0.2,
        prompt: "This is a customer calling technical support asking for help with billing, internet, or technical issues."
      });
      
      // Clean up temp file
      fs.unlink(tempFilename, (err) => {
        if (err) logger.warn(`Failed to delete temp file: ${err.message}`);
        else logger.info(`Cleaned up temp file: ${tempFilename}`);
      });
      
      const transcribedText = transcription.text.trim();
      logger.info(`Transcription completed: "${transcribedText}"`);
      
      return {
        text: transcribedText,
        language: transcription.language || language,
        confidence: transcribedText.length > 0 ? 0.85 : 0.0
      };
      
    } catch (error) {
      logger.error('Whisper transcription failed:', error);
      
      // If it's a 404 error, provide specific feedback
      if (error.message.includes('404')) {
        logger.error('Recording not found - may be a timing issue with Twilio recording processing');
      }
      
      // Return a fallback response
      return {
        text: "I apologize, but I'm having technical difficulties with the audio processing. Please try speaking more clearly and calling again.",
        language: language,
        confidence: 0.0,
        error: true
      };
    }
  }
}

module.exports = new WhisperService();
