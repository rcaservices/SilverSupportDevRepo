// File: src/utils/version.js
// Version management following cPanel odd/even convention

const VERSION = {
    MAJOR: 1,
    MINOR: 1,   // ODD = Development/Alpha, EVEN = Production/Stable
    BUILD: 0,
    PATCH: 0
  };
  
  class VersionManager {
    static get current() {
      return `${VERSION.MAJOR}.${VERSION.MINOR}.${VERSION.BUILD}.${VERSION.PATCH}`;
    }
  
    static get short() {
      // For display purposes, can omit patch if 0
      if (VERSION.PATCH === 0) {
        return `${VERSION.MAJOR}.${VERSION.MINOR}.${VERSION.BUILD}`;
      }
      return this.current;
    }
  
    static get info() {
      return {
        version: this.current,
        major: VERSION.MAJOR,
        minor: VERSION.MINOR,
        build: VERSION.BUILD,
        patch: VERSION.PATCH,
        isDevelopment: VERSION.MINOR % 2 === 1, // Odd = development
        isStable: VERSION.MINOR % 2 === 0,      // Even = stable
        releaseType: VERSION.MINOR % 2 === 1 ? 'development' : 'stable',
        buildDate: new Date().toISOString()
      };
    }
  
    static get releaseNotes() {
      const releases = {
        '1.1.0.0': {
          title: 'Initial Alpha Release',
          date: '2025-08-02',
          type: 'alpha',
          features: [
            'Voice authentication system',
            'Basic call handling with Twilio',
            'AI-powered support responses',
            'Simple user registration'
          ],
          improvements: [],
          bugFixes: [],
          knownIssues: [
            'Voice recognition accuracy needs improvement',
            'Limited error handling for failed calls',
            'Basic analytics only'
          ]
        },
        '1.1.1.0': {
          title: 'Enhanced Voice Recognition',
          date: 'TBD',
          type: 'alpha',
          features: [
            'Improved voice biometric matching',
            'Multiple voice sample support',
            'Voice confidence scoring'
          ],
          improvements: [
            'Better noise filtering',
            'Faster voice processing'
          ],
          bugFixes: [
            'Fixed authentication timeout issues',
            'Resolved concurrent call handling'
          ],
          knownIssues: [
            'Family dashboard UI needs polish',
            'Billing calculations need validation'
          ]
        }
      };
      
      return releases[this.current] || {
        title: 'Development Version',
        date: new Date().toISOString().split('T')[0],
        type: this.info.releaseType,
        features: [],
        improvements: [],
        bugFixes: [],
        knownIssues: []
      };
    }
  
    static increment(type = 'build') {
      switch (type.toLowerCase()) {
        case 'major':
          VERSION.MAJOR++;
          VERSION.MINOR = 1; // Reset to odd for new development cycle
          VERSION.BUILD = 0;
          VERSION.PATCH = 0;
          break;
        case 'minor':
          VERSION.MINOR++;
          VERSION.BUILD = 0;
          VERSION.PATCH = 0;
          break;
        case 'build':
          VERSION.BUILD++;
          VERSION.PATCH = 0;
          break;
        case 'patch':
          VERSION.PATCH++;
          break;
        default:
          throw new Error('Invalid version type. Use: major, minor, build, or patch');
      }
    }
  
    static toStable() {
      if (VERSION.MINOR % 2 === 1) {
        // Convert from odd (development) to even (stable)
        VERSION.MINOR++;
        VERSION.BUILD = 0;
        VERSION.PATCH = 0;
        return true;
      }
      return false; // Already stable
    }
  
    static compare(otherVersion) {
      const [otherMajor, otherMinor, otherBuild, otherPatch] = 
        otherVersion.split('.').map(Number);
      
      if (VERSION.MAJOR !== otherMajor) return VERSION.MAJOR - otherMajor;
      if (VERSION.MINOR !== otherMinor) return VERSION.MINOR - otherMinor;
      if (VERSION.BUILD !== otherBuild) return VERSION.BUILD - otherBuild;
      return VERSION.PATCH - (otherPatch || 0);
    }
  
    static isCompatible(clientVersion, serverVersion = this.current) {
      const [clientMajor, clientMinor] = clientVersion.split('.').map(Number);
      const [serverMajor, serverMinor] = serverVersion.split('.').map(Number);
      
      // Same major version required
      if (clientMajor !== serverMajor) return false;
      
      // For alpha/development versions, be more strict
      if (serverMinor % 2 === 1) {
        return clientMinor === serverMinor;
      }
      
      // For stable versions, allow backward compatibility within minor version
      return clientMinor <= serverMinor;
    }
  }
  
  // Export for use throughout the application
  module.exports = VersionManager;
  
  // CLI usage for release management
  if (require.main === module) {
    const command = process.argv[2];
    const type = process.argv[3];
    
    switch (command) {
      case 'current':
        console.log(VersionManager.current);
        break;
      case 'info':
        console.log(JSON.stringify(VersionManager.info, null, 2));
        break;
      case 'increment':
        VersionManager.increment(type);
        console.log(`Version incremented to: ${VersionManager.current}`);
        break;
      case 'stable':
        if (VersionManager.toStable()) {
          console.log(`Converted to stable version: ${VersionManager.current}`);
        } else {
          console.log(`Already stable: ${VersionManager.current}`);
        }
        break;
      case 'notes':
        const notes = VersionManager.releaseNotes;
        console.log(`\n${notes.title} (${notes.type})`);
        console.log(`Version: ${VersionManager.current}`);
        console.log(`Date: ${notes.date}\n`);
        
        if (notes.features.length) {
          console.log('Features:');
          notes.features.forEach(f => console.log(`  - ${f}`));
          console.log();
        }
        
        if (notes.improvements.length) {
          console.log('Improvements:');
          notes.improvements.forEach(i => console.log(`  - ${i}`));
          console.log();
        }
        
        if (notes.bugFixes.length) {
          console.log('Bug Fixes:');
          notes.bugFixes.forEach(b => console.log(`  - ${b}`));
          console.log();
        }
        
        if (notes.knownIssues.length) {
          console.log('Known Issues:');
          notes.knownIssues.forEach(k => console.log(`  - ${k}`));
        }
        break;
      default:
        console.log(`
  Usage: node version.js <command> [type]
  
  Commands:
    current     - Show current version
    info        - Show detailed version info
    increment   - Increment version (major|minor|build|patch)
    stable      - Convert to stable version (odd->even)
    notes       - Show release notes
  
  Examples:
    node version.js current
    node version.js increment build
    node version.js stable
        `);
    }
  }