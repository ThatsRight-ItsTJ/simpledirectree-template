-- D1 Database Schema for CMS Analytics
-- Version: 1.0.0

-- Enable foreign keys for data integrity
PRAGMA foreign_keys = ON;

-- Create page_heat table for tracking access analytics
CREATE TABLE IF NOT EXISTS page_heat (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    locale TEXT NOT NULL,
    content_type TEXT NOT NULL,
    slug TEXT NOT NULL,
    heat_score INTEGER DEFAULT 1 NOT NULL,
    last_accessed DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
    access_count INTEGER DEFAULT 1 NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Create indexes for performance optimization
CREATE INDEX IF NOT EXISTS idx_page_heat_locale_type_slug ON page_heat(locale, content_type, slug);
CREATE INDEX IF NOT EXISTS idx_page_heat_heat_score ON page_heat(heat_score DESC);
CREATE INDEX IF NOT EXISTS idx_page_heat_last_accessed ON page_heat(last_accessed DESC);
CREATE INDEX IF NOT EXISTS idx_page_heat_access_count ON page_heat(access_count DESC);

-- Create unique constraint to prevent duplicate entries
CREATE UNIQUE INDEX IF NOT EXISTS idx_page_heat_unique ON page_heat(locale, content_type, slug);

-- Create trigger to update updated_at timestamp
CREATE TRIGGER IF NOT EXISTS update_page_heat_timestamp 
    AFTER UPDATE ON page_heat
    FOR EACH ROW
BEGIN
    UPDATE page_heat SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- Create view for popular pages
CREATE VIEW IF NOT EXISTS popular_pages AS
SELECT 
    locale,
    content_type,
    slug,
    heat_score,
    access_count,
    last_accessed,
    (heat_score * 1.0 + access_count * 0.5) AS popularity_score
FROM page_heat
ORDER BY popularity_score DESC;

-- Create schema version table for migrations
CREATE TABLE IF NOT EXISTS schema_version (
    version TEXT PRIMARY KEY,
    applied_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
    description TEXT
);

-- Insert current schema version
INSERT OR IGNORE INTO schema_version (version, description) 
VALUES ('1.0.0', 'Initial schema with page_heat table and analytics tracking');