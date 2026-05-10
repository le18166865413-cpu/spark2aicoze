-- Multi-site support migration
-- Add site_id column to gallery_images for data isolation between main and sub sites

-- 1. Add site_id column to gallery_images
ALTER TABLE gallery_images ADD COLUMN IF NOT EXISTS site_id TEXT DEFAULT 'main';

-- 2. Create index for faster filtering
CREATE INDEX IF NOT EXISTS idx_gallery_images_site_id ON gallery_images(site_id);

-- 3. Update existing records to main site
UPDATE gallery_images SET site_id = 'main' WHERE site_id IS NULL;

-- 4. Set default value
ALTER TABLE gallery_images ALTER COLUMN site_id SET DEFAULT 'main';

-- Optional: Add site_id to other tables if needed
-- ALTER TABLE user_favorites ADD COLUMN IF NOT EXISTS site_id TEXT DEFAULT 'main';
-- ALTER TABLE auto_sync_tasks ADD COLUMN IF NOT EXISTS site_id TEXT DEFAULT 'main';
-- ALTER TABLE gallery_images_deleted ADD COLUMN IF NOT EXISTS site_id TEXT DEFAULT 'main';
