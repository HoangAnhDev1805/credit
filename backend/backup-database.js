// Script to backup MongoDB database
require('dotenv').config();
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

const BACKUP_DIR = path.join(__dirname, 'database-backup');
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/creditchecker';

// Extract database name from URI
const dbName = MONGODB_URI.split('/').pop().split('?')[0];

// Create backup directory if not exists
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupPath = path.join(BACKUP_DIR, `backup-${timestamp}`);

console.log('Starting MongoDB backup...');
console.log('Database:', dbName);
console.log('Backup path:', backupPath);

const cmd = `mongodump --uri="${MONGODB_URI}" --out="${backupPath}"`;

exec(cmd, (error, stdout, stderr) => {
  if (error) {
    console.error('Backup failed:', error);
    console.error(stderr);
    process.exit(1);
  }
  
  console.log('Backup completed successfully!');
  console.log(stdout);
  console.log('\nBackup location:', backupPath);
  console.log('\nTo restore this backup on another server:');
  console.log(`mongorestore --uri="mongodb://localhost:27017/${dbName}" "${backupPath}/${dbName}"`);
  
  process.exit(0);
});
