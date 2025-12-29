#!/usr/bin/env tsx

/**
 * Transform exported data to HuggingFace JSONL format with flat locale fields
 * 
 * This script transforms the exported Sanity data to HuggingFace JSONL format:
 * - Convert Sanity _id to clean id format (e.g., "prod-001")
 * - Flatten localized fields: `desc.en` → `desc_en`
 * - Convert references: `category._ref` → `category_id`
 * - Transform Portable Text to simplified JSON
 * 
 * Usage: pnpm tsx scripts/transform-to-hf.ts
 */

// Use Node.js built-in modules with proper typing
import * as fs from 'fs';
import * as path from 'path';

// Import types from the export script
import { ExportedData, ExportedProduct, ExportedCategory, ExportedGroup } from './export-from-sanity';

// Define HuggingFace compatible types
interface HFProduct {
  id: string;
  type: 'product';
  name: string;
  desc_en: string;
  desc_zh?: string;
  date: string;
  status: 'draft' | 'published';
  visible: boolean;
  featured: boolean;
  category_id?: string;
  category_name?: string;
  category_slug?: string;
  group_id?: string;
  group_name?: string;
  group_slug?: string;
  tag_ids: string[];
  tag_names: string[];
  tag_slugs: string[];
  guide_ids: string[];
  guide_slugs: string[];
  submitter_id?: string;
  content?: any;
  created_at: string;
  updated_at: string;
}

interface HFCategory {
  id: string;
  type: 'category';
  name: string;
  slug: string;
  group_id?: string;
  group_name?: string;
  group_slug?: string;
  order?: number;
  created_at: string;
  updated_at: string;
}

interface HFGroup {
  id: string;
  type: 'group';
  name: string;
  slug: string;
  order?: number;
  category_ids: string[];
  category_names: string[];
  category_slugs: string[];
  created_at: string;
  updated_at: string;
}

interface HFAppType {
  id: string;
  type: 'apptype';
  name: string;
  slug: string;
  order?: number;
  created_at: string;
  updated_at: string;
}

interface HFApplication {
  id: string;
  type: 'application';
  name: string;
  status: string;
  featured: boolean;
  type_ids: string[];
  type_names: string[];
  type_slugs: string[];
  user_id?: string;
  created_at: string;
  updated_at: string;
}

interface HFTag {
  id: string;
  type: 'tag';
  slug: string;
  created_at: string;
  updated_at: string;
}

interface HFGuide {
  id: string;
  type: 'guide';
  slug: string;
  created_at: string;
  updated_at: string;
}

interface HFSettings {
  id: string;
  type: 'settings';
  created_at: string;
  updated_at: string;
}

type HFData = HFProduct | HFCategory | HFGroup | HFAppType | HFApplication | HFTag | HFGuide | HFSettings;

// Logger utility
const logger = {
  info: (message: string, data?: any) => {
    console.log(`[INFO] ${new Date().toISOString()} - ${message}`);
    if (data) console.log(JSON.stringify(data, null, 2));
  },
  
  warn: (message: string, data?: any) => {
    console.warn(`[WARN] ${new Date().toISOString()} - ${message}`);
    if (data) console.warn(JSON.stringify(data, null, 2));
  },
  
  error: (message: string, error?: any) => {
    console.error(`[ERROR] ${new Date().toISOString()} - ${message}`);
    if (error) console.error(error);
  }
};

// Convert Sanity _id to clean id format
function convertSanityId(sanityId: string): string {
  // Remove the prefix (e.g., "product." -> "prod")
  const prefix = sanityId.split('.')[0];
  const id = sanityId.split('.')[1];
  
  // Map prefixes to short codes
  const prefixMap: Record<string, string> = {
    'product': 'prod',
    'category': 'cat',
    'group': 'grp',
    'apptype': 'app',
    'application': 'app',
    'tag': 'tag',
    'guide': 'gui',
    'settings': 'set'
  };
  
  const shortCode = prefixMap[prefix] || prefix;
  return `${shortCode}-${id}`;
}

// Transform Portable Text to simplified JSON
function transformPortableText(portableText: any): any {
  if (!portableText) return null;
  
  if (Array.isArray(portableText)) {
    return portableText.map(block => ({
      _type: block._type,
      text: block.children?.map((child: any) => child.text).join('') || '',
      marks: block.children?.map((child: any) => child.marks) || []
    }));
  }
  
  return portableText;
}

