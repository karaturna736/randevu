-- Serialize leave and booking conflicts at the database boundary.
CREATE TRIGGER slots_respect_closures
BEFORE INSERT ON slots
WHEN EXISTS (
  SELECT 1 FROM closures c
  WHERE c.tenant_id=NEW.tenant_id AND c.date=NEW.date
    AND (c.staff_id IS NULL OR c.staff_id=NEW.staff_id)
)
BEGIN
  SELECT RAISE(ABORT, 'BOOKING_CONFLICT');
END;
--> statement-breakpoint
CREATE TRIGGER closures_respect_bookings
BEFORE INSERT ON closures
WHEN EXISTS (
  SELECT 1 FROM appointments a
  WHERE a.tenant_id=NEW.tenant_id AND a.date=NEW.date
    AND a.status='confirmed'
    AND (NEW.staff_id IS NULL OR a.staff_id=NEW.staff_id)
)
BEGIN
  SELECT RAISE(ABORT, 'BOOKING_CONFLICT');
END;
