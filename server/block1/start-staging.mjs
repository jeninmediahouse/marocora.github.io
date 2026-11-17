// Owner-run local staging bridge. Never auto-applies SQL, seeds accounts or enables gates.
import {join} from 'node:path';
import {openLocalDatabase,root} from './database.mjs';
import {createLocalApp} from './http.mjs';
import {mockCloudmersive} from '../../tests/fixtures/cloudmersive-mock.mjs';
import {cloudConfiguration} from './supabase-database.mjs';
let app;
try{
 if(!cloudConfiguration(process.env))throw Error('STAGING_ENV_REQUIRED');
 const db=openLocalDatabase(join(root,'tmp/staging-private'));
 if(db.mode!=='staging')throw Error('STAGING_ENV_REQUIRED');
 app=createLocalApp(db,{}, {scanner:mockCloudmersive().scanner,instantPricing:true});
 const origin=await app.listen(4199);
 console.log('STAGING BRIDGE: '+origin+'/staging-login.html');
 console.log('Loopback only. Synthetic staging accounts/documents only. Scanner and email mocked.');
 console.log('No SQL applied and no cloud switches changed by startup. Keep secrets private.');
 const stop=async()=>{await app.close();process.exit(0);};process.once('SIGINT',stop);process.once('SIGTERM',stop);
}catch{if(app)await app.close();console.error('Staging startup failed. Check required staging environment variables; no secret values are printed.');process.exitCode=1;}