// Extract localized fields
function extractLocalizedFields(obj: any, field: string): { en: string; zh?: string } {
  if (!obj) return { en: '' };
  
  const enValue = obj.en || obj;
  const zhValue = obj.zh;
  
  return {
    en: enValue || '',
    zh: zhValue
  };
}

// Transform product data
function transformProduct(product: ExportedProduct): HFProduct {
  const category = product.category;
  const tags = product.tags || [];
  const guides = product.guides || [];
  
  return {
    id: convertSanityId(product._id),
    type: 'product',
    name: product.name,
    desc_en: extractLocalizedFields(product.desc, 'desc').en,
    desc_zh: extractLocalizedFields(product.desc, 'desc').zh,
    date: product.date,
    status: product.status,
    visible: product.visible,
    featured: product.featured,
    category_id: category ? convertSanityId(category._id) : undefined,
    category_name: category?.name,
    category_slug: category?.slug?.current,
    group_id: category?.group ? convertSanityId(category.group._id) : undefined,
    group_name: category?.group?.name,
    group_slug: category?.group?.slug?.current,
    tag_ids: tags.map(tag => convertSanityId(tag._id)),
    tag_names: tags.map(tag => tag.slug.current),
    tag_slugs: tags.map(tag => tag.slug.current),
    guide_ids: guides.map(guide => convertSanityId(guide._id)),
    guide_slugs: guides.map(guide => guide.slug.current),
    submitter_id: product.submitter ? convertSanityId(product.submitter._id) : undefined,
    content: product.content ? transformPortableText(product.content) : undefined,
    created_at: product._createdAt,
    updated_at: product._updatedAt
  };
}

// Transform category data
function transformCategory(category: ExportedCategory): HFCategory {
  return {
    id: convertSanityId(category._id),
    type: 'category',
    name: category.name,
    slug: category.slug.current,
    group_id: category.group ? convertSanityId(category.group._id) : undefined,
    group_name: category.group?.name,
    group_slug: category.group?.slug?.current,
    order: category.order,
    created_at: category._createdAt,
    updated_at: category._updatedAt
  };
}

// Transform group data
function transformGroup(group: ExportedGroup): HFGroup {
  const categories = group.categories || [];
  
  return {
    id: convertSanityId(group._id),
    type: 'group',
    name: group.name,
    slug: group.slug.current,
    order: group.order,
    category_ids: categories.map(cat => convertSanityId(cat._id)),
    category_names: categories.map(cat => cat.name),
    category_slugs: categories.map(cat => cat.slug.current),
    created_at: group._createdAt,
    updated_at: group._updatedAt
  };
}

// Transform app type data
function transformAppType(apptype: any): HFAppType {
  return {
    id: convertSanityId(apptype._id),
    type: 'apptype',
    name: apptype.name,
    slug: apptype.slug.current,
    order: apptype.order,
    created_at: apptype._createdAt,
    updated_at: apptype._updatedAt
  };
}

// Transform application data
function transformApplication(application: any): HFApplication {
  const types = application.types || [];
  
  return {
    id: convertSanityId(application._id),
    type: 'application',
    name: application.name,
    status: application.status,
    featured: application.featured,
    type_ids: types.map((type: any) => convertSanityId(type._id)),
    type_names: types.map((type: any) => type.name),
    type_slugs: types.map((type: any) => type.slug.current),
    user_id: application.user ? convertSanityId(application.user._id) : undefined,
    created_at: application._createdAt,
    updated_at: application._updatedAt
  };
}

// Transform tag data
function transformTag(tag: any): HFTag {
  return {
    id: convertSanityId(tag._id),
    type: 'tag',
    slug: tag.slug.current,
    created_at: tag._createdAt,
    updated_at: tag._updatedAt
  };
}

// Transform guide data
function transformGuide(guide: any): HFGuide {
  return {
    id: convertSanityId(guide._id),
    type: 'guide',
    slug: guide.slug.current,
    created_at: guide._createdAt,
    updated_at: guide._updatedAt
  };
}

// Transform settings data
function transformSettings(settings: any): HFSettings {
  return {
    id: convertSanityId(settings._id),
    type: 'settings',
    created_at: settings._createdAt,
    updated_at: settings._updatedAt
  };
}

