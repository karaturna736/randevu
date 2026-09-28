-- Normalize inherited staff schedules by weekday values instead of exact JSON text.
-- This covers legacy rows whose JSON key order/whitespace differs from the product default.
UPDATE staff
SET hours = (
  SELECT b.hours
  FROM businesses b
  WHERE b.id = staff.tenant_id
)
WHERE json_valid(hours)
  AND json_type(hours,'$.0') IS NULL
  AND json_extract(hours,'$.1[0]') = 540 AND json_extract(hours,'$.1[1]') = 1140
  AND json_extract(hours,'$.2[0]') = 540 AND json_extract(hours,'$.2[1]') = 1140
  AND json_extract(hours,'$.3[0]') = 540 AND json_extract(hours,'$.3[1]') = 1140
  AND json_extract(hours,'$.4[0]') = 540 AND json_extract(hours,'$.4[1]') = 1140
  AND json_extract(hours,'$.5[0]') = 540 AND json_extract(hours,'$.5[1]') = 1140
  AND json_extract(hours,'$.6[0]') = 600 AND json_extract(hours,'$.6[1]') = 1080
  AND EXISTS (
    SELECT 1 FROM businesses b
    WHERE b.id = staff.tenant_id
      AND b.hours <> staff.hours
  );
--> statement-breakpoint
DROP TRIGGER IF EXISTS neta_staff_inherit_business_hours_on_insert;
--> statement-breakpoint
CREATE TRIGGER neta_staff_inherit_business_hours_on_insert
AFTER INSERT ON staff
WHEN json_valid(NEW.hours)
  AND json_type(NEW.hours,'$.0') IS NULL
  AND json_extract(NEW.hours,'$.1[0]') = 540 AND json_extract(NEW.hours,'$.1[1]') = 1140
  AND json_extract(NEW.hours,'$.2[0]') = 540 AND json_extract(NEW.hours,'$.2[1]') = 1140
  AND json_extract(NEW.hours,'$.3[0]') = 540 AND json_extract(NEW.hours,'$.3[1]') = 1140
  AND json_extract(NEW.hours,'$.4[0]') = 540 AND json_extract(NEW.hours,'$.4[1]') = 1140
  AND json_extract(NEW.hours,'$.5[0]') = 540 AND json_extract(NEW.hours,'$.5[1]') = 1140
  AND json_extract(NEW.hours,'$.6[0]') = 600 AND json_extract(NEW.hours,'$.6[1]') = 1080
BEGIN
  UPDATE staff
  SET hours = COALESCE(
    (SELECT b.hours FROM businesses b WHERE b.id = NEW.tenant_id),
    NEW.hours
  )
  WHERE tenant_id = NEW.tenant_id AND id = NEW.id;
END;
--> statement-breakpoint
DROP TRIGGER IF EXISTS neta_business_hours_sync_inherited_staff;
--> statement-breakpoint
CREATE TRIGGER neta_business_hours_sync_inherited_staff
AFTER UPDATE OF hours ON businesses
WHEN OLD.hours <> NEW.hours
BEGIN
  UPDATE staff
  SET hours = NEW.hours
  WHERE tenant_id = NEW.id
    AND json_valid(hours)
    AND json_valid(OLD.hours)
    AND COALESCE(json_extract(hours,'$.0[0]'),-1) = COALESCE(json_extract(OLD.hours,'$.0[0]'),-1)
    AND COALESCE(json_extract(hours,'$.0[1]'),-1) = COALESCE(json_extract(OLD.hours,'$.0[1]'),-1)
    AND COALESCE(json_extract(hours,'$.1[0]'),-1) = COALESCE(json_extract(OLD.hours,'$.1[0]'),-1)
    AND COALESCE(json_extract(hours,'$.1[1]'),-1) = COALESCE(json_extract(OLD.hours,'$.1[1]'),-1)
    AND COALESCE(json_extract(hours,'$.2[0]'),-1) = COALESCE(json_extract(OLD.hours,'$.2[0]'),-1)
    AND COALESCE(json_extract(hours,'$.2[1]'),-1) = COALESCE(json_extract(OLD.hours,'$.2[1]'),-1)
    AND COALESCE(json_extract(hours,'$.3[0]'),-1) = COALESCE(json_extract(OLD.hours,'$.3[0]'),-1)
    AND COALESCE(json_extract(hours,'$.3[1]'),-1) = COALESCE(json_extract(OLD.hours,'$.3[1]'),-1)
    AND COALESCE(json_extract(hours,'$.4[0]'),-1) = COALESCE(json_extract(OLD.hours,'$.4[0]'),-1)
    AND COALESCE(json_extract(hours,'$.4[1]'),-1) = COALESCE(json_extract(OLD.hours,'$.4[1]'),-1)
    AND COALESCE(json_extract(hours,'$.5[0]'),-1) = COALESCE(json_extract(OLD.hours,'$.5[0]'),-1)
    AND COALESCE(json_extract(hours,'$.5[1]'),-1) = COALESCE(json_extract(OLD.hours,'$.5[1]'),-1)
    AND COALESCE(json_extract(hours,'$.6[0]'),-1) = COALESCE(json_extract(OLD.hours,'$.6[0]'),-1)
    AND COALESCE(json_extract(hours,'$.6[1]'),-1) = COALESCE(json_extract(OLD.hours,'$.6[1]'),-1);
END;
