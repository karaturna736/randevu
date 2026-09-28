-- Untouched personnel schedules used the product default hours even when the
-- business later changed its working hours. Treat that exact default schedule
-- as inherited so public availability follows the business schedule.
UPDATE staff
SET hours = (
  SELECT b.hours
  FROM businesses b
  WHERE b.id = staff.tenant_id
)
WHERE hours = '{"1":[540,1140],"2":[540,1140],"3":[540,1140],"4":[540,1140],"5":[540,1140],"6":[600,1080]}'
  AND EXISTS (
    SELECT 1
    FROM businesses b
    WHERE b.id = staff.tenant_id
      AND b.hours <> '{"1":[540,1140],"2":[540,1140],"3":[540,1140],"4":[540,1140],"5":[540,1140],"6":[600,1080]}'
  );
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS neta_staff_inherit_business_hours_on_insert
AFTER INSERT ON staff
WHEN NEW.hours = '{"1":[540,1140],"2":[540,1140],"3":[540,1140],"4":[540,1140],"5":[540,1140],"6":[600,1080]}'
BEGIN
  UPDATE staff
  SET hours = COALESCE(
    (SELECT b.hours FROM businesses b WHERE b.id = NEW.tenant_id),
    NEW.hours
  )
  WHERE tenant_id = NEW.tenant_id
    AND id = NEW.id;
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS neta_business_hours_sync_inherited_staff
AFTER UPDATE OF hours ON businesses
WHEN OLD.hours <> NEW.hours
BEGIN
  UPDATE staff
  SET hours = NEW.hours
  WHERE tenant_id = NEW.id
    AND hours = OLD.hours;
END;