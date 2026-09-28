import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import Database from 'better-sqlite3';

const DEFAULT_HOURS='{"1":[540,1140],"2":[540,1140],"3":[540,1140],"4":[540,1140],"5":[540,1140],"6":[600,1080]}';
const FORMATTED_DEFAULT='{ "6": [600, 1080], "5": [540, 1140], "4": [540, 1140], "3": [540, 1140], "2": [540, 1140], "1": [540, 1140] }';
const BUSINESS_HOURS='{"1":[540,1410],"2":[540,1140],"3":[540,1140],"4":[540,1140],"5":[540,1140],"6":[600,1080]}';
const CUSTOM_HOURS='{"1":[600,1020],"2":[600,1020],"3":[600,1020],"4":[600,1020],"5":[600,1020]}';
const NEXT_HOURS='{"1":[540,1320],"2":[540,1140],"3":[540,1140],"4":[540,1140],"5":[540,1140],"6":[600,1080]}';

const db=new Database(':memory:');
db.exec('CREATE TABLE businesses(id TEXT PRIMARY KEY,hours TEXT NOT NULL);');
db.exec('CREATE TABLE staff(id TEXT PRIMARY KEY,tenant_id TEXT NOT NULL,hours TEXT NOT NULL);');
db.prepare('INSERT INTO businesses(id,hours) VALUES(?,?)').run('business-a',BUSINESS_HOURS);
db.prepare('INSERT INTO staff(id,tenant_id,hours) VALUES(?,?,?)').run('untouched','business-a',DEFAULT_HOURS);
db.prepare('INSERT INTO staff(id,tenant_id,hours) VALUES(?,?,?)').run('formatted-default','business-a',FORMATTED_DEFAULT);
db.prepare('INSERT INTO staff(id,tenant_id,hours) VALUES(?,?,?)').run('custom','business-a',CUSTOM_HOURS);

for(const migration of ['drizzle/0107_staff_business_hours_sync.sql','drizzle/0108_staff_hours_sync_normalized.sql']){
 const sql=readFileSync(migration,'utf8');
 for(const statement of sql.split('--> statement-breakpoint').map(x=>x.trim()).filter(Boolean))db.exec(statement);
}

assert.equal(db.prepare('SELECT hours FROM staff WHERE id=?').get('untouched').hours,BUSINESS_HOURS,'existing untouched staff inherits current business hours');
assert.equal(db.prepare('SELECT hours FROM staff WHERE id=?').get('formatted-default').hours,BUSINESS_HOURS,'formatted/reordered legacy default also inherits current business hours');
assert.equal(db.prepare('SELECT hours FROM staff WHERE id=?').get('custom').hours,CUSTOM_HOURS,'custom staff schedule is preserved');

db.prepare('INSERT INTO staff(id,tenant_id,hours) VALUES(?,?,?)').run('new-default','business-a',DEFAULT_HOURS);
assert.equal(db.prepare('SELECT hours FROM staff WHERE id=?').get('new-default').hours,BUSINESS_HOURS,'new staff using product defaults inherits business hours');

db.prepare('INSERT INTO staff(id,tenant_id,hours) VALUES(?,?,?)').run('new-formatted-default','business-a',FORMATTED_DEFAULT);
assert.equal(db.prepare('SELECT hours FROM staff WHERE id=?').get('new-formatted-default').hours,BUSINESS_HOURS,'new staff with equivalent formatted defaults inherits business hours');

db.prepare('INSERT INTO staff(id,tenant_id,hours) VALUES(?,?,?)').run('new-custom','business-a',CUSTOM_HOURS);
assert.equal(db.prepare('SELECT hours FROM staff WHERE id=?').get('new-custom').hours,CUSTOM_HOURS,'new custom schedule remains custom');

db.prepare('UPDATE businesses SET hours=? WHERE id=?').run(NEXT_HOURS,'business-a');
for(const id of ['untouched','formatted-default','new-default','new-formatted-default'])
 assert.equal(db.prepare('SELECT hours FROM staff WHERE id=?').get(id).hours,NEXT_HOURS,`${id} follows later business-hours changes`);
assert.equal(db.prepare('SELECT hours FROM staff WHERE id=?').get('custom').hours,CUSTOM_HOURS,'custom staff stays independent after business-hours changes');
assert.equal(db.prepare('SELECT hours FROM staff WHERE id=?').get('new-custom').hours,CUSTOM_HOURS,'new custom staff stays independent after business-hours changes');

db.close();
console.log('PASS staff working-hours inheritance');
