import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import Database from 'better-sqlite3';

const DEFAULT_HOURS='{"1":[540,1140],"2":[540,1140],"3":[540,1140],"4":[540,1140],"5":[540,1140],"6":[600,1080]}';
const BUSINESS_HOURS='{"1":[540,1410],"2":[540,1140],"3":[540,1140],"4":[540,1140],"5":[540,1140],"6":[600,1080]}';
const CUSTOM_HOURS='{"1":[600,1020],"2":[600,1020],"3":[600,1020],"4":[600,1020],"5":[600,1020]}';
const NEXT_HOURS='{"1":[540,1320],"2":[540,1140],"3":[540,1140],"4":[540,1140],"5":[540,1140],"6":[600,1080]}';

const db=new Database(':memory:');
db.exec('CREATE TABLE businesses(id TEXT PRIMARY KEY,hours TEXT NOT NULL);');
db.exec('CREATE TABLE staff(id TEXT PRIMARY KEY,tenant_id TEXT NOT NULL,hours TEXT NOT NULL);');
db.prepare('INSERT INTO businesses(id,hours) VALUES(?,?)').run('business-a',BUSINESS_HOURS);
db.prepare('INSERT INTO staff(id,tenant_id,hours) VALUES(?,?,?)').run('untouched','business-a',DEFAULT_HOURS);
db.prepare('INSERT INTO staff(id,tenant_id,hours) VALUES(?,?,?)').run('custom','business-a',CUSTOM_HOURS);

const sql=readFileSync('drizzle/0107_staff_business_hours_sync.sql','utf8');
for(const statement of sql.split('--> statement-breakpoint').map(x=>x.trim()).filter(Boolean))db.exec(statement);

assert.equal(db.prepare('SELECT hours FROM staff WHERE id=?').get('untouched').hours,BUSINESS_HOURS,'existing untouched staff inherits current business hours');
assert.equal(db.prepare('SELECT hours FROM staff WHERE id=?').get('custom').hours,CUSTOM_HOURS,'custom staff schedule is preserved');

db.prepare('INSERT INTO staff(id,tenant_id,hours) VALUES(?,?,?)').run('new-default','business-a',DEFAULT_HOURS);
assert.equal(db.prepare('SELECT hours FROM staff WHERE id=?').get('new-default').hours,BUSINESS_HOURS,'new staff using product defaults inherits business hours');

db.prepare('INSERT INTO staff(id,tenant_id,hours) VALUES(?,?,?)').run('new-custom','business-a',CUSTOM_HOURS);
assert.equal(db.prepare('SELECT hours FROM staff WHERE id=?').get('new-custom').hours,CUSTOM_HOURS,'new custom schedule remains custom');

db.prepare('UPDATE businesses SET hours=? WHERE id=?').run(NEXT_HOURS,'business-a');
assert.equal(db.prepare('SELECT hours FROM staff WHERE id=?').get('untouched').hours,NEXT_HOURS,'inherited staff follows later business-hours changes');
assert.equal(db.prepare('SELECT hours FROM staff WHERE id=?').get('new-default').hours,NEXT_HOURS,'new inherited staff follows later business-hours changes');
assert.equal(db.prepare('SELECT hours FROM staff WHERE id=?').get('custom').hours,CUSTOM_HOURS,'custom staff stays independent after business-hours changes');
assert.equal(db.prepare('SELECT hours FROM staff WHERE id=?').get('new-custom').hours,CUSTOM_HOURS,'new custom staff stays independent after business-hours changes');

db.close();
console.log('PASS staff working-hours inheritance');