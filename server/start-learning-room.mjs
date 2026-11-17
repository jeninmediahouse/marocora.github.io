// Mock-only loopback launcher. No .env or LiveKit credentials are used.
import '../tests/fixtures/block16-network-guard.mjs';
import {startLearningRoomServer} from './learning-room-http.mjs';
const flag=process.argv.find(arg=>arg.startsWith('--port='));
await startLearningRoomServer({enabled:process.argv.includes('--enable-local-video-mock'),port:flag?Number(flag.slice(7)):4196});
