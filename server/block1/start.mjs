import {resolve} from 'node:path';
import {openLocalDatabase,seedLocalActors,root} from './database.mjs';
import {createLocalApp} from './http.mjs';
import {cloudmersiveScanner} from './uploads.mjs';
const scanner=cloudmersiveScanner();
if(!scanner.available){
 console.error('Set CLOUDMERSIVE_API_KEY in your environment before launching.');
 console.error('Scanner: Cloudmersive (available: false)');
 process.exit(1);
}
const enabled=process.argv.includes('--enable-local-test');
const db=openLocalDatabase(resolve(root,'tmp/block1-private'),{enableLocalFlow:enabled,forceLocal:true});
let app;
try{
 app=createLocalApp(db,seedLocalActors(db),{scanner});const origin=await app.listen(4197);
 console.log('LOCAL SYNTHETIC DATA ONLY. No production auth, email, payments or public access.');
 console.log('Private state: '+db.dir);
 console.log('Scanner: Cloudmersive (available: '+scanner.available+')');
 console.log('Local workflow switches: '+(enabled?'ON for owner-requested local test':'OFF'));
 console.log('One-use local session links. Keep private; restart to obtain new links.');
 for(const role of ['customer','staff','provider'])console.log(role+': '+origin+'/block1-local.html#'+app.logins[role]);
 const off=()=>db.sql('update public.quote_settings set capture_enabled=false,commands_enabled=false,notifications_enabled=false');
 const stop=async()=>{await app.close();off();db.stop();process.exit(0);};process.once('SIGINT',stop);process.once('SIGTERM',stop);
}catch{db.sql('update public.quote_settings set capture_enabled=false,commands_enabled=false,notifications_enabled=false');db.stop();console.error('Local launcher failed. Workflow switches are OFF. No provider error or credentials are printed.');process.exitCode=1;}
