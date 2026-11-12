import {createVendorHandler} from '../../../server/vendor-workflow.mjs';
Deno.serve(createVendorHandler({supabaseURL:Deno.env.get('SUPABASE_URL')!,serviceKey:Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,mailForm:Deno.env.get('VENDOR_MAIL_FORM')}));
