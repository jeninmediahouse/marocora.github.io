import {Room,RoomEvent,createLocalTracks} from 'livekit-client';
import {logLiveKitConnectionError} from './livekit-diagnostics.mjs';
export class LiveLearningRoom {
 constructor({request,onState=()=>{},onTrack=()=>{},sdk={Room,RoomEvent,createLocalTracks},log=console.error}){
  this.request=request;this.onState=onState;this.onTrack=onTrack;this.sdk=sdk;this.log=log;this.state='disconnected';this.mode='live';this.microphoneMuted=true;this.cameraEnabled=false;this.lease=null;this.room=null;this.owned=new Set();this.announced=new Set();this.leaving=false;this.needsAudioGesture=false;
 }
 async connect(bookingId){
  if(this.state!=='disconnected')throw Error('ROOM_ALREADY_CONNECTED');this.state='connecting';this.onState(this);
  try{
   const result=await this.request('/api/learning/room-token',{bookingId});
   if(result.mock!==false||result.transport!=='live'||!result.serverUrl?.startsWith('wss://'))throw Error('LIVE_TRANSPORT_DISABLED');
   // Remember the reserved connection even if redemption/SDK connection fails.
   this.lease={connectionId:result.connectionId,bookingId,mock:false,transport:'live'};
   this.lease=await this.request('/api/learning/room-connect',{bookingId,token:result.token});
   const room=new this.sdk.Room({adaptiveStream:true,dynacast:true});this.room=room;const event=this.sdk.RoomEvent;
   const add=(track,participant,local=false)=>{if(this.room!==room){if(local)track.stop();return;}if(this.announced.has(track))return;this.announced.add(track);if(local)this.owned.add(track);this.onTrack({track,participant,local,removed:false});};
   const remove=track=>{this.announced.delete(track);for(const element of track.detach?.()||[])element.remove?.();this.onTrack({track,removed:true});};
   room.on(event.TrackSubscribed,(track,publication,participant)=>add(track,participant));
   room.on(event.TrackUnsubscribed,track=>remove(track));
   room.on(event.LocalTrackPublished,publication=>{if(publication.track)add(publication.track,room.localParticipant,true);});
   room.on(event.LocalTrackUnpublished,publication=>{if(publication.track)remove(publication.track);});
   room.on(event.Disconnected,()=>{if(this.room===room&&!this.leaving)void this.leave();});
   room.on(event.Reconnecting,()=>{this.state='reconnecting';this.onState(this);});
   room.on(event.Reconnected,()=>{this.state='connected';this.onState(this);});
   room.on(event.TrackMuted,()=>this.onState(this));room.on(event.TrackUnmuted,()=>this.onState(this));
   room.on(event.AudioPlaybackStatusChanged,()=>{if(this.room!==room)return;this.needsAudioGesture=!room.canPlaybackAudio;this.onState(this);});
   try{await room.connect(result.serverUrl,result.token,{autoSubscribe:true});}
   catch(error){if(result.debug===true)logLiveKitConnectionError(error,{token:result.token,serverUrl:result.serverUrl},this.log);throw error;}
   if(this.room!==room)throw Error('ROOM_JOIN_CANCELLED');
   const tracks=await this.sdk.createLocalTracks({audio:{echoCancellation:true,noiseSuppression:true},video:{resolution:{width:result.media.width,height:result.media.height,frameRate:result.media.frameRate}}});
   if(this.room!==room){for(const track of tracks)track.stop();throw Error('ROOM_JOIN_CANCELLED');}
   for(const track of tracks)this.owned.add(track);
   for(const track of tracks){await room.localParticipant.publishTrack(track,{videoEncoding:{maxBitrate:result.media.maxVideoBitrate,maxFramerate:result.media.frameRate},audioPreset:{maxBitrate:result.media.maxAudioBitrate}});add(track,room.localParticipant,true);if(this.room!==room)throw Error('ROOM_JOIN_CANCELLED');}
   this.microphoneMuted=false;this.cameraEnabled=true;this.state='connected';this.onState(this);return this.lease;
  }catch(error){await this.leave();throw error;}
 }
 async toggleMicrophone(){if(this.state!=='connected')throw Error('ROOM_NOT_CONNECTED');await this.room.localParticipant.setMicrophoneEnabled(this.microphoneMuted);this.microphoneMuted=!this.microphoneMuted;this.onState(this);}
 async toggleCamera(){if(this.state!=='connected')throw Error('ROOM_NOT_CONNECTED');await this.room.localParticipant.setCameraEnabled(!this.cameraEnabled);this.cameraEnabled=!this.cameraEnabled;this.onState(this);}
 async startAudio(){await this.room?.startAudio();this.needsAudioGesture=false;this.onState(this);}
 async heartbeat(){if(this.state!=='connected'&&this.state!=='reconnecting')return;try{this.lease=await this.request('/api/learning/room-heartbeat',{connectionId:this.lease.connectionId});}catch(error){await this.leave();throw error;}}
 async leave(){
  if(this.leaving)return;this.leaving=true;const lease=this.lease,room=this.room;this.lease=null;this.room=null;
  for(const publication of room?.localParticipant?.trackPublications?.values()||[])if(publication.track)this.owned.add(publication.track);
  for(const track of this.owned)try{track.stop();}catch{}
  for(const track of this.announced){try{for(const element of track.detach?.()||[])element.remove?.();this.onTrack({track,removed:true});}catch{}}
  this.owned.clear();this.announced.clear();
  room?.removeAllListeners();
  try{await room?.disconnect(true);}catch{}
  this.state='disconnected';this.microphoneMuted=true;this.cameraEnabled=false;this.needsAudioGesture=false;this.onState(this);
  if(lease)try{await this.request('/api/learning/room-leave',{connectionId:lease.connectionId});}catch{/* server sweeper retries provider removal */}
  this.leaving=false;
 }
}
