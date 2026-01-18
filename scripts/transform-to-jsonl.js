const fs = require('fs');
const path = require('path');

/**
 * Transforms directory and FAQ JSON files into JSONL format for HuggingFace dataset
 * Reads standardized directory-{slug}.json and FAQ-{slug}.json pairs
 * Extracts business array from rawResponse JSON string
 * Extracts FAQ array from rawResponse JSON string
 * Combines into single artifact per directory page
 * Generates clean slug from filename
 * Adds metadata (counts, timestamps)
 * Outputs directory-pages-en.jsonl file
 */

async function transformToJsonl() {
  try {
    // Get all directory files from logs/api-responses
    const apiResponsesDir = path.join(__dirname, '..', 'logs', 'api-responses');
    const faqResponsesDir = path.join(__dirname, '..', 'logs', 'faq-responses');

    const directoryFiles = fs.readdirSync(apiResponsesDir)
      .filter(file => file.startsWith('directory-') && file.endsWith('.json'));

    const output = [];

    for (const dirFile of directoryFiles) {
      const slug = extractSlugFromFilename(dirFile);
      const faqFile = `FAQ-${slug}.json`;

      // Read directory file
      const dirContent = JSON.parse(fs.readFileSync(path.join(apiResponsesDir, dirFile), 'utf8'));
      const businesses = extractBusinessesFromRawResponse(dirContent.rawResponse);

      // Read FAQ file if it exists
      let faqs = [];
      if (fs.existsSync(path.join(faqResponsesDir, faqFile))) {
        const faqContent = JSON.parse(fs.readFileSync(path.join(faqResponsesDir, faqFile), 'utf8'));
        faqs = extractFAQsFromRawResponse(faqContent.rawResponse);
      }

      // Create directory page artifact
      const directoryPage = {
        slug: slug,
        title: dirContent.title || `Directory: ${slug}`,
        description: dirContent.description || '',
        businesses: businesses,
        faqs: faqs,
        businessCount: businesses.length,
        faqCount: faqs.length,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      output.push(directoryPage);
    }

    // Write to JSONL file
    const contentDir = path.join(__dirname, '..', 'content');
    const outputPath = path.join(contentDir, 'directory-pages-en.jsonl');
    const jsonlContent = output.map(page => JSON.stringify(page)).join('\n');
    fs.writeFileSync(outputPath, jsonlContent, 'utf8');

    console.log(`Successfully created ${outputPath} with ${output.length} directory pages`);
    return outputPath;

  } catch (error) {
    console.error('Error transforming to JSONL:', error);
    throw error;
  }
}

function extractSlugFromFilename(filename) {
  // Remove prefix and extension, clean up the slug
  const baseName = filename.replace('directory-', '').replace('.json', '');
  return baseName.replace(/[^a-zA-Z0-9\-]/g, '-').toLowerCase();
}

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
    console.error('Error parsing businesses from rawResponse:', error);
    return [];
  }
}

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
    console.error('Error parsing FAQs from rawResponse:', error);
    return [];
  }
}

// Run the transformation
if (require.main === module) {
  transformToJsonl().catch(console.error);
}

module.exports = { transformToJsonl };