// Main transform function
async function transformToHF() {
  try {
    logger.info('Starting data transformation to HuggingFace format...');
    
    // Create output directory
    const outputDir = path.join(process.cwd(), 'hf-output');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    // Read exported data
    const exportDir = path.join(process.cwd(), 'exports');
    const exportFiles = fs.existsSync(exportDir) ? fs.readdirSync(exportDir) : [];
    
    const hfData: HFData[] = [];
    
    // Process each exported file
    for (const file of exportFiles) {
      if (file.endsWith('.json') && file !== 'combined.json') {
        try {
          const filepath = path.join(exportDir, file);
          const content = fs.readFileSync(filepath, 'utf-8');
          const exportFile = JSON.parse(content);
          
          const contentType = file.replace('.json', '');
          const data = exportFile.data as ExportedData[];
          
          logger.info(`Processing ${contentType}...`);
          
          // Transform each item based on content type
          for (const item of data) {
            let transformed: HFData;
            
            switch (contentType) {
              case 'product':
                transformed = transformProduct(item as ExportedProduct);
                break;
              case 'category':
                transformed = transformCategory(item as ExportedCategory);
                break;
              case 'group':
                transformed = transformGroup(item as ExportedGroup);
                break;
              case 'apptype':
                transformed = transformAppType(item);
                break;
              case 'application':
                transformed = transformApplication(item);
                break;
              case 'tag':
                transformed = transformTag(item);
                break;
              case 'guide':
                transformed = transformGuide(item);
                break;
              case 'settings':
                transformed = transformSettings(item);
                break;
              default:
                logger.warn(`Unknown content type: ${contentType}`);
                continue;
            }
            
            hfData.push(transformed);
          }
          
          logger.info(`Transformed ${data.length} ${contentType} items`);
          
        } catch (error) {
          logger.error(`Failed to process file ${file}`, error);
          throw error;
        }
      }
    }
    
    // Sort data by type and then by id
    hfData.sort((a, b) => {
      if (a.type !== b.type) {
        return a.type.localeCompare(b.type);
      }
      return a.id.localeCompare(b.id);
    });
    
    // Write JSONL file
    const jsonlFilepath = path.join(outputDir, 'data.jsonl');
    const jsonlContent = hfData.map(item => JSON.stringify(item)).join('\n');
    fs.writeFileSync(jsonlFilepath, jsonlContent);
    
    // Write metadata file
    const metadata = {
      created_at: new Date().toISOString(),
      total_records: hfData.length,
      record_types: {
        product: hfData.filter(d => d.type === 'product').length,
        category: hfData.filter(d => d.type === 'category').length,
        group: hfData.filter(d => d.type === 'group').length,
        apptype: hfData.filter(d => d.type === 'apptype').length,
        application: hfData.filter(d => d.type === 'application').length,
        tag: hfData.filter(d => d.type === 'tag').length,
        guide: hfData.filter(d => d.type === 'guide').length,
        settings: hfData.filter(d => d.type === 'settings').length
      },
      schema: {
        product: Object.keys(transformProduct({} as ExportedProduct)),
        category: Object.keys(transformCategory({} as ExportedCategory)),
        group: Object.keys(transformGroup({} as ExportedGroup)),
        apptype: Object.keys(transformAppType({})),
        application: Object.keys(transformApplication({})),
        tag: Object.keys(transformTag({})),
        guide: Object.keys(transformGuide({})),
        settings: Object.keys(transformSettings({}))
      }
    };
    
    const metadataFilepath = path.join(outputDir, 'metadata.json');
    fs.writeFileSync(metadataFilepath, JSON.stringify(metadata, null, 2));
    
    logger.info(`✅ Transformation completed successfully!`);
    logger.info(`Total records transformed: ${hfData.length}`);
    logger.info(`Output saved to: ${outputDir}`);
    logger.info(`- data.jsonl: ${hfData.length} records`);
    logger.info(`- metadata.json: transformation metadata`);
    
  } catch (error) {
    logger.error('Transformation failed', error);
    process.exit(1);
  }
}

// Run the transformation
if (require.main === module) {
  transformToHF();
}

export { transformToHF, convertSanityId, transformProduct, transformCategory, transformGroup };
export type { HFData };