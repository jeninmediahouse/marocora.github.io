import {startProductionServer} from './production/http.mjs';
try{await startProductionServer();}
catch(error){console.error('PRODUCTION_START_FAILED',/^[A-Z][A-Z0-9_]{0,79}$/.test(error.message||'')?error.message:'CONFIGURATION_OR_BIND_FAILED');process.exitCode=1;}
