# AI_INSTRUCTIONS — `@odin-tip-jar/frontend`

Rules for working inside the frontend package. Read alongside the root
[`CLAUDE.md`](../../CLAUDE.md).

## What this package is

A Vite + React + TypeScript app — the Odin Tip Jar UI: log in with Odin
Connect, deposit/withdraw against the canister, tip other users, and browse
public tip jar pages and the recent-tips feed.

```
src/
  main.tsx                    # React entry
  App.tsx                     # header + `?jar=` routing (HomePage / TipJarPage)
  components/HomePage.tsx     # jar link, tip/deposit/withdraw forms, global feed
  components/TipJarPage.tsx   # one user's jar: profile, totals, feed, locked TipForm
  components/TipForm.tsx      # direct `actor.tip(...)` call — no Odin approval
  components/TipFeed.tsx      # public feed table
  components/JarLinkCard.tsx  # shareable /?jar=<principal> link
  canister/useTips.ts         # useRecentTips / useReceivedTotals
  canister/useAnonymousActor.ts # query-only actor for logged-out reads
  odin/useTokenMeta.ts        # token ticker/decimals via the public API (+ KNOWN_TOKENS)
  lib/tokens.ts               # TokenMeta type, built-in token meta (BTC is not served by /token/:id)
  odin/useOdinProfile.ts      # username/avatar for any principal
  lib/jar.ts                  # `?jar=` parsing, jar URLs, shortPrincipal
index.html      # Vite html entry
vite.config.ts  # build config (outDir: dist → served by the asset canister)
```

Tip-jar specifics:

- `?jar=<principal>` is read **only once `status !== 'restoring'`** (after
  odin-connect's `ready()` restored the query) and is never stripped. It is
  validated with `parsePrincipal` and never used as a navigation target.
- The anonymous actor is for public queries only. `tip` / `deposit` /
  `withdraw` always go through the delegated actor (`useCanisterActor`).
- `tip` needs no Odin approval, so `TipForm` awaits the canister call directly
  from the click handler — the state-store/`request` pattern below is for
  flows that open Odin (connect, deposit, withdraw).

Stack: React 19, Vite 8, TypeScript strict. Built output (`dist/`) is what the
dfx `frontend` asset canister serves.

## What you MAY change freely

- Components, hooks, layout, styling, copy, routing
- Adding UI state, forms, validation, loading/error handling
- Frontend dependencies (keep the bundle reasonable)

## Hard rules

1. **Never trust the client for accounting.** The canister is the source of
   truth for balances. The UI displays and requests; it must not assume a
   transfer succeeded until the canister confirms. Show pending/failed states.
2. **Amounts are `bigint`.** Token amounts use ICRC-1 `Nat`; keep them `bigint`
   end-to-end and only format to a display string at the render edge. Do not do
   balance math in `number` (precision loss).
3. **Do not hardcode secrets or canister IDs.** Read canister IDs from the
   generated env (dfx writes `.env`) / declarations, not string literals.
4. **Keep types honest.** Strict mode is on; do not add `any` or `// @ts-ignore`
   to silence real type errors from canister bindings.

## Conventions

- Function components + hooks. No class components.
- 2-space indentation, single quotes, semicolons — match existing files.
- Keep `App.tsx` thin; extract flows (auth, deposit, withdraw) into their own
  components/hooks as they grow.
- Prefer the `odin-connect` SDK for auth and canister actor wiring over rolling
  your own agent setup.
- **odin-connect 2.x: render from state, never from an awaited call.** Use the
  single instance in `src/odin/client.ts` (never `new OdinConnect` elsewhere)
  and `useOdinState()` / `useOdinConnect()`. Start `connect()` and
  `user.<action>()` from handlers without awaiting them; put the follow-up in
  an effect keyed on `request.action` + `request.status` (+ a `returnState`
  tag), reading arguments from `request.input` / `returnState`. Value-moving
  follow-ups run at most once per `request.id` (`claimRequest`). Never call
  `connect()` automatically on a `rejected` / `unverified` request. Keep the
  default `mode: "auto"` so wallet in-app browsers work. See the root README's
  "Odin Connect in the frontend" and the SDK's `MIGRATION-2.0.md`.

## Build & test

```sh
pnpm --filter @odin-tip-jar/frontend dev      # local dev server
pnpm --filter @odin-tip-jar/frontend build    # tsc -b && vite build → dist/
pnpm --filter @odin-tip-jar/frontend typecheck
```

Keep `pnpm build:frontend` and `pnpm typecheck` green — CI runs both.
