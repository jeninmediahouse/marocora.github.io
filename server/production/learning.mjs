import {createConfiguredLearningRooms} from '../live-learning-room.mjs';
import {uuid} from '../quote/contracts.mjs';
const fail=()=>{throw Object.assign(Error('ROOM_NOT_AVAILABLE'),{status:403});};
export function createProductionLearning({auth,env,adapter,clock=Date.now,intervalMs=15000}){
 const contexts=new Map(),connections=new Map();let sweeping=false;
 const key=(actor,id)=>actor+'|'+id;
 async function refresh(session,id){
  const k=key(session.actor,id);contexts.delete(k);
  const c=await auth.roomContext(session,uuid(id));
  if(c.actor!==session.actor||c.bookingId!==id||!['student','teacher'].includes(c.role)||c.status!=='confirmed'||c.teacherActive!==true||c.member!==true)fail();
  const student=uuid(c.studentId),teacher=uuid(c.teacherId);if(student===teacher||session.actor!==(c.role==='student'?student:teacher))fail();
  const start=Date.parse(c.startsAt),end=Date.parse(c.endsAt);if(!Number.isFinite(start)||!Number.isFinite(end)||end<=start)fail();
  const access={actor:{id:session.actor,role:c.role==='teacher'?'instructor':'student'},member:c.member,booking:{id,student_id:student,teacher_account:teacher,organization_id:c.tenantId?uuid(c.tenantId):null,status:c.status,starts_at:start,ends_at:end,offering_snapshot:JSON.stringify({deliveryMode:c.deliveryMode}),teacher_data:JSON.stringify({status:c.teacherActive?'active':'inactive'})}};
  contexts.set(k,access);return access;
 }
 const rooms=createConfiguredLearningRooms({marketplace:{account:id=>({id})},env:{...env,LEARNING_VIDEO_MODE:'live'},adapter,clock,cleanupIntervalMs:0,resolveAccess:(actor,id)=>contexts.get(key(actor,id))});
 async function reap(){
  if(sweeping)return;sweeping=true;
  try{
   for(const [id,c] of connections){
    if(c.until<=clock()){contexts.delete(key(c.session.actor,c.bookingId));connections.delete(id);continue;}
    try{const session=await auth.authenticate(c.session.bearer);await refresh(session,c.bookingId);}
    catch{contexts.delete(key(c.session.actor,c.bookingId));}
   }
   await rooms.reap();
  }finally{sweeping=false;}
 }
 const timer=intervalMs>0?setInterval(()=>void reap(),intervalMs):null;timer?.unref();
 return {
  getConfig:session=>rooms.getConfig(session.actor),
  async issue(session,body){
   if(!rooms.getConfig(session.actor).enabled)throw Object.assign(Error('LEARNING_VIDEO_DISABLED'),{status:503});
   await refresh(session,body?.bookingId);const result=await rooms.issue(session.actor,body);
   connections.set(result.connectionId,{session,bookingId:body.bookingId,until:clock()+90*1000});
   try{await refresh(session,body.bookingId);return result;}catch(error){await rooms.leave(session.actor,{connectionId:result.connectionId});connections.delete(result.connectionId);throw error;}
  },
  async connect(session,body){await refresh(session,body?.bookingId);return rooms.connect(session.actor,body);},
  async heartbeat(session,body){const c=connections.get(body?.connectionId);if(!c||c.session.actor!==session.actor)fail();await refresh(session,c.bookingId);const result=await rooms.heartbeat(session.actor,body);c.until=Date.parse(result.leaseExpiresAt);return result;},
  async leave(session,body){await rooms.leave(session.actor,body);const c=connections.get(body?.connectionId);if(c){contexts.delete(key(c.session.actor,c.bookingId));connections.delete(body.connectionId);}return {left:true};},
  reap,
  async close(){clearInterval(timer);await rooms.close();connections.clear();contexts.clear();}
 };
}
