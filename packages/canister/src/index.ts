import {
    canisterSelf,
    IDL,
    init,
    msgCaller,
    query,
    StableBTreeMap,
    time,
    update,
} from 'azle';
import { Principal } from '@dfinity/principal';

import {
    ODIN_BTC_FEE,
    ODIN_BTC_TOKEN_ID,
    odinPullToken,
    odinSendToken,
} from './odin';
import { credit, debit, makeKey, parseKey, validateAmount } from './ledger';
import {
    assertTipParties,
    clampLimit,
    excessCount,
    MAX_TIPS,
    newestFirst,
    TIP_SEQ_KEY,
    tipKey,
} from './tips';
import type { TipRecord } from './tips';

/**
 * ⚠️ EDIT BEFORE DEPLOY — must list the exact origin(s) your frontend is served
 * from, or Odin Connect login will fail with "origin is not trusted".
 *
 * ICRC-28 trusted origins: the web origins allowed to request signed calls to
 * this canister on a user's behalf. Before issuing a delegation, Odin Connect
 * (the signer) calls `icrc28_trusted_origins` on every target canister and
 * refuses the whole auth if the relying-party origin is absent — or if the
 * endpoint is missing entirely. The origin is the page that opened the signer,
 * NOT this canister's own URL.
 *
 * Each entry MUST be a bare origin: `scheme://host[:port]`, no trailing slash,
 * no path. https only, except `http://localhost`/`127.0.0.1` for local dev.
 * The signer does an exact string match, so e.g. a trailing `/` will not match.
 */
const TRUSTED_ORIGINS: string[] = [
    // Local dev — Vite dev server (default port).
    'http://localhost:5173',
    // Local dev — Vite dev server (fallback port when 5173 is taken).
    'http://localhost:5174',
    // Production — the Netlify-hosted frontend.
    'https://tip-jar-o24.netlify.app',
];

/**
 * Candid shape of one public tip-feed entry. Matches `TipRecord` in tips.ts;
 * the stored record is returned as-is (stableJson round-trips Principal and
 * bigint), so no mapping layer is needed.
 */
const Tip = IDL.Record({
    id: IDL.Nat,
    from: IDL.Principal,
    to: IDL.Principal,
    tokenId: IDL.Text,
    amount: IDL.Nat,
    timestamp: IDL.Nat64,
});

/**
 * Odin Tip Jar canister — multi-token internal ledger plus fee-free tipping.
 *
 * Tracks an internal balance per (principal, token) pair, backed by stable
 * memory so balances survive upgrades. Tokens are identified by their Odin
 * token id (text) — every Odin token shares one ledger, addressed by subaccount.
 *
 * Flows:
 *   deposit  — the caller pre-approves this canister on the Odin ledger, then
 *              this canister pulls the funds (icrc2_transfer_from) and credits
 *              the caller's internal balance.
 *   withdraw — the caller debits their internal balance and the canister sends
 *              the tokens back out on the Odin ledger (icrc1_transfer).
 *   tip      — the caller moves internal balance to another user. Purely
 *              internal: no Odin ledger call, no fee. Logged to a bounded
 *              public feed and summed into per-recipient received totals.
 *
 * Stable memory ids (never reuse or renumber):
 *   0 ledger · 1 config · 2 tips (feed log) · 3 received (totals)
 *
 * ⚠️ AI-GUARD: The balance-mutating paths below are hardened ledger core.
 * Preserve the checks-effects-interactions ordering. See ledger.ts and the AI
 * guardrails task (86aj3b6xr).
 */
export default class {
    /** (owner|token) → balance. Memory id 0. */
    ledger = new StableBTreeMap<string, bigint>(0);

    /** Canister config (e.g. the deploying admin principal). Memory id 1. */
    config = new StableBTreeMap<string, string>(1);

    /** Public tip feed, key = tipKey(id), bounded to MAX_TIPS. Memory id 2. */
    tips = new StableBTreeMap<string, TipRecord>(2);

    /** (recipient|token) → total ever received via tips. Memory id 3. */
    received = new StableBTreeMap<string, bigint>(3);

    /**
     * Record the deploying principal as the owner — a generic admin handle
     * (e.g. for future admin-gated endpoints). Deposits are NOT owner-gated:
     * `deposit` is permissionless and self-verifying (it pulls the caller's own
     * pre-approved funds before crediting), so no trusted minter is needed.
     */
    @init([])
    initialize(): void {
        this.config.insert('owner', msgCaller().toText());
    }

