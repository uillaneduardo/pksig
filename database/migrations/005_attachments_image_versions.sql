-- 005_attachments_image_versions.sql
-- Add derived image versions (thumbnail, print) and dimensions metadata to attachments table

ALTER TABLE attachments ADD COLUMN thumbnail_path VARCHAR(255) NULL;
ALTER TABLE attachments ADD COLUMN print_path VARCHAR(255) NULL;
ALTER TABLE attachments ADD COLUMN original_width INT NULL;
ALTER TABLE attachments ADD COLUMN original_height INT NULL;
ALTER TABLE attachments ADD COLUMN print_width INT NULL;
ALTER TABLE attachments ADD COLUMN print_height INT NULL;
ALTER TABLE attachments ADD COLUMN original_size INT NULL;
ALTER TABLE attachments ADD COLUMN print_size INT NULL;
ALTER TABLE attachments ADD COLUMN processing_status VARCHAR(30) NULL;
ALTER TABLE attachments ADD COLUMN processing_error TEXT NULL;
