import {createVendorHandler} from '../../../server/vendor-workflow.mjs';
import {createResendTransport} from '../../../server/vendor-mail.mjs';
import {edgeSupabaseConfiguration} from '../../../server/supabase-api-keys.mjs';
const apiKey=Deno.env.get('VENDOR_RESEND_API_KEY');
Deno.serve(createVendorHandler({...edgeSupabaseConfiguration(Deno.env.get.bind(Deno.env)),sendMail:apiKey?createResendTransport({apiKey,from:Deno.env.get('VENDOR_MAIL_FROM')||'Marocora <no-reply@auth.marocora.com>'}):undefined}));
