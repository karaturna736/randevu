CREATE TABLE IF NOT EXISTS pending_business_media (
  user_id TEXT PRIMARY KEY NOT NULL,
  image_data TEXT NOT NULL,
  content_type TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES profiles(user_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS business_media (
  tenant_id TEXT PRIMARY KEY NOT NULL,
  image_data TEXT NOT NULL,
  content_type TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (tenant_id) REFERENCES businesses(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS business_media_updated_idx ON business_media(updated_at);

CREATE TRIGGER IF NOT EXISTS attach_pending_business_media
AFTER INSERT ON members
WHEN NEW.role = 'owner'
 AND EXISTS (SELECT 1 FROM pending_business_media p WHERE p.user_id = NEW.user_id)
BEGIN
  INSERT INTO business_media (tenant_id, image_data, content_type, updated_at)
  SELECT NEW.tenant_id, p.image_data, p.content_type, p.updated_at
  FROM pending_business_media p
  WHERE p.user_id = NEW.user_id
  ON CONFLICT(tenant_id) DO UPDATE SET
    image_data = excluded.image_data,
    content_type = excluded.content_type,
    updated_at = excluded.updated_at;

  DELETE FROM pending_business_media WHERE user_id = NEW.user_id;
END;
