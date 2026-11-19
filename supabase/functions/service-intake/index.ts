import {createIntakeHandler} from '../../../server/service-intake.mjs';
import {edgeSupabaseConfiguration} from '../../../server/supabase-api-keys.mjs';
// Fail closed if the selected modern key is unavailable. No legacy fallback.
Deno.serve(createIntakeHandler(edgeSupabaseConfiguration(Deno.env.get.bind(Deno.env))));
