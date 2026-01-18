/**
 * File Standardization Script
 *
 * This script standardizes filenames in logs directories by:
 * 1. Renaming timestamped files to standard format
 * 2. Removing duplicates (keeping latest timestamp)
 * 3. Ensuring every directory- file has matching FAQ- file
 */

const fs = require('fs');
const path = require('path');

// Configuration
const API_RESPONSES_DIR = path.join(__dirname, '..', 'logs', 'api-responses');
const FAQ_RESPONSES_DIR = path.join(__dirname, '..', 'logs', 'faq-responses');

/**
 * Extract base name and timestamp from filename
 * Handles ISO timestamps like "2025-12-19T19-33-57-170Z"
 */
function parseFilename(filename) {
  const withoutExt = filename.replace('.json', '');

  // Check for ISO timestamp pattern
  const isoMatch = withoutExt.match(/^(.+)-(\d{4}-\d{2}-\d{2}T[\d-]+Z)$/);
  if (isoMatch) {
    return {
      baseName: isoMatch[1],
      timestamp: isoMatch[2],
      isTimestamped: true
    };
  }

  // Already standardized (starts with directory- or FAQ-)
  if (withoutExt.startsWith('directory-') || withoutExt.startsWith('FAQ-')) {
    return {
      baseName: withoutExt,
      timestamp: null,
      isTimestamped: false
    };
  }

  // No timestamp found
  return {
    baseName: withoutExt,
    timestamp: null,
    isTimestamped: false
  };
}

/**
 * Standardize filename
 * Convert "coffee shops seattle washington" to "coffee-shops-seattle-washington"
 */
function standardizeName(name) {
  // Remove common prefixes
  name = name.replace(/^(faq-|directory-|FAQ-)/i, '');

  return name
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Convert ISO timestamp string to Date object for comparison
 */
function timestampToDate(timestamp) {
  if (!timestamp) return new Date(0);
  try {
    return new Date(timestamp);
  } catch {
    return new Date(0);
  }
}

/**
 * Group files by standardized base name
 */
function groupFiles(files, isDirectoryFile = true) {
  const groups = {};

  files.forEach(file => {
    const parsed = parseFilename(file);
    const standardized = standardizeName(parsed.baseName);

    if (!groups[standardized]) {
      groups[standardized] = [];
    }

    groups[standardized].push({
      original: file,
      timestamp: parsed.timestamp,
      date: timestampToDate(parsed.timestamp),
      isTimestamped: parsed.isTimestamped
    });
  });

  return groups;
}

/**
 * Process directory files in api-responses
 */
function processApiResponses() {
  console.log('\n=== Processing API Responses (Business Data) ===\n');

  const files = fs.readdirSync(API_RESPONSES_DIR).filter(f => f.endsWith('.json'));
  const groups = groupFiles(files, true);

  for (const [baseName, fileGroup] of Object.entries(groups)) {
    console.log(`Processing group: ${baseName}`);

    // Sort by timestamp (newest first)
    fileGroup.sort((a, b) => b.date - a.date);

    // Keep only the latest version
    const latest = fileGroup[0];
    const standardizedName = `directory-${baseName}.json`;

    console.log(`  Latest file: ${latest.original}`);
    console.log(`  Target name: ${standardizedName}`);

    // Rename if needed
    if (latest.original !== standardizedName) {
      const oldPath = path.join(API_RESPONSES_DIR, latest.original);
      const newPath = path.join(API_RESPONSES_DIR, standardizedName);

      try {
        fs.renameSync(oldPath, newPath);
        console.log(`  ✓ Renamed: ${latest.original} → ${standardizedName}`);
      } catch (error) {
        console.error(`  ✗ Error renaming: ${error.message}`);
      }
    } else {
      console.log(`  ✓ Already standardized`);
    }

    // Remove duplicates (older versions)
    for (let i = 1; i < fileGroup.length; i++) {
      const duplicate = fileGroup[i];
      const duplicatePath = path.join(API_RESPONSES_DIR, duplicate.original);

      try {
        fs.unlinkSync(duplicatePath);
        console.log(`  ✓ Removed duplicate: ${duplicate.original}`);
      } catch (error) {
        console.error(`  ✗ Error removing duplicate: ${error.message}`);
      }
    }

    console.log('');
  }
}

/**
 * Process FAQ files in faq-responses
 */
function processFaqResponses() {
  console.log('\n=== Processing FAQ Responses ===\n');

  const files = fs.readdirSync(FAQ_RESPONSES_DIR).filter(f => f.endsWith('.json'));
  const groups = groupFiles(files, false);

  for (const [baseName, fileGroup] of Object.entries(groups)) {
    console.log(`Processing group: ${baseName}`);

    // Sort by timestamp (newest first)
    fileGroup.sort((a, b) => b.date - a.date);

    // Keep only the latest version
    const latest = fileGroup[0];
    const standardizedName = `FAQ-${baseName}.json`;

    console.log(`  Latest file: ${latest.original}`);
    console.log(`  Target name: ${standardizedName}`);

    // Rename if needed
    if (latest.original !== standardizedName) {
      const oldPath = path.join(FAQ_RESPONSES_DIR, latest.original);
      const newPath = path.join(FAQ_RESPONSES_DIR, standardizedName);

      try {
        fs.renameSync(oldPath, newPath);
        console.log(`  ✓ Renamed: ${latest.original} → ${standardizedName}`);
      } catch (error) {
        console.error(`  ✗ Error renaming: ${error.message}`);
      }
    } else {
      console.log(`  ✓ Already standardized`);
    }

    // Remove duplicates (older versions)
    for (let i = 1; i < fileGroup.length; i++) {
      const duplicate = fileGroup[i];
      const duplicatePath = path.join(FAQ_RESPONSES_DIR, duplicate.original);

      try {
        fs.unlinkSync(duplicatePath);
        console.log(`  ✓ Removed duplicate: ${duplicate.original}`);
      } catch (error) {
        console.error(`  ✗ Error removing duplicate: ${error.message}`);
      }
    }

    console.log('');
  }
}

/**
 * Summary report
 */
function showSummary() {
  console.log('\n=== Summary ===\n');

  const apiFiles = fs.readdirSync(API_RESPONSES_DIR).filter(f => f.endsWith('.json'));
  const faqFiles = fs.readdirSync(FAQ_RESPONSES_DIR).filter(f => f.endsWith('.json'));

  console.log(`Directory files (api-responses): ${apiFiles.length}`);
  apiFiles.forEach(f => console.log(`  - ${f}`));

  console.log(`\nFAQ files (faq-responses): ${faqFiles.length}`);
  faqFiles.forEach(f => console.log(`  - ${f}`));

  console.log('\nFile standardization complete! 🎉');
}

// Run the script
console.log('Starting file standardization...\n');
processApiResponses();
processFaqResponses();
showSummary();
