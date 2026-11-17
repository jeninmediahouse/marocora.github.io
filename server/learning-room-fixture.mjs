// Synthetic, isolated in-memory Learning marketplace; never imports cloud config.
import {Marketplace} from './marketplace.mjs';
import {randomUUID} from 'node:crypto';
export async function createLearningRoomFixture({clock=Date.now}={}){
 const marketplace=new Marketplace(':memory:',{clock,fees:{approved:true,version:'mock-room-fees',calculate:()=>({fee:0,tax:0,discount:0}),freeIntroEligibility:()=>true},payments:{createCheckout:async()=>{throw Error('MOCK_FREE_LESSON_ONLY');}}});
 const ids=Object.fromEntries(['student','teacher','otherStudent','otherTeacher','admin','organization','otherOrganization'].map(key=>[key,randomUUID()]));
 for(const [key,role] of [['student','student'],['teacher','instructor'],['otherStudent','student'],['otherTeacher','instructor'],['admin','admin']])marketplace.addAccount({id:ids[key],role,authSubject:'synthetic:'+ids[key]});
 marketplace.run('INSERT INTO organizations VALUES(?,?)',ids.organization,'Synthetic learning organization');marketplace.run('INSERT INTO organizations VALUES(?,?)',ids.otherOrganization,'Other synthetic organization');
 for(const key of ['student','teacher'])marketplace.run('INSERT INTO memberships VALUES(?,?,?)',ids[key],ids.organization,key);
 marketplace.run('INSERT INTO memberships VALUES(?,?,?)',ids.otherStudent,ids.otherOrganization,'student');
 marketplace.addPolicy({id:'mock-room-policy',version:'mock-room-v1',approved:true,text:{en:'LOCAL MOCK LESSON ONLY. No charge, real lesson or media.'}});
 marketplace.importCatalog({categories:[{id:'languages',active:true}],subjects:[{id:'darija',categoryId:'languages'}],specialties:[],instructors:[{id:'mock-teacher',accountId:ids.teacher,status:'active',subjects:[{subjectId:'darija',approval:'approved',qualifications:{en:'Synthetic teacher'}}]}],offerings:[{id:'mock-lesson',instructorId:'mock-teacher',subjectId:'darija',policyId:'mock-room-policy',priceMinor:0,currency:'MAD',durationMinutes:45,lessonCount:1,deliveryMode:'online',active:true,bookingEnabled:true}]});
 marketplace.addSlot({id:'mock-slot',instructorId:'mock-teacher',startsAt:new Date(clock()+120000).toISOString(),endsAt:new Date(clock()+47*60000).toISOString(),timezone:'Africa/Casablanca',offeringIds:['mock-lesson']});
 const result=await marketplace.checkout(ids.student,{offeringId:'mock-lesson',slotId:'mock-slot',timezone:'Africa/Casablanca',locale:'en',goal:'Synthetic local video-room review',policyVersion:'mock-room-v1',policyAccepted:true,idempotencyKey:'mock-room-booking'});
 marketplace.run('UPDATE bookings SET organization_id=? WHERE id=?',ids.organization,result.bookingId);
 return {marketplace,ids,bookingId:result.bookingId};
}
