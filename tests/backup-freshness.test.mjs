import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';

test('backup freshness checker self-test passes offline',()=>{
 const result=spawnSync('python3',['ops/backup-alert/check-db-freshness.py','--self-test'],{encoding:'utf8'});
 assert.equal(result.status,0,result.stderr||result.stdout);
 assert.match(result.stdout,/SELF_TEST_OK/);
});

test('backup freshness checker refuses unknown arguments',()=>{
 const result=spawnSync('python3',['ops/backup-alert/check-db-freshness.py','--pretend-ok'],{encoding:'utf8'});
 assert.equal(result.status,2);
 assert.match(result.stderr,/DB_FRESHNESS_BAD_ARGUMENT/);
});

test('backup freshness unit files stay hardened and scheduled after the backup window',async()=>{
 const {readFileSync}=await import('node:fs');
 const service=readFileSync('ops/backup-alert/marocora-db-freshness.service','utf8');
 const timer=readFileSync('ops/backup-alert/marocora-db-freshness.timer','utf8');
 for(const line of ['ProtectSystem=strict','ProtectHome=true','NoNewPrivileges=true','User=root'])
  assert.ok(service.includes(line),line);
 assert.match(service,/ExecStart=\/usr\/bin\/python3 \/opt\/marocora-backup-alert\/check-db-freshness\.py/);
 assert.match(service,/ConditionPathExists=\/etc\/marocora-translation-worker\/backup\.env/);
 assert.match(timer,/OnCalendar=\*-\*-\* 05:15:00 UTC/);
 assert.match(timer,/Persistent=true/);
 assert.ok(!/127\.0\.0\.1|localhost/.test(timer));
});
