/**
 * HuggingFace Upload Script
 *
 * This script uploads individual JSON files to HuggingFace dataset in organized folders:
 * - Directories/ folder: Business data extracted from api-responses
 * - FAQ/ folder: FAQ data extracted from faq-responses
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Configuration
const API_RESPONSES_DIR = path.join(__dirname, '..', 'logs', 'api-responses');
const FAQ_RESPONSES_DIR = path.join(__dirname, '..', 'logs', 'faq-responses');
const OUTPUT_DIR = path.join(__dirname, '..', 'content', 'hf-upload');
const HF_REPO = 'Offren/directory-pages';

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

/**
 * Extract slug from filename
 * "directory-coffee-shops-seattle.json" -> "coffee-shops-seattle"
 */
function extractSlug(filename) {
  return filename
    .replace('directory-', '')
    .replace('FAQ-', '')
    .replace('.json', '');
}

/**
 * Extract businesses from rawResponse with ID generation
 */
function extractBusinessesFromRawResponse(rawResponse) {
  try {
    if (!rawResponse) return [];

    // Parse the outer JSON string
    const parsed = JSON.parse(rawResponse);

    // Navigate to the content field
    const content = parsed.choices?.[0]?.message?.content;
    if (!content) return [];

    // Extract JSON from markdown code block
    const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
    if (!jsonMatch) return [];

    // Parse the business array and add IDs
    const businesses = JSON.parse(jsonMatch[1]);
    if (Array.isArray(businesses)) {
      return businesses.map((business, index) => ({
        id: `${business.name?.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${index}`,
        ...business
      }));
    }
    return [];
  } catch (error) {
    console.error('Error parsing businesses from rawResponse:', error.message);
    return [];
  }
}

/**
 * Extract FAQs from rawResponse with ID generation
 */
function extractFAQsFromRawResponse(rawResponse) {
  try {
    if (!rawResponse) return [];

    // Parse the outer JSON string
    const parsed = JSON.parse(rawResponse);

    // Navigate to the content field
    const content = parsed.choices?.[0]?.message?.content;
    if (!content) return [];

    // Extract JSON from markdown code block
    const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
    if (!jsonMatch) return [];

    // Parse the FAQ array and add IDs
    const faqs = JSON.parse(jsonMatch[1]);
    if (Array.isArray(faqs)) {
      return faqs.map((faq, index) => ({
        id: `faq-${index}`,
        ...faq
      }));
    }
    return [];
  } catch (error) {
    console.error('Error parsing FAQs from rawResponse:', error.message);
    return [];
  }
}

/**
 * Create title from slug
 * "coffee-shops-seattle" -> "Coffee Shops Seattle"
 */
