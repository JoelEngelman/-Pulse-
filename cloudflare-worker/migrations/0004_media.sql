ALTER TABLE posts ADD COLUMN image_url TEXT;
ALTER TABLE posts ADD COLUMN music_url TEXT;
ALTER TABLE posts ADD COLUMN music_title TEXT;
ALTER TABLE posts ADD COLUMN music_artist TEXT;
ALTER TABLE posts ADD COLUMN filter TEXT;

CREATE TABLE IF NOT EXISTS media_assets (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  url TEXT NOT NULL,
  type TEXT NOT NULL,
  mime_type TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_media_assets_user ON media_assets(user_id, created_at DESC);