    /**
     * Deposit `amount` of the Odin token `tokenId` for the caller. The caller
     * must have already granted this canister an ICRC-2 allowance via the Odin
     * `icrcApprove` flow (spender = this canister, on the Odin ledger's per-token
     * subaccount); this pulls the approved funds via icrc2_transfer_from on the
     * Odin ledger, then credits the caller's internal balance.
     *
     * `tokenId` is the Odin token id (the same string passed to icrcApprove),
     * NOT an ICRC ledger principal — every Odin token shares one ledger and is
     * addressed by subaccount. See odin.ts.
     *
     * ⚠️ AI-GUARD: Interaction-before-effect (the inverse of withdraw). The
     * funds are pulled in via icrc2_transfer_from BEFORE the internal credit, so
     * a balance is only ever credited for funds that actually settled into this
     * canister. The credit amount equals the just-settled transfer, so a
     * reentrant deposit cannot over-credit — each draws its own allowance. Do
     * not credit before the transfer await resolves.
     */
    @update([IDL.Text, IDL.Nat], IDL.Nat)
    async deposit(tokenId: string, amount: bigint): Promise<bigint> {
        validateAmount(amount);

        const caller = msgCaller();

        // INTERACTION: pull the pre-approved funds into this canister. Throws if
        // the allowance or balance is insufficient — no credit happens then.
        await odinPullToken(tokenId, caller, canisterSelf(), amount);

        // EFFECT: credit only what actually settled.
        const key = makeKey(caller.toText(), tokenId);
        const current = this.ledger.get(key) ?? 0n;
        const next = credit(current, amount);
        this.ledger.insert(key, next);
        return next;
    }

    /**
     * Debit the caller's internal balance and send `amount` of the Odin token
     * `tokenId` back to them via the Odin ledger (icrc1_transfer).
     *
     * FEES (withdrawer pays): the Odin ledger charges a flat BTC fee to the
     * SENDER on every transfer. The outbound token transfer below is sent by
     * this canister, so the canister pays that fee in BTC. Instead of holding a
     * maintainer-seeded BTC float (subsidizing — griefable, drains under spam),
     * this canister pulls the fee from the withdrawer first: the caller
     * pre-approves BTC (>= 2x `ODIN_BTC_FEE`) via the Odin `icrcApprove` flow,
     * and `withdraw` pulls `ODIN_BTC_FEE` BTC into this canister to fund the
     * outbound fee. The pulled BTC cancels the outbound fee, so on success the
     * canister nets zero BTC and needs no float. A failed token send after the
     * fee pull leaves the pulled fee as canister surplus (forfeited below, not
     * refunded). See odin.ts and README.
     *
     * ⚠️ AI-GUARD: Checks-effects-interactions. The balance is debited and
     * persisted BEFORE any cross-canister transfer await. If a transfer fails
     * the balance is refunded. Do not reorder: moving a transfer before the
     * debit opens a reentrancy window for double-withdrawal. The fee pull must
     * stay BEFORE the token send so no tokens leave for an uncollected fee.
     */
    @update([IDL.Text, IDL.Nat], IDL.Nat)
    async withdraw(tokenId: string, amount: bigint): Promise<bigint> {
        validateAmount(amount);

        const caller = msgCaller();
        const key = makeKey(caller.toText(), tokenId);

        // CHECK + EFFECT: debit first, persist, then interact.
        const current = this.ledger.get(key) ?? 0n;
        const next = debit(current, amount); // throws on insufficient funds
        this.ledger.insert(key, next);

        // INTERACTION: collect the BTC fee from the withdrawer, then send the
        // tokens out. Refund the internal debit on any failure.
        try {
            // Fee first: pull the flat BTC fee from the caller's pre-approved
            // allowance. If this throws (no/low approval, insufficient BTC) no
            // tokens have left, and the debit is refunded below.
            await odinPullToken(
                ODIN_BTC_TOKEN_ID,
                caller,
                canisterSelf(),
                ODIN_BTC_FEE,
            );
            // Then the token send. The canister pays the outbound BTC fee out of
            // the BTC just pulled, so it nets zero.
            await odinSendToken(tokenId, caller, amount);
        } catch (error) {
            // Refund the token debit. A fee already pulled before a later
            // failure is NOT refunded — returning it would cost another BTC
            // transfer fee; the withdrawer forfeits the fee on a failed send.
            const afterAwait = this.ledger.get(key) ?? 0n;
            this.ledger.insert(key, credit(afterAwait, amount));
            throw error;
        }

        // Return the caller's new internal balance, matching `deposit`.
        return next;
    }

    /**
     * Move `amount` of the Odin token `tokenId` from the caller's internal
     * balance to `to`'s. No Odin ledger call and no fee — the tokens never
     * leave this canister, only the internal ownership changes.
     *
     * Composes the hardened `debit` / `credit` from ledger.ts; it creates no
     * balance (invariant 1 holds: `deposit` is still the only mint path).
     *
     * Deliberately SYNCHRONOUS (no `await`): an update with no await runs to
     * completion in one message, so a throw anywhere rolls back every map
     * write and nothing can interleave. Do not add a cross-canister call here.
     *
     * Ordering: the sender is debited and persisted BEFORE the recipient's
     * balance is read, so even a self-tip could not double-count — and
     * self-tips are rejected outright by `assertTipParties`.
     *
     * Returns the caller's new balance for `tokenId`, like deposit/withdraw.
     */
    @update([IDL.Principal, IDL.Text, IDL.Nat], IDL.Nat)
    tip(to: Principal, tokenId: string, amount: bigint): bigint {
        validateAmount(amount);

        const from = msgCaller();
        assertTipParties(from, to);

        const fromKey = makeKey(from.toText(), tokenId);
        const toKey = makeKey(to.toText(), tokenId);

        // Debit the sender first; throws on insufficient balance.
        const senderNext = debit(this.ledger.get(fromKey) ?? 0n, amount);
        this.ledger.insert(fromKey, senderNext);

        // Then credit the recipient, reading their balance only now.
        const recipientNext = credit(this.ledger.get(toKey) ?? 0n, amount);
        this.ledger.insert(toKey, recipientNext);

        // Bookkeeping for the public feed and the recipient's lifetime total.
        const receivedNext = credit(this.received.get(toKey) ?? 0n, amount);
        this.received.insert(toKey, receivedNext);
        this.recordTip(from, to, tokenId, amount);

        return senderNext;
    }

