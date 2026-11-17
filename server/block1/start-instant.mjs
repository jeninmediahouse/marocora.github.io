// Disposable or retained LOCAL preview. No cloud configuration is loaded.
import '../../tests/fixtures/block16-network-guard.mjs';
import {readFileSync,existsSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {openLocalDatabase,seedLocalActors,root} from './database.mjs';
import {createLocalApp} from './http.mjs';
import {mockCloudmersive} from '../../tests/fixtures/cloudmersive-mock.mjs';
import {createExchangeService} from '../quote/exchange-rates.mjs';
const db=openLocalDatabase(join(root,'tmp/instant-v3-private'),{forceLocal:true,block2:true,enableLocalFlow:process.argv.includes('--enable-local-test')});let app;
try{
 const migration=readFileSync(join(root,'supabase/migrations/202611150003_instant_pricing.sql'),'utf8'),digest=createHash('sha256').update(migration).digest('hex'),marker=join(db.dir,'instant-migration.json');
 if(existsSync(marker)){if(JSON.parse(readFileSync(marker,'utf8')).digest!==digest)throw Error('INSTANT_MIGRATION_CHANGED_USE_NEW_SYNTHETIC_DIRECTORY');}
 else{db.sql(migration);writeFileSync(marker,JSON.stringify({digest}),{mode:0o600});}
 const actors=seedLocalActors(db);
 app=createLocalApp(db,actors,{scanner:mockCloudmersive().scanner,instantPricing:true,exchangeService:createExchangeService({apiKey:null})});
 const origin=await app.listen(4197);
 console.log('INSTANT V3: mock payments and mock scanning. No real money or email.');
 for(const role of ['customer','staff','provider'])console.log(role+': '+origin+'/block1-local.html#'+app.logins[role]);
 console.log('After sign-in: '+origin+'/instant-quote.html');
 const stop=async()=>{await app.close();db.sql('update public.quote_settings set capture_enabled=false,commands_enabled=false,notifications_enabled=false');db.stop();process.exit(0);};
 process.once('SIGINT',stop);process.once('SIGTERM',stop);
}catch(e){if(app)await app.close();db.stop();console.error('Instant preview failed:',e.message);process.exitCode=1;}
