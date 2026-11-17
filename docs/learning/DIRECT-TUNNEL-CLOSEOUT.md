# Marocora — Direct Two-Laptop Tunnel Loading

17 November 2026, Africa/Casablanca. The owner requested direct browser loading
without ngrok's Visit Site screen. ngrok's skip header must be supplied by the
client's initial navigation, before our HTML/JavaScript runs. `--host-header`
rewrites upstream routing and does not remove the free-plan interstitial.
ngrok also explicitly disallows adding its skip header with a server traffic
policy. See the official [header action limitations](https://ngrok.com/docs/gateway/traffic-policy/actions/add-headers)
and [warning documentation](https://github.com/ngrok/ngrok-docs/blob/main/pricing-limits/free-plan-limits.mdx).

## Implemented

`test:lan` now defaults to an accountless **Cloudflare Quick Tunnel** using the
already-installed cloudflared executable. It prints complete HTTPS student and
teacher links on `*.trycloudflare.com`, preserving the query-ticket scheme and
exact public Origin validation. Ngrok remains optional through
`LEARNING_TUNNEL_PROVIDER=ngrok`. No ineffective warning-bypass flag was added.

Stop the previous test and run:

```sh
LEARNING_TUNNEL_PROVIDER=cloudflare pnpm run test:lan
```

The prefix overrides any older provider setting in the private `.env` without
editing or inspecting that file. Plain `pnpm run test:lan` also chooses Cloudflare
when no provider override is set. Use newly printed links, one role per laptop.
Ctrl-C still stops the server and its owned agent. HTTP-only `--no-tunnel` mode
is unchanged. The ordinary live/mock gates remain OFF by default; this explicit
developer command opts into live video as before.

`server/cloudflare-tunnel.mjs` starts the agent with isolated configuration
(`/dev/null`), no auto-update, filtered environment and bounded output parsing.
It waits up to 40 seconds for both a correctly formed trycloudflare HTTPS URL
and a registered connection. Timeout, missing binary and agent exit fail closed.
Shutdown attempts SIGTERM, escalating to SIGKILL after 1.5 seconds if necessary.
Only the owned process is stopped. No Cloudflare login/domain/credential is
needed; these are temporary developer endpoints, with no availability guarantee.
[Cloudflare Quick Tunnels](https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/).

The owner's reported ticket consumption was not observed in their live browser.
A new regression proves repeated page GETs/HEADs do not redeem a ticket and the
login endpoint refuses GET. Only a valid same-origin JSON POST consumes it.
Another session cannot reuse a consumed ticket. The same test verifies the
authenticated configuration is still live (`mock:false`); no transport fallback
to mock occurs after a ticket error. Stale links or switching cookie accounts
remain possible causes of invalid-ticket errors and require fresh role links.

## Verification

`pnpm test`: **252 passed, 0 failed/skipped/cancelled**, retaining all prior 249
test cases and all preexisting test source/fixture files unchanged. Three added
tests cover split agent output/readiness, environment isolation/owned cleanup,
safe missing-binary/timeout errors and real loopback HTTP preview/redemption/live
configuration behavior. Existing combined-launcher Ctrl-C and query-ticket
regressions remain green. OS and JavaScript internet-denial guards are unchanged.
`git diff --check` passed.

Evidence: `direct-tunnel-evidence/` contains preservation hashes, full test output
and verification JSON. Agent responses were simulated; no actual Cloudflare or
ngrok tunnel was opened, private `.env` read, real LiveKit key used, cloud call
made, DB switch changed, firewall modified, commit/push or deployment performed.
The owner must verify the actual provider/network path with the command above.

## Handoff — Marocora — Direct Two-Laptop LiveKit Verification

Checkout:
`/Users/tareqnaser/Documents/ChatGPT/Marocora Site building/output/marocora-quote-workflow-local`.
Branch `codex/marocora-quote-workflow-local`. New adapter:
`server/cloudflare-tunnel.mjs`; selection lives in `server/learning-video-lan.mjs`.
Launcher errors, `.env.example`, README and the setup guide reflect the new
default. Existing ngrok adapter and previous tests remain intact.

Completed stages include V3, mock/real LiveKit SDKs, login tickets, wildcard LAN
binding, owned tunnel lifecycle and query tickets. Next action is the owner's
two-laptop retry with the new trycloudflare links. This is a completed milestone
and a suitable fresh-chat handoff if another debugging stage follows.

Starter prompt:

> Continue **Marocora — Direct Two-Laptop LiveKit Verification**. Read
> `docs/learning/LIVEKIT-LIVE-SETUP.md` and `DIRECT-TUNNEL-CLOSEOUT.md` there.
> `test:lan` now defaults to Cloudflare Quick Tunnels because ngrok's free browser
> interstitial cannot be removed by upstream header rewrites. Force it with
> `LEARNING_TUNNEL_PROVIDER=cloudflare pnpm run test:lan`. Query-ticket login and
> Ctrl-C cleanup remain implemented; 252/252 offline tests pass, prior 249 intact.
> Help verify my new HTTPS links without reading or printing private credentials.