    /** The most recent tips across all users, newest first (max MAX_TIPS). */
    @query([IDL.Nat], IDL.Vec(Tip))
    getRecentTips(limit: bigint): TipRecord[] {
        return newestFirst(this.tips.values(), clampLimit(limit));
    }

    /** The most recent tips received by `who`, newest first (max MAX_TIPS). */
    @query([IDL.Principal, IDL.Nat], IDL.Vec(Tip))
    getTipsFor(who: Principal, limit: bigint): TipRecord[] {
        const recipient = who.toText();
        const mine = this.tips
            .values()
            .filter((t) => t.to.toText() === recipient);
        return newestFirst(mine, clampLimit(limit));
    }

    /**
     * Lifetime tip totals received by `who`, as (tokenId, total) pairs. Exact
     * regardless of feed eviction. Scans the whole `received` map, like
     * `getBalances` scans `ledger` — fine at tip-jar scale.
     */
    @query([IDL.Principal], IDL.Vec(IDL.Tuple(IDL.Text, IDL.Nat)))
    getReceivedTotals(who: Principal): [string, bigint][] {
        const recipient = who.toText();
        const totals: [string, bigint][] = [];
        for (const [key, total] of this.received.items()) {
            const { owner, token } = parseKey(key);
            if (owner === recipient) {
                totals.push([token, total]);
            }
        }
        return totals;
    }

    /**
     * Append a tip to the bounded feed log and evict the oldest entries past
     * MAX_TIPS. Not decorated, so it is not exposed as a canister method.
     * The sequence counter lives in `config` as a decimal string: it needs no
     * extra memory id, survives upgrades, and never resets (so ids stay
     * unique even after eviction).
     */
    private recordTip(
        from: Principal,
        to: Principal,
        tokenId: string,
        amount: bigint,
    ): void {
        const id = BigInt(this.config.get(TIP_SEQ_KEY) ?? '0');
        this.config.insert(TIP_SEQ_KEY, (id + 1n).toString());
        this.tips.insert(tipKey(id), {
            id,
            from,
            to,
            tokenId,
            amount,
            timestamp: time(),
        });

        const excess = excessCount(this.tips.len(), MAX_TIPS);
        if (excess > 0) {
            // Keys are zero-padded, so byte order is numeric order: the first
            // `excess` keys are the oldest tips.
            for (const key of this.tips.keys(0, excess)) {
                this.tips.remove(key);
            }
        }
    }

    /** The caller's internal balance for a single Odin token. */
    @query([IDL.Text], IDL.Nat)
    getBalance(tokenId: string): bigint {
        const key = makeKey(msgCaller().toText(), tokenId);
        return this.ledger.get(key) ?? 0n;
    }

    /** All of the caller's internal balances, as (tokenId, balance) pairs. */
    @query([], IDL.Vec(IDL.Tuple(IDL.Text, IDL.Nat)))
    getBalances(): [string, bigint][] {
        const caller = msgCaller().toText();
        const balances: [string, bigint][] = [];
        for (const [key, balance] of this.ledger.items()) {
            const { owner, token } = parseKey(key);
            if (owner === caller) {
                balances.push([token, balance]);
            }
        }
        return balances;
    }

    /** Read the configured owner principal. */
    @query([], IDL.Opt(IDL.Principal))
    getOwner(): [Principal] | [] {
        const owner = this.config.get('owner');
        return owner === undefined ? [] : [Principal.fromText(owner)];
    }

    /**
     * ICRC-28: the web origins this canister trusts to request signed calls on
     * a user's behalf. Odin Connect calls this before issuing a delegation and
     * refuses the auth if the relying-party origin is not listed. Configure the
     * list in `TRUSTED_ORIGINS` above.
     *
     * MUST be `@update`, not `@query`: the signer issues a replicated call so
     * the response is consensus-certified — a query reply comes from a single
     * replica and is spoofable, so signers reject it. Returns the record form
     * `{ trusted_origins }` the ICRC-28 standard (and the signer) expects.
     */
    @update([], IDL.Record({ trusted_origins: IDL.Vec(IDL.Text) }))
    icrc28_trusted_origins(): { trusted_origins: string[] } {
        return { trusted_origins: TRUSTED_ORIGINS };
    }
}
