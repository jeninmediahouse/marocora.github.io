import { createClient } from '@supabase/supabase-js';
import { config } from './config.mjs';

export const instructorStore = config.instructorAuthOpen && config.supabaseURL && config.supabasePublishableKey
  ? createClient(config.supabaseURL, config.supabasePublishableKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    }) : null;

export async function currentInstructor() {
  if (!instructorStore) return null;
  const { data, error } = await instructorStore.auth.getUser();
  if (error && error.name !== 'AuthSessionMissingError') throw error;
  return data.user;
}

export async function sendInstructorLink(email) {
  if (!instructorStore) throw new Error('NOT_CONFIGURED');
  const { error } = await instructorStore.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${location.origin}/teacher-apply.html`,
      shouldCreateUser: config.instructorSignupOpen
    }
  });
  if (error) throw error;
}

export async function loadInstructorDraft(userId) {
  const { data, error } = await instructorStore.from('learning_instructor_drafts')
    .select('data,status,revision,submitted_at,updated_at').eq('user_id', userId).maybeSingle();
  if (error) throw error;
  return data;
}

export async function saveInstructorDraft(userId, data, exists) {
  const query = exists
    ? instructorStore.from('learning_instructor_drafts').update({ data }).eq('user_id', userId)
    : instructorStore.from('learning_instructor_drafts').insert({ user_id: userId, data });
  const { error } = await query;
  if (error) throw error;
}

export async function submitInstructorDraft() {
  const { data, error } = await instructorStore.rpc('submit_learning_instructor_draft');
  if (error) throw error;
  return data;
}

export async function signOutInstructor() {
  const { error } = await instructorStore.auth.signOut();
  if (error) throw error;
}
