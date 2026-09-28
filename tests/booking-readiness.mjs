import assert from 'node:assert/strict';
import { bookingReadiness } from '../lib/booking-readiness.ts';

const hours = JSON.stringify({ 1: [540, 1080] });
const business = { status: 'approved', demo: 0, city: 'İstanbul', address: 'Merkez', phone: '+905551112233', hours };
const base = { business, services: [{ active: 1, duration: 60 }], staff: [{ active: 1, hours }], public_site_ready: true };

assert.equal(bookingReadiness(base).ready, true, 'Configured Standart business can share its booking link');

const withoutService = bookingReadiness({ ...base, services: [] });
assert.equal(withoutService.ready, false, 'A business without an active service cannot advertise bookings');
assert.equal(withoutService.steps.find((step) => step.view === 'services').done, false);

const withoutProfile = bookingReadiness({ ...base, business: { ...business, city: '', phone: '', address: '' } });
assert.equal(withoutProfile.ready, false, 'Missing location and contact information block sharing');

const shortShift = bookingReadiness({ ...base, staff: [{ active: 1, hours: JSON.stringify({ 1: [1035, 1080] }) }] });
assert.equal(shortShift.ready, false, 'The available shift must fit at least one active service');

assert.equal(bookingReadiness({ ...base, public_site_ready: false }).ready, false, 'A private site cannot be shared');
assert.equal(bookingReadiness({ ...base, business: { ...business, status: 'pending' } }).ready, false, 'An unapproved business cannot be shared');
console.log('PASS Booking link readiness rules');
