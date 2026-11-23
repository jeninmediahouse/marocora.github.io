import test from 'node:test';
import {execFileSync} from 'node:child_process';
test('DNS checker synthetic records validate policies and unknowns without DNS or provider access',()=>{
 execFileSync('/usr/bin/python3',['-I','-S','-B','tests/precampaign-dns-fixtures.py'],{cwd:new URL('../',import.meta.url),env:{PATH:'/usr/bin:/bin',LANG:'C',LC_ALL:'C'},stdio:['ignore','pipe','pipe'],timeout:10000});
});
