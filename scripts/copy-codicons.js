#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const sourceDir = path.join(__dirname, '..', 'node_modules', '@vscode', 'codicons', 'dist');
const targetDir = path.join(__dirname, '..', 'dist', 'media');

// Create target directory if it doesn't exist
if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
}

// Copy codicon.css and codicon.ttf
const filesToCopy = ['codicon.css', 'codicon.ttf'];

for (const file of filesToCopy) {
  const sourcePath = path.join(sourceDir, file);
  const targetPath = path.join(targetDir, file);
  
  if (fs.existsSync(sourcePath)) {
    fs.copyFileSync(sourcePath, targetPath);
    console.log(`Copied ${file} to dist/media/`);
  } else {
    console.error(`Warning: ${file} not found in ${sourceDir}`);
  }
}

console.log('Codicon assets copied successfully');
