CREATE TABLE business_sites (
  tenant_id TEXT PRIMARY KEY REFERENCES businesses(id) ON DELETE CASCADE,
  eyebrow TEXT NOT NULL DEFAULT '',
  hero_title TEXT NOT NULL DEFAULT '',
  hero_text TEXT NOT NULL DEFAULT '',
  about_text TEXT NOT NULL DEFAULT '',
  instagram_url TEXT NOT NULL DEFAULT '',
  contact_phone TEXT NOT NULL DEFAULT '',
  seo_title TEXT NOT NULL DEFAULT '',
  seo_description TEXT NOT NULL DEFAULT '',
  show_reviews INTEGER NOT NULL DEFAULT 1 CHECK(show_reviews IN (0,1)),
  updated_at TEXT NOT NULL
);
--> statement-breakpoint
CREATE TABLE management_api_keys (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  key_hash TEXT NOT NULL UNIQUE,
  key_prefix TEXT NOT NULL,
  created_at TEXT NOT NULL,
  last_used_at TEXT,
  revoked_at TEXT
);
--> statement-breakpoint
CREATE INDEX management_api_keys_tenant_active ON management_api_keys(tenant_id,revoked_at);
--> statement-breakpoint
CREATE TABLE branch_automation_settings (
  tenant_id TEXT PRIMARY KEY REFERENCES businesses(id) ON DELETE CASCADE,
  fallback_enabled INTEGER NOT NULL DEFAULT 1 CHECK(fallback_enabled IN (0,1)),
  max_alternatives INTEGER NOT NULL DEFAULT 3 CHECK(max_alternatives BETWEEN 1 AND 5),
  updated_at TEXT NOT NULL
);
