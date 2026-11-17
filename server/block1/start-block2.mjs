// This preview cannot contact remote hosts. Scanner transport is always mocked.
import '../../tests/fixtures/block16-network-guard.mjs';
import {resolve} from 'node:path';
import {openLocalDatabase,seedLocalActors,root} from './database.mjs';
import {createLocalApp} from './http.mjs';
import {mockCloudmersive} from '../../tests/fixtures/cloudmersive-mock.mjs';
const enabled=process.argv.includes('--enable-local-test');
const db=openLocalDatabase(resolve(root,'tmp/block2-private'),{block2:true,enableLocalFlow:enabled,forceLocal:true});
let app;
const off=()=>db.sql('update public.quote_settings set capture_enabled=false,commands_enabled=false,notifications_enabled=false');
try{
 const mocked=mockCloudmersive();app=createLocalApp(db,seedLocalActors(db),{scanner:mocked.scanner});const origin=await app.listen(4198);
 console.log('BLOCK 2 LOCAL MOCK ONLY. No real scanner, email, payment or Ministry verification.');
 console.log('Local workflow switches: '+(enabled?'ON for explicit synthetic test':'OFF'));
 for(const role of ['customer','staff','provider'])console.log(role+': '+origin+'/block1-local.html#'+app.logins[role]);
 const stop=async()=>{await app.close();off();db.stop();process.exit(0);};process.once('SIGINT',stop);process.once('SIGTERM',stop);
}catch{if(app)await app.close();off();db.stop();console.error('Block 2 local preview failed. No credentials are printed.');process.exitCode=1;}
