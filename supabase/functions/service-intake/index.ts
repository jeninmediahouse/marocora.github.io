import {createIntakeHandler} from '../../../server/service-intake.mjs';
Deno.serve(createIntakeHandler({supabaseURL:Deno.env.get('SUPABASE_URL')!,serviceKey:Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!}));
