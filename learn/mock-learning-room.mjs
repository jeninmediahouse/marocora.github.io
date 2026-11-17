// Deliberately no LiveKit SDK, RTCPeerConnection, ICE or getUserMedia.
export class MockLearningRoom {
 constructor({request,onState=()=>{}}){this.request=request;this.onState=onState;this.state='disconnected';this.microphoneMuted=true;this.cameraEnabled=false;this.lease=null;}
 async connect(bookingId){
  if(this.state!=='disconnected')throw Error('ROOM_ALREADY_CONNECTED');this.state='connecting';this.onState(this);
  try{
   const result=await this.request('/api/learning/room-token',{bookingId});
   if(result.mock!==true||result.transport!=='mock'||result.serverUrl!==null)throw Error('LIVE_TRANSPORT_DISABLED');
   let token=result.token;
   try{this.lease=await this.request('/api/learning/room-connect',{bookingId,token});}finally{token=null;}
   if(this.lease.mock!==true||this.lease.transport!=='mock')throw Error('LIVE_TRANSPORT_DISABLED');
   this.state='connected';this.onState(this);return this.lease;
  }catch(error){this.state='disconnected';this.lease=null;this.onState(this);throw error;}
 }
 toggleMicrophone(){if(this.state!=='connected')throw Error('ROOM_NOT_CONNECTED');this.microphoneMuted=!this.microphoneMuted;this.onState(this);}
 toggleCamera(){if(this.state!=='connected')throw Error('ROOM_NOT_CONNECTED');this.cameraEnabled=!this.cameraEnabled;this.onState(this);}
 async heartbeat(){
  if(this.state!=='connected')return;
  try{this.lease=await this.request('/api/learning/room-heartbeat',{connectionId:this.lease.connectionId});}
  catch(error){await this.leave();throw error;}
 }
 async leave(){
  const lease=this.lease;this.lease=null;this.state='disconnected';this.microphoneMuted=true;this.cameraEnabled=false;this.onState(this);
  if(lease)try{await this.request('/api/learning/room-leave',{connectionId:lease.connectionId});}catch{/* lease expires after 90 seconds without heartbeats */}
 }
}
