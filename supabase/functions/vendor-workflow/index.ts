import {createVendorHandler} from '../../../server/vendor-workflow.mjs';
import {createResendTransport} from '../../../server/vendor-mail.mjs';
const apiKey=Deno.env.get('VENDOR_RESEND_API_KEY');
Deno.serve(createVendorHandler({supabaseURL:Deno.env.get('SUPABASE_URL')!,serviceKey:Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,sendMail:apiKey?createResendTransport({apiKey,from:Deno.env.get('VENDOR_MAIL_FROM')||'Marocora <no-reply@auth.marocora.com>'}):undefined}));
