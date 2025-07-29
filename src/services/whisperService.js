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

  // Download audio file from URL with better error handling
  async downloadAudio(url, filename) {
    return new Promise((resolve, reject) => {
      const file = fs.createWriteStream(filename);
      const protocol = url.startsWith('https:') ? https : http;
      
      logger.info(`Downloading audio from: ${url}`);
      
      const request = protocol.get(url, (response) => {
        if (response.statusCode !== 200) {
          reject(new Error(`Failed to download audio: HTTP ${response.statusCode}`));
          return;
        }
        
        response.pipe(file);
        
        file.on('finish', () => {
          file.close();
          logger.info(`Audio downloaded successfully: ${filename}`);
          resolve();
        });
        
        file.on('error', (err) => {
          fs.unlink(filename, () => {}); // Delete partial file
          reject(err);
        });
      });
      
      request.on('error', (err) => {
        fs.unlink(filename, () => {}); // Delete partial file
        reject(err);
      });
      
      request.setTimeout(30000, () => {
        request.destroy();
        fs.unlink(filename, () => {});
        reject(new Error('Download timeout'));
      });
    });
  }

  // Transcribe audio using Whisper with Twilio format handling
  async transcribeAudio(audioUrl, language = 'en') {
    try {
      logger.info(`Starting transcription for audio: ${audioUrl}`);
      
      // Create temp directory if it doesn't exist
      const tempDir = path.join(process.cwd(), 'temp');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
        logger.info(`Created temp directory: ${tempDir}`);
      }
      
      // Twilio recordings are usually in WAV format, but let's use .mp3 extension for Whisper
      const tempFilename = path.join(tempDir, `audio_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.mp3`);
      
      // Download audio file
      await this.downloadAudio(audioUrl, tempFilename);
      
      // Check if file exists and has content
      const stats = fs.statSync(tempFilename);
      if (stats.size === 0) {
        throw new Error('Downloaded audio file is empty');
      }
      
      logger.info(`Audio file size: ${stats.size} bytes`);
      
      // Transcribe with Whisper - let Whisper auto-detect the format
      const transcription = await this.openai.audio.transcriptions.create({
        file: fs.createReadStream(tempFilename),
        model: 'whisper-1',
        language: language,
        response_format: 'json',
        temperature: 0.2,
        prompt: "This is a customer calling technical support asking for help." // Context helps accuracy
      });
      
      // Clean up temp file
      fs.unlink(tempFilename, (err) => {
        if (err) logger.warn(`Failed to delete temp file: ${err.message}`);
        else logger.info(`Cleaned up temp file: ${tempFilename}`);
      });
      
      logger.info(`Transcription completed: "${transcription.text}"`);
      
      return {
        text: transcription.text.trim(),
        language: transcription.language || language,
        confidence: 0.85
      };
      
    } catch (error) {
      logger.error('Whisper transcription failed:', error);
      
      // If it's a format issue, try downloading as different extension
      if (error.message.includes('Invalid file format')) {
        logger.info('Trying alternative file format...');
        return await this.transcribeAudioAlternative(audioUrl, language);
      }
      
      // Return a fallback response instead of throwing
      return {
        text: "I'm sorry, I couldn't understand what you said. Could you please repeat your question more clearly?",
        language: language,
        confidence: 0.0,
        error: true
      };
    }
  }

  // Alternative method with different file extension
  async transcribeAudioAlternative(audioUrl, language = 'en') {
    try {
      const tempDir = path.join(process.cwd(), 'temp');
      const tempFilename = path.join(tempDir, `audio_alt_${Date.now()}.wav`);
      
      await this.downloadAudio(audioUrl, tempFilename);
      
      const transcription = await this.openai.audio.transcriptions.create({
        file: fs.createReadStream(tempFilename),
        model: 'whisper-1',
        language: language,
        response_format: 'json',
        temperature: 0.2
      });
      
      fs.unlink(tempFilename, () => {});
      
      logger.info(`Alternative transcription completed: "${transcription.text}"`);
      
      return {
        text: transcription.text.trim(),
        language: transcription.language || language,
        confidence: 0.85
      };
      
    } catch (error) {
      logger.error('Alternative transcription also failed:', error);
      return {
        text: "I apologize, but I'm having trouble with the audio quality. Could you please speak more clearly and try again?",
        language: language,
        confidence: 0.0,
        error: true
      };
    }
  }
}

module.exports = new WhisperService();
