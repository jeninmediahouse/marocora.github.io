// Keep the established local suite isolated even when staging variables are exported.
import {readdirSync,mkdirSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {requirePnpm} from './check-package-manager.mjs';
requirePnpm();
// Regression QA outputs are generated, not release inputs. Fresh clones must
// create their ignored output directory rather than shipping previous PDFs.
mkdirSync(new URL('../docs/quote/instant-v3-evidence/',import.meta.url),{recursive:true,mode:0o700});
const env=Object.fromEntries(Object.entries(process.env).filter(([key])=>!/^(SUPABASE_|CLOUDMERSIVE_|RESEND_|VENDOR_RESEND_|VENDOR_MAIL_|PG)|DATABASE_URL/.test(key)));
const files=readdirSync(new URL('../tests/',import.meta.url)).filter(name=>name.endsWith('.test.mjs')).sort().map(name=>'tests/'+name);
// The OS policy also covers native dependencies and PostgreSQL descendants.
// Refuse unsupported platforms rather than silently claiming OS isolation.
if(process.platform!=='darwin')throw Error('LOCAL_TEST_OS_NETWORK_ISOLATION_REQUIRES_MACOS_PROFILE');
const result=spawnSync('/usr/bin/sandbox-exec',['-f','./scripts/test-network.sb',process.execPath,'--import','./tests/fixtures/block16-network-guard.mjs','--import','./scripts/test-network-lock.mjs','--test',...files],{cwd:new URL('../',import.meta.url),env,stdio:'inherit'});
if(result.error)console.error('Local test runner failed to start; no credentials are printed.');
process.exitCode=result.status??1;
