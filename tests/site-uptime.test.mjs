import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';

test('site uptime checker self-test passes offline',()=>{
 const r=spawnSync('python3',['ops/site-uptime/check-site.py','--self-test'],{encoding:'utf8'});
 assert.equal(r.status,0,r.stderr||r.stdout);
 assert.match(r.stdout,/SELF_TEST_OK/);
});

test('site uptime checker refuses unknown arguments',()=>{
 const r=spawnSync('python3',['ops/site-uptime/check-site.py','--pretend-up'],{encoding:'utf8'});
 assert.equal(r.status,2);
 assert.match(r.stderr,/SITE_CHECK_BAD_ARGUMENT/);
});

test('site uptime unit is hardened and scheduled',()=>{
 const service=readFileSync('ops/site-uptime/marocora-site-uptime.service','utf8');
 const timer=readFileSync('ops/site-uptime/marocora-site-uptime.timer','utf8');
 for(const line of ['ProtectSystem=strict','ProtectHome=true','NoNewPrivileges=true','User=root'])
  assert.ok(service.includes(line),line);
 assert.match(service,/ExecStart=\/usr\/bin\/python3 \/opt\/marocora-uptime\/check-site\.py/);
 assert.match(timer,/OnCalendar=\*:0\/5/);
});