function slugToTitle(slug) {
  return slug
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Process directory files and create clean JSON for upload
 */
function processDirectoryFiles() {
  console.log('\n=== Processing Directory Files ===\n');

  const files = fs.readdirSync(API_RESPONSES_DIR)
    .filter(f => f.startsWith('directory-') && f.endsWith('.json'));

  const results = [];

  for (const file of files) {
    const slug = extractSlug(file);
    console.log(`Processing: ${file} -> ${slug}`);

    try {
      const filePath = path.join(API_RESPONSES_DIR, file);
      const fileContent = JSON.parse(fs.readFileSync(filePath, 'utf8'));

      const businesses = extractBusinessesFromRawResponse(fileContent.rawResponse);

      const directoryData = {
        slug: slug,
        title: fileContent.title || slugToTitle(slug),
        description: fileContent.description || '',
        businesses: businesses,
        businessCount: businesses.length,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      // Write to output directory
      const outputPath = path.join(OUTPUT_DIR, `${slug}.json`);
      fs.writeFileSync(outputPath, JSON.stringify(directoryData, null, 2), 'utf8');
console.log(`  ✓ Created: ${slug}.json (${businesses.length} businesses)`);

      results.push({ slug, file: outputPath, count: businesses.length });
    } catch (error) {
      console.error(`  ✗ Error processing ${file}:`, error.message);
    }
  }

  return results;
}

/**
 * Process FAQ files and create clean JSON for upload
 */
function processFAQFiles() {
  console.log('\n=== Processing FAQ Files ===\n');

  const files = fs.readdirSync(FAQ_RESPONSES_DIR)
    .filter(f => f.startsWith('FAQ-') && f.endsWith('.json'));

  const results = [];

  for (const file of files) {
    const slug = extractSlug(file);
    console.log(`Processing: ${file} -> ${slug}`);

    try {
      const filePath = path.join(FAQ_RESPONSES_DIR, file);
      const fileContent = JSON.parse(fs.readFileSync(filePath, 'utf8'));

      const faqs = extractFAQsFromRawResponse(fileContent.rawResponse);

      const faqData = {
        slug: slug,
        faqs: faqs,
        faqCount: faqs.length,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      // Write to output directory
      const outputPath = path.join(OUTPUT_DIR, `${slug}-faq.json`);
      fs.writeFileSync(outputPath, JSON.stringify(faqData, null, 2), 'utf8');
      console.log(`  ✓ Created: ${slug}-faq.json (${faqs.length} FAQs)`);

      results.push({ slug, file: outputPath, count: faqs.length });
    } catch (error) {
      console.error(`  ✗ Error processing ${file}:`, error.message);
    }
  }

  return results;
}

/**
 * Upload files to HuggingFace using hf CLI
 */
function uploadToHuggingFace(directoryFiles, faqFiles) {
  console.log('\n=== Uploading to HuggingFace ===\n');

  // Upload directory files
  console.log('Uploading directory files to Directories/ folder...\n');
  for (const { slug, file } of directoryFiles) {
    try {
      const targetPath = `Directories/${slug}.json`;
      console.log(`Uploading ${slug}.json...`);
      execSync(`hf upload ${HF_REPO} "${file}" "${targetPath}"`, { stdio: 'inherit' });
      console.log(`  ✓ Uploaded to ${targetPath}\n`);
    } catch (error) {
      console.error(`  ✗ Error uploading ${slug}:`, error.message);
    }
  }

  // Upload FAQ files
  console.log('\nUploading FAQ files to FAQ/ folder...\n');
  for (const { slug, file } of faqFiles) {
    try {
      const targetPath = `FAQ/${slug}.json`;
      console.log(`Uploading ${slug}.json...`);
      execSync(`hf upload ${HF_REPO} "${file}" "${targetPath}"`, { stdio: 'inherit' });
      console.log(`  ✓ Uploaded to ${targetPath}\n`);
    } catch (error) {
      console.error(`  ✗ Error uploading ${slug}:`, error.message);
    }
  }
}

/**
 * Show summary
 */
function showSummary(directoryFiles, faqFiles) {
  console.log('\n=== Upload Summary ===\n');

  console.log(`Directory files uploaded: ${directoryFiles.length}`);
  directoryFiles.forEach(({ slug, count }) => {
    console.log(`  - Directories/${slug}.json (${count} businesses)`);
  });

  console.log(`\nFAQ files uploaded: ${faqFiles.length}`);
  faqFiles.forEach(({ slug, count }) => {
    console.log(`  - FAQ/${slug}.json (${count} FAQs)`);
  });

  console.log('\nHuggingFace dataset structure:');
  console.log(`  ${HF_REPO}/`);
  console.log(`  ├── Directories/`);
  directoryFiles.forEach(({ slug }) => {
    console.log(`  │   ├── ${slug}.json`);
  });
  console.log(`  └── FAQ/`);
  faqFiles.forEach(({ slug }) => {
    console.log(`      ├── ${slug}.json`);
  });

  console.log('\nUpload complete! 🎉');
  console.log(`View dataset: https://huggingface.co/datasets/${HF_REPO}`);
}

// Run the script
console.log(`Starting HuggingFace upload to ${HF_REPO}...\n`);

const directoryFiles = processDirectoryFiles();
const faqFiles = processFAQFiles();

console.log('\n=== Generated Files ===\n');
console.log(`Output directory: ${OUTPUT_DIR}`);
console.log(`Total files created: ${directoryFiles.length + faqFiles.length}`);

// Upload to HuggingFace
uploadToHuggingFace(directoryFiles, faqFiles);

// Show summary
showSummary(directoryFiles, faqFiles);
