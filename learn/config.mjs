// Only public identifiers belong here. Never place the database password or
// Supabase secret key in a browser file. Existing-user sign-in is separate from signup.
export const config = Object.freeze({
  apiBase: null,
  signInURL: null,
  supabaseURL: 'https://zonojgzczpzmcfaekuml.supabase.co',
  supabasePublishableKey: 'sb_publishable_AnBLAdSdtxogZXXSu2i0YA_0ySzG-5U',
  instructorAuthOpen: true,
  instructorSignupOpen: true,
  staffReviewOpen: true,
  learningLaunchOpen: true,
  studentSignupOpen: true
});
