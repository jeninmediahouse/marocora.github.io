import {LearningRoomSession} from './learn/learning-room-session.mjs';
import {createLessonLogin,lessonURLAfterLogin} from './learn/lesson-login.mjs';
const $=id=>document.getElementById(id),booking=$('booking-id'),status=$('status');
const text=value=>window.MarocoraSite?.t(value)||value;
const say=value=>{status.textContent=text(value);};
async function request(path,body){
 const response=await fetch(path,{method:body===undefined?'GET':'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)}),cache:'no-store'});
 let data;try{data=await response.json();}catch{throw Error('LEARNING_VIDEO_DISABLED');}
 if(!response.ok)throw Error(data.error||'ROOM_REQUEST_FAILED');return data;
}
const messages={LEARNING_VIDEO_DISABLED:'Video rooms are OFF. Ask the owner to enable the video gate.',LIVEKIT_ENV_REQUIRED:'The server LiveKit configuration is incomplete.',LIVEKIT_ROOM_SETUP_FAILED:'The LiveKit room could not be prepared. Check the server configuration.',LIVEKIT_TOKEN_FAILED:'The server could not issue a lesson token.',NotAllowedError:'Allow camera and microphone access to join this lesson.',AUTH_REQUIRED:'Sign in to your lesson account before joining.',INVALID_MOCK_TICKET:'This local login link is invalid or belongs to another browser session. Restart the server and open a fresh terminal link in a separate browser profile.',ROOM_NOT_AVAILABLE:'This lesson is not available to your account.',BOOKING_NOT_CONFIRMED:'Your lesson must be confirmed before joining.',ROOM_OUTSIDE_BOOKING_WINDOW:'This room is outside its booking time window.',ROOM_MINUTE_BUDGET_REACHED:'The local room minute budget has been reached.',ROOM_CAPACITY_REACHED:'The local room connection limit has been reached.',ROOM_CONNECTION_NOT_FOUND:'Your connection expired. Join again if your lesson is still available.'};
const login=createLessonLogin({href:location.href,request,onAuthenticated:ticket=>{
 const clean=lessonURLAfterLogin(location.href,ticket);if(clean!==null)history.replaceState(history.state,'',clean);
}});
let heartbeat,ticker,liveMode=false,loginReady=false;
$('join').disabled=true;
const tracks=new Map();
function renderTrack({track,local,removed}){
 if(removed){const item=tracks.get(track);item?.element.remove();if(item?.tile!==$('self-tile'))item?.tile?.remove();tracks.delete(track);$('remote-placeholder').hidden=[...tracks.values()].some(v=>v.tile&&v.tile!==$('self-tile'));return;}
 if(local&&track.kind==='audio'||tracks.has(track))return;
 const element=track.attach();element.autoplay=true;element.playsInline=true;element.muted=!!local;
 let tile=null;
 if(track.kind==='video'){
  if(local){tile=$('self-tile');element.classList.add('local-video');}
  else{tile=document.createElement('article');tile.className='tile remote';const label=document.createElement('div');label.className='tile-label';label.textContent=text('Lesson participant');tile.append(label);document.querySelector('.video-grid').append(tile);$('remote-placeholder').hidden=true;}
  tile.append(element);
 }else $('remote-audio').append(element);
 tracks.set(track,{element,tile});
}
function applyConfig(config){
 liveMode=config.transport==='live';
 if(liveMode){$('camera-state').textContent=text('Your camera is off.');$('video-mode').textContent=text('Live lesson video');$('video-notice').textContent=text(config.enabled?'Live video is enabled. Joining connects to LiveKit and requests camera and microphone access.':'Video connections are OFF. No devices will be accessed.');$('remote-placeholder').querySelector('p').textContent=text('Waiting for your lesson partner');$('remote-placeholder').querySelector('.tile-label').textContent=text('No remote participant connected');$('mode-description').textContent=text('Join from ten minutes before your confirmed lesson. Camera and microphone access begins only after you join.');}
 if(!config.enabled)say('Video connections are OFF. No devices will be accessed.');
}

const room=new LearningRoomSession({request,onTrack:renderTrack,onState:state=>{
 const connected=state.state==='connected';$('connection-state').textContent=text(connected?(liveMode?'Connected (live)':'Connected (mock)'):state.state==='connecting'||state.state==='reconnecting'?'Connecting…':'Disconnected');$('connection-dot').classList.toggle('connected',connected);
 $('join').disabled=!loginReady||state.state!=='disconnected';booking.disabled=state.state!=='disconnected';
 for(const name of ['mute','camera','leave'])$(name).disabled=!connected;
 $('mute').textContent=text(state.microphoneMuted?'Unmute microphone':'Mute microphone');$('mute').setAttribute('aria-pressed',String(!state.microphoneMuted));
 $('camera').textContent=text(state.cameraEnabled?'Turn camera off':'Turn camera on');$('camera').setAttribute('aria-pressed',String(state.cameraEnabled));
 $('camera-state').textContent=text(liveMode?(state.cameraEnabled?'Your camera is on.':'Your camera is off.'):(state.cameraEnabled?'Your simulated camera is on.':'Your simulated camera is off.'));$('self-tile').classList.toggle('camera-on',state.cameraEnabled);
 $('role').textContent=state.lease?.role||'';
 $('enable-audio').hidden=!state.needsAudioGesture;
 for(const [track,item] of tracks)if(track.kind==='video'&&item.tile!==$('self-tile'))item.element.hidden=!!track.isMuted;
 if(state.state==='disconnected'){clearInterval(heartbeat);clearInterval(ticker);}
}});
const error=e=>{say(messages[e.name]||messages[e.message]||(/^[A-Z0-9_]{1,80}$/.test(e.message)?e.message:'Unable to connect to the lesson. Check access and device permissions.'));if(e.message==='AUTH_REQUIRED'){const link=$('account-login');link.hidden=false;link.href='/production-login.html?next='+encodeURIComponent(location.pathname+location.search);}};
$('join-form').onsubmit=async event=>{
 event.preventDefault();
 try{
  await login.join(room,booking.value.trim());say(liveMode?'Connected to your live lesson.':'Connected to your mock lesson. No media is transmitted.');
  heartbeat=setInterval(()=>room.heartbeat().catch(error),30000);
  ticker=setInterval(()=>{if(room.lease&&Date.now()>=Date.parse(room.lease.sessionEndsAt)){void room.leave();say(liveMode?'This lesson session has ended.':'This mock session has ended.');}},1000);
 }catch(e){error(e);}
};
$('mute').onclick=async()=>{try{await room.toggleMicrophone();}catch(e){error(e);}};$('camera').onclick=async()=>{try{await room.toggleCamera();}catch(e){error(e);}};$('enable-audio').onclick=()=>room.startAudio().catch(error);$('leave').onclick=async()=>{await room.leave();say(liveMode?'You have left the lesson.':'You have left the mock lesson.');};
window.addEventListener('pagehide',()=>{if(room.lease)navigator.sendBeacon('/api/learning/room-leave',new Blob([JSON.stringify({connectionId:room.lease.connectionId})],{type:'application/json'}));});
booking.value=login.bookingId;
try{
 await login.ready;
 const config=await request('/api/learning/room-config');applyConfig(config);
 loginReady=true;$('join').disabled=false;
 if(config.enabled)say('Lesson account ready. Join your booked lesson.');
}catch(e){error(e);}
