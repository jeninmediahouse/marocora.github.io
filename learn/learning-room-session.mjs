import {MockLearningRoom} from './mock-learning-room.mjs';
export class LearningRoomSession {
 constructor({request,onState=()=>{},onTrack=()=>{},loadLive=()=>import('./live-learning-room.mjs')}){this.request=request;this.onState=onState;this.onTrack=onTrack;this.loadLive=loadLive;this.active=null;this.connecting=false;}
 get state(){return this.connecting&&(!this.active||this.active.state==='disconnected')?'connecting':this.active?.state||'disconnected';}get lease(){return this.active?.lease||null;}get mode(){return this.active instanceof MockLearningRoom?'mock':'live';}get cameraEnabled(){return this.active?.cameraEnabled||false;}get microphoneMuted(){return this.active?.microphoneMuted??true;}get needsAudioGesture(){return this.active?.needsAudioGesture||false;}
 async connect(bookingId){
  if(this.state!=='disconnected')throw Error('ROOM_ALREADY_CONNECTED');this.connecting=true;this.onState(this);try{const config=await this.request('/api/learning/room-config');
  if(!config.enabled)throw Error('LEARNING_VIDEO_DISABLED');
  const options={request:this.request,onState:()=>this.onState(this),onTrack:this.onTrack};
  if(config.transport==='mock')this.active=new MockLearningRoom(options);
  else if(config.transport==='live'){const {LiveLearningRoom}=await this.loadLive();this.active=new LiveLearningRoom(options);}
  else throw Error('LIVE_TRANSPORT_DISABLED');
  return await this.active.connect(bookingId);
  }finally{this.connecting=false;this.onState(this);}
 }
 toggleMicrophone(){return this.active?.toggleMicrophone();}toggleCamera(){return this.active?.toggleCamera();}startAudio(){return this.active?.startAudio?.();}heartbeat(){return this.active?.heartbeat();}leave(){return this.active?.leave();}
}
