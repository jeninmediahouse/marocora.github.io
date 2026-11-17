# Marocora local/staging checkout

Use the pinned `pnpm@11.25.0` package manager from `package.json`. The sole
canonical dependency lockfile is `pnpm-lock.yaml`.

```sh
pnpm install --frozen-lockfile
pnpm test
pnpm run build:pages
pnpm run preview
```

Install, test and build entry points require pnpm. npm/yarn lockfiles are ignored;
`package-lock.json` has been removed. Individual owner Auth diagnostic scripts
remain directly executable with Node, as documented in `docs/quote/STAGING-SETUP.md`.

The full integration suite requires macOS, its existing internet-denying sandbox,
and PostgreSQL 17. Set `QUOTE_PG_BIN` if its binaries are outside
`/opt/homebrew/opt/postgresql@17/bin`. GitHub Actions runs that suite in a macOS
job before the separate public build/deployment job. No GitHub deployment is
performed merely by running the commands above.

See `docs/quote/V3-CLEANUP-CLOSEOUT.md` for the latest V3 closeout, or
`docs/quote/INSTANT-PRICING-V3.md` for the workflow implementation and staging guide.

Learning Service video scaffold (isolated synthetic local mocks):

```sh
pnpm run learning:video:mock
# Explicitly enable only the local mock gate for review:
pnpm run learning:video:mock --enable-local-video-mock
```

See `docs/learning/LIVEKIT-MOCK-SCAFFOLD.md` for booking/tenant authorization,
future server-only environment variables, Ship-tier design and verification.

Owner-run LiveKit staging call (real SDK, synthetic booking, gate OFF by default):

```sh
pnpm run learning:video:live
```

First set the server-only variables privately as described in
[LiveKit live setup](docs/learning/LIVEKIT-LIVE-SETUP.md). The live launcher uses
port 4195 and reads `.env`; the mock launcher remains isolated and ignores it.

Two-laptop HTTPS test (automatically starts server + the installed cloudflared CLI):

```sh
pnpm run test:lan
# Explicit HTTP-only LAN fallback:
pnpm run test:lan --no-tunnel
```

The command enables this synthetic live test, prints complete HTTPS role links,
and cleans up both services on Ctrl-C. Requires private LiveKit `.env` values
and cloudflared on PATH; no Cloudflare account is required. See `docs/learning/LIVEKIT-LIVE-SETUP.md`.

Production application (real Supabase authentication, fixed HTTPS origins, private Spaces):

```sh
pnpm run build:production
pnpm run start:production
```

Configure the private server environment and apply the reviewed production-only
migration 004 first. See [production release guide](docs/deployment/PRODUCTION-BOOTSTRAP.md).
This entry point seeds no synthetic accounts and exposes no mock-payment path.
Actual merchant payments and scheduled cloud backups remain separate work.
