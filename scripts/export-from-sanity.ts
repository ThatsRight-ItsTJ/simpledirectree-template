#!/usr/bin/env tsx

/**
 * Export all content types from Sanity with resolved references
 * 
 * This script exports all 8 content types from Sanity:
 * - products, categories, groups, apptypes, applications, tags, guides, settings
 * 
 * Usage: pnpm tsx scripts/export-from-sanity.ts
 */

import fs from 'fs/promises';
import path from 'path';
import { client } from '../sanity/lib/client';
import { groq } from 'next-sanity';

// Define content types to export
const CONTENT_TYPES = [
  'product',
  'category', 
  'group',
  'apptype',
  'application',
  'tag',
  'guide',
  'settings'
] as const;

type ContentType = typeof CONTENT_TYPES[number];

// Define type for exported data with resolved references
export interface ExportedProduct {
  _id: string;
  _type: 'product';
  _createdAt: string;
  _updatedAt: string;
  name: string;
  slug: { current: string };
  desc: string;
  date: string;
  content?: any;
  status: 'draft' | 'published';
  visible: boolean;
  featured: boolean;
  category?: {
    _id: string;
    _type: 'category';
    name: string;
    slug: { current: string };
    group?: {
      _id: string;
      _type: 'group';
      name: string;
      slug: { current: string };
    };
  };
  tags?: Array<{
    _id: string;
    _type: 'tag';
    slug: { current: string };
  }>;
  guides?: Array<{
    _id: string;
    _type: 'guide';
    slug: { current: string };
  }>;
  submitter?: {
    _id: string;
    _type: 'user';
  };
}

export interface ExportedCategory {
  _id: string;
  _type: 'category';
  _createdAt: string;
  _updatedAt: string;
  name: string;
  slug: { current: string };
  group?: {
    _id: string;
    _type: 'group';
    name: string;
    slug: { current: string };
  };
  order?: number;
}

export interface ExportedGroup {
  _id: string;
  _type: 'group';
  _createdAt: string;
  _updatedAt: string;
  name: string;
  slug: { current: string };
  order?: number;
  categories?: Array<ExportedCategory>;
}

export interface ExportedAppType {
  _id: string;
  _type: 'apptype';
  _createdAt: string;
  _updatedAt: string;
  name: string;
  slug: { current: string };
  order?: number;
}

export interface ExportedApplication {
  _id: string;
  _type: 'application';
  _createdAt: string;
  _updatedAt: string;
  name: string;
  status: string;
  featured: boolean;
  types?: Array<{
    _id: string;
    _type: 'apptype';
    name: string;
    slug: { current: string };
  }>;
  user?: {
    _id: string;
    _type: 'user';
  };
}

export interface ExportedTag {
  _id: string;
  _type: 'tag';
  _createdAt: string;
  _updatedAt: string;
  slug: { current: string };
}

export interface ExportedGuide {
  _id: string;
  _type: 'guide';
  _createdAt: string;
  _updatedAt: string;
  slug: { current: string };
}

export interface ExportedSettings {
  _id: string;
  _type: 'settings';
  _createdAt: string;
  _updatedAt: string;
  // Add settings fields as needed
}

export type ExportedData = 
  | ExportedProduct
  | ExportedCategory
  | ExportedGroup
  | ExportedAppType
  | ExportedApplication
  | ExportedTag
  | ExportedGuide
  | ExportedSettings;

