import { instructorStore, currentInstructor, signOutInstructor } from './instructor-store.mjs';
import { config } from './config.mjs';
import { taxonomy } from './taxonomy.mjs';
export const currentUser = currentInstructor;
export const signOut = signOutInstructor;
export async function learningRPC(name,args={}) {
 if (!config.learningLaunchOpen || !instructorStore) throw new Error('NOT_CONFIGURED');
 const {data,error}=await instructorStore.rpc(name,args);
 if(error) throw error;
 return data;
}
export async function sendStudentLink(email,locale='en') {
 if(!config.studentSignupOpen || !instructorStore) throw new Error('NOT_CONFIGURED');
 // This exact callback must be allowlisted in Supabase before activation.
 const {error}=await instructorStore.auth.signInWithOtp({email,options:{emailRedirectTo:`${location.origin}/learn/account.html`,shouldCreateUser:true}});
 if(error) throw error;
 try { localStorage.setItem('marocora.locale',locale); } catch {}
}
export async function publicCatalog() {
 const data=await learningRPC('learning_public_catalog');
 return {...taxonomy, ...data, specialties:[...taxonomy.specialties,...data.specialties]};
}
export const publicSlots=id=>learningRPC('learning_public_slots',{instructor_id:id});
export const studentDashboard=()=>learningRPC('learning_student_dashboard');
export const instructorDashboard=()=>learningRPC('learning_instructor_dashboard');
export function onSignOut(callback) {
 return instructorStore?.auth.onAuthStateChange(event=>{if(event==='SIGNED_OUT')callback();});
}
