// Explicit owner-run live test; never imported by the offline tests or browser.
import {startLearningVideoLan} from './learning-video-lan.mjs';
try{await startLearningVideoLan({tunnel:!process.argv.includes('--no-tunnel')});}
catch(error){
 const code=/^(?:[A-Z][A-Z0-9_]{0,79})$/.test(error.message)?error.message:'LAN_TEST_START_FAILED';
 console.error(code);
 if(code==='CLOUDFLARE_AGENT_EXITED')console.error('CLOUDFLARE_DETAIL',JSON.stringify({exitCode:Number.isInteger(error.exitCode)?error.exitCode:null,signal:/^SIG[A-Z0-9]+$/.test(error.exitSignal||'')?error.exitSignal:null,diagnostic:['UNSUPPORTED_CLI_FLAG','DNS_FAILED','TLS_CERTIFICATE_FAILED','NETWORK_TIMEOUT'].includes(error.diagnostic)?error.diagnostic:'UNCLASSIFIED'}));
 console.error('Check private LiveKit .env values and cloudflared installation/network access (or ngrok setup when explicitly selected). For HTTP-only fallback: pnpm run test:lan --no-tunnel');
 process.exitCode=1;
}