// Queries for each content type with resolved references
const QUERIES = {
  product: groq`
    *[_type == "product" && visible == true] | order(order desc, _createdAt asc) {
      _id,
      _type,
      _createdAt,
      _updatedAt,
      "name": coalesce(name[$lang], name[$defaultLocale]),
      "desc": coalesce(desc[$lang], desc[$defaultLocale]),
      "date": coalesce(date, _createdAt),
      slug,
      content,
      "status": select(_originalId in path("drafts.**") => "draft", "published"),
      visible,
      featured,
      category-> {
        _id,
        _type,
        "name": coalesce(name[$lang], name[$defaultLocale]),
        slug,
        group-> {
          _id,
          _type,
          "name": coalesce(name[$lang], name[$defaultLocale]),
          slug
        }
      },
      tags[]-> {
        _id,
        _type,
        slug
      },
      guides[]-> {
        _id,
        _type,
        slug
      },
      submitter-> {
        _id,
        _type
      }
    }
  `,
  
  category: groq`
    *[_type == "category"] | order(order desc, _createdAt asc) {
      _id,
      _type,
      _createdAt,
      _updatedAt,
      "name": coalesce(name[$lang], name[$defaultLocale]),
      slug,
      group-> {
        _id,
        _type,
        "name": coalesce(name[$lang], name[$defaultLocale]),
        slug
      },
      order
    }
  `,
  
  group: groq`
    *[_type == "group"] | order(order desc, _createdAt asc) {
      _id,
      _type,
      _createdAt,
      _updatedAt,
      "name": coalesce(name[$lang], name[$defaultLocale]),
      slug,
      order,
      "categories": *[_type=='category' && references(^._id)] | order(order desc, _createdAt asc) {
        _id,
        _type,
        "name": coalesce(name[$lang], name[$defaultLocale]),
        slug,
        group-> {
          _id,
          _type,
          "name": coalesce(name[$lang], name[$defaultLocale]),
          slug
        },
        order
      }
    }
  `,
  
  apptype: groq`
    *[_type == "apptype"] | order(order desc, _createdAt asc) {
      _id,
      _type,
      _createdAt,
      _updatedAt,
      "name": coalesce(name[$lang], name[$defaultLocale]),
      slug,
      order
    }
  `,
  
  application: groq`
    *[_type == "application"] | order(order desc, _createdAt asc) {
      _id,
      _type,
      _createdAt,
      _updatedAt,
      name,
      status,
      featured,
      types[]-> {
        _id,
        _type,
        "name": coalesce(name[$lang], name[$defaultLocale]),
        slug
      },
      user-> {
        _id,
        _type
      }
    }
  `,
  
  tag: groq`
    *[_type == "tag"] | order(order desc, _createdAt asc) {
      _id,
      _type,
      _createdAt,
      _updatedAt,
      slug
    }
  `,
  
  guide: groq`
    *[_type == "guide"] | order(order desc, _createdAt asc) {
      _id,
      _type,
      _createdAt,
      _updatedAt,
      slug
    }
  `,
  
  settings: groq`
    *[_type == "settings"][0] {
      _id,
      _type,
      _createdAt,
      _updatedAt
    }
  `
};

// Language configuration
const LANGUAGES = {
  lang: 'en',
  defaultLocale: 'en'
};

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

// Main export function
async function exportFromSanity() {
  try {
    logger.info('Starting data export from Sanity...');
    
    const exportData: Record<ContentType, ExportedData[]> = {
      product: [],
      category: [],
      group: [],
      apptype: [],
      application: [],
      tag: [],
      guide: [],
      settings: []
    };
    
    let totalExported = 0;
    
    // Export each content type
    for (const contentType of CONTENT_TYPES) {
      try {
        logger.info(`Exporting ${contentType}...`);
        
        const query = QUERIES[contentType as keyof typeof QUERIES];
        const data = await client.fetch(query, LANGUAGES);
        
        exportData[contentType as ContentType] = data;
        totalExported += data.length;
        
        logger.info(`Exported ${data.length} ${contentType}(s)`);
        
      } catch (error) {
        logger.error(`Failed to export ${contentType}`, error);
        throw error;
      }
    }
    
    // Create export directory
    const exportDir = path.join(process.cwd(), 'exports');
    await fs.mkdir(exportDir, { recursive: true });
    
    // Save each content type to separate files
    for (const [contentType, data] of Object.entries(exportData)) {
      if (data.length > 0) {
        const filename = `${contentType}.json`;
        const filepath = path.join(exportDir, filename);
        
        // Add metadata
        const exportFile = {
          exportedAt: new Date().toISOString(),
          contentType,
          count: data.length,
          data
        };
        
        await fs.writeFile(filepath, JSON.stringify(exportFile, null, 2));
        logger.info(`Saved ${data.length} ${contentType} to ${filename}`);
      }
    }
    
    // Save combined export file
    const combinedExport = {
      exportedAt: new Date().toISOString(),
      totalRecords: totalExported,
      summary: {
        products: exportData.product.length,
        categories: exportData.category.length,
        groups: exportData.group.length,
        apptypes: exportData.apptype.length,
        applications: exportData.application.length,
        tags: exportData.tag.length,
        guides: exportData.guide.length,
        settings: exportData.settings.length
      },
      data: exportData
    };
    
    const combinedFilepath = path.join(exportDir, 'combined.json');
    await fs.writeFile(combinedFilepath, JSON.stringify(combinedExport, null, 2));
    
    logger.info(`✅ Export completed successfully!`);
    logger.info(`Total records exported: ${totalExported}`);
    logger.info(`Export files saved to: ${exportDir}`);
    
  } catch (error) {
    logger.error('Export failed', error);
    process.exit(1);
  }
}

// Run the export
if (require.main === module) {
  exportFromSanity();
}

export { exportFromSanity, convertSanityId, logger };