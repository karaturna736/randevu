CREATE TABLE neta_point_balances (
  tenant_id TEXT PRIMARY KEY NOT NULL REFERENCES businesses(id),
  balance INTEGER NOT NULL DEFAULT 0 CHECK(balance >= 0)
);
--> statement-breakpoint
CREATE TABLE neta_point_ledger (
  id TEXT PRIMARY KEY NOT NULL,
  tenant_id TEXT NOT NULL REFERENCES businesses(id),
  amount INTEGER NOT NULL CHECK(amount != 0),
  reference TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL,
  created_at TEXT NOT NULL
);
--> statement-breakpoint
CREATE TRIGGER neta_points_sufficient BEFORE INSERT ON neta_point_ledger
WHEN NEW.amount < 0 AND COALESCE((SELECT balance FROM neta_point_balances WHERE tenant_id=NEW.tenant_id),0) + NEW.amount < 0
BEGIN SELECT RAISE(ABORT, 'Yetersiz Neta puanı'); END;
--> statement-breakpoint
CREATE TRIGGER neta_points_balance AFTER INSERT ON neta_point_ledger
BEGIN
  INSERT OR IGNORE INTO neta_point_balances(tenant_id,balance) VALUES(NEW.tenant_id,0);
  UPDATE neta_point_balances SET balance=balance+NEW.amount WHERE tenant_id=NEW.tenant_id;
END;
--> statement-breakpoint
CREATE TABLE neta_point_redemptions (
  id TEXT PRIMARY KEY NOT NULL,
  tenant_id TEXT NOT NULL REFERENCES businesses(id),
  kind TEXT NOT NULL CHECK(kind IN ('month','management')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','fulfilled','rejected')),
  created_at TEXT NOT NULL,
  reviewed_at TEXT,
  reviewed_by TEXT,
  provider_reference TEXT
);
--> statement-breakpoint
INSERT INTO neta_point_ledger(id,tenant_id,amount,reference,description,created_at)
SELECT lower(hex(randomblob(16))),r.referrer_tenant,200,'referral-points:'||r.referred_tenant,
  'Doğrulanmış işletme daveti',strftime('%Y-%m-%dT%H:%M:%fZ','now')
FROM referrals r JOIN businesses b ON b.id=r.referred_tenant
JOIN businesses f ON f.id=r.referrer_tenant
WHERE r.status='pending' AND b.status='approved' AND b.demo=0 AND f.status='approved' AND f.demo=0
AND EXISTS(SELECT 1 FROM members m WHERE m.tenant_id=b.id AND m.user_id=r.owner_id AND m.role='owner' AND m.disabled=0)
AND (EXISTS(SELECT 1 FROM recurring_events e WHERE e.tenant_id=b.id AND e.test_mode=0 AND e.amount>0)
  OR EXISTS(SELECT 1 FROM subscription_orders o WHERE o.tenant_id=b.id AND o.test_mode=0 AND o.status='paid' AND o.amount>0))
ON CONFLICT(reference) DO NOTHING;
--> statement-breakpoint
UPDATE referrals SET status='earned',reward=200
WHERE status='pending' AND EXISTS(SELECT 1 FROM neta_point_ledger WHERE reference='referral-points:'||referrals.referred_tenant);
