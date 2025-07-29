const { OpenAI } = require('openai');
const fs = require('fs');
const https = require('https');
const path = require('path');
const logger = require('../utils/logger');

class WhisperService {
  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
  }

  // Download audio file from URL
  async downloadAudio(url, filename) {
    return new Promise((resolve, reject) => {
      const file = fs.createWriteStream(filename);
      
      https.get(url, (response) => {
        response.pipe(file);
        
        file.on('finish', () => {
          file.close(resolve);
        });
        
        file.on('error', (err) => {
          fs.unlink(filename, () => {}); // Delete partial file
          reject(err);
        });
      }).on('error', reject);
    });
  }

  // Transcribe audio using Whisper
  async transcribeAudio(audioUrl, language = 'en') {
    try {
      logger.info(`Starting transcription for audio: ${audioUrl}`);
      
      // Create temp directory if it doesn't exist
      const tempDir = path.join(__dirname, '../../temp');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      
      // Download audio file
      const tempFilename = path.join(tempDir, `audio_${Date.now()}.wav`);
      await this.downloadAudio(audioUrl, tempFilename);
      
      // Transcribe with Whisper
      const transcription = await this.openai.audio.transcriptions.create({
        file: fs.createReadStream(tempFilename),
        model: 'whisper-1',
        language: language,
        response_format: 'verbose_json',
        temperature: 0.2
      });
      
      // Clean up temp file
      fs.unlink(tempFilename, (err) => {
        if (err) logger.warn(`Failed to delete temp file: ${err.message}`);
      });
      
      logger.info(`Transcription completed: "${transcription.text}"`);
      
      return {
        text: transcription.text,
        language: transcription.language,
        duration: transcription.duration,
        confidence: this.calculateConfidence(transcription.segments || [])
      };
      
    } catch (error) {
      logger.error('Whisper transcription failed:', error);
      throw new Error(`Transcription failed: ${error.message}`);
    }
  }

  // Calculate average confidence from segments
  calculateConfidence(segments) {
    if (!segments || segments.length === 0) return 0.85; // Default confidence
    
    const avgConfidence = segments.reduce((sum, segment) => {
      return sum + (segment.avg_logprob || 0);
    }, 0) / segments.length;
    
    // Convert log probability to confidence percentage
    return Math.max(0, Math.min(1, Math.exp(avgConfidence)));
  }

  // Clean up old temp files
  cleanupTempFiles() {
    const tempDir = path.join(__dirname, '../../temp');
    if (!fs.existsSync(tempDir)) return;
    
    fs.readdir(tempDir, (err, files) => {
      if (err) return;
      
      const oneHourAgo = Date.now() - (60 * 60 * 1000);
      
      files.forEach(file => {
        const filePath = path.join(tempDir, file);
        fs.stat(filePath, (err, stats) => {
          if (err) return;
          
          if (stats.mtime.getTime() < oneHourAgo) {
            fs.unlink(filePath, () => {});
          }
        });
      });
    });
  }
}

module.exports = new WhisperService();
