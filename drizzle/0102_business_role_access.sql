ALTER TABLE members ADD COLUMN branch_id text;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS members_tenant_role_branch ON members(tenant_id, role, branch_id, disabled);
--> statement-breakpoint
CREATE TABLE password_credentials (
  user_id text PRIMARY KEY NOT NULL,
  login text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  must_change_password integer NOT NULL DEFAULT 0,
  created_at text NOT NULL,
  updated_at text NOT NULL,
  last_login_at text,
  FOREIGN KEY (user_id) REFERENCES profiles(user_id) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS password_credentials_login ON password_credentials(login);