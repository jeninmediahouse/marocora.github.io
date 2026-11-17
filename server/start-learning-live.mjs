// Owner-run first LiveKit test. Only Node --env-file loads the private keys.
import {startLearningRoomServer} from './learning-room-http.mjs';
if(process.env.LEARNING_VIDEO_MODE!=='live')throw Error('LEARNING_VIDEO_MODE_MUST_BE_LIVE');
await startLearningRoomServer({mode:'live',env:process.env,host:process.env.HOST||'127.0.0.1',port:Number(process.env.PORT||4195)});
