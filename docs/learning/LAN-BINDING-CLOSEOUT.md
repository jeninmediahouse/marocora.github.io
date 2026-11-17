# Marocora — LiveKit LAN HTTP Binding

16 November 2026. Owner requested explicit LAN access for two-laptop testing.
The live entry point previously ignored HOST and the shared server always bound
127.0.0.1. Its fixed Host/Origin validation would also have rejected LAN requests
after a listener-only change.

`server/start-learning-live.mjs` now reads HOST (default 127.0.0.1) and PORT
(default 4195). `server/learning-room-http.mjs` binds the requested IPv4 address.
`server/learning-http-binding.mjs` validates that address and builds allowed HTTP
origins from loopback plus the machine's IPv4 interfaces when binding 0.0.0.0.
The API handler uses the accepted request's origin, so LAN login and subsequent
POSTs retain exact same-origin checks. Unknown hosts, mismatched origins and
non-local bind names are rejected. The mock launcher remains loopback-only.

Exact owner command:

```sh
HOST=0.0.0.0 LEARNING_VIDEO_ENABLED=true LEARNING_VIDEO_MODE=live pnpm run learning:video:live
```

Stop the old process first. Confirm `HTTP_LISTEN: 0.0.0.0:4195`. On the second
laptop, replace only the base origin of the newly printed teacher link with
`http://192.168.11.113:4195`, retaining its full booking query and ticket fragment.
The current interface origin must appear among the printed HTTP_ORIGIN entries.

HTTP LAN access fixes reachability, but cameras/microphones still require a
trusted HTTPS page origin or localhost via a tunnel. See the main setup guide.
This change does not implement TLS, modify firewall settings, use live keys,
change database switches or contact LiveKit. No private `.env` was read.

Final `pnpm test`: **238 passed, 0 failed/skipped/cancelled**, including all
prior 235 unchanged. SHA-256 comparison confirms all 43 preexisting test source
and fixture files are intact. `git diff --check` passed.

Verification evidence is in `lan-binding-evidence/`. Three new tests exercise
loopback defaults/valid bind hosts, the actual live entry point with HOST=0.0.0.0
and gate OFF, and real HTTP Host/Origin handling with synthetic interfaces.
All client TCP requests stay on loopback under existing internet-denial guards;
the test never contacts another LAN device. An initial new test used Node fetch,
which normalized the Host header, so it was corrected to send literal headers
with node:http. Original tests were not changed. Actual Wi-Fi/firewall behavior
on the owner's second laptop remains an owner verification step.

Current checkout is
`/Users/tareqnaser/Documents/ChatGPT/Marocora Site building/output/marocora-quote-workflow-local`,
branch `codex/marocora-quote-workflow-local`. No commit, push or deployment.
Next task: owner checks the newly printed LAN origin and then arranges a trusted
secure page origin for two-device media. This is a completed listener milestone.

Fresh-chat starter:

> Continue **Marocora — LiveKit Two-Laptop Secure Test**. Read
> `docs/learning/LIVEKIT-LIVE-SETUP.md`, `LESSON-LOGIN-FIX.md` and
> `LAN-BINDING-CLOSEOUT.md` in the same directory. The live launcher now honors
> HOST=0.0.0.0 with local-interface Host and exact Origin validation. The login
> ticket fragment is retained and authentication precedes Join. Help verify my
> LAN HTTP access and prepare a trusted secure page origin for two-device media.
> Keep keys private; do not repeat completed V3 or mock investigations.
