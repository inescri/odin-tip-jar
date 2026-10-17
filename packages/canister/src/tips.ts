/**
 * Pure tip-jar logic — party validation, feed-log key encoding, and the
 * bounded-log arithmetic.
 *
 * Like `ledger.ts`, this module has no IC/Azle runtime dependency so it can be
 * unit-tested with plain vitest. The canister (`index.ts`) wires these helpers
 * to its StableBTreeMaps.
 *
 * A tip never creates or destroys balance: `tip` in the canister composes the
 * hardened `debit` / `credit` from `ledger.ts`. Everything here is about
 * *who* may tip *whom* and how the public feed is stored.
 */

import type { Principal } from '@dfinity/principal';

/**
 * Upper bound on the number of tips kept in the public feed log. Older tips
 * are evicted first. The log is a UX feed, not an audit trail — per-recipient
 * received totals are tracked separately and stay exact forever.
 *
 * ~150 bytes per record → ~75 KB at the bound; a full `getRecentTips` reply
 * is far under the IC's 2 MB message limit.
 */
export const MAX_TIPS = 500;

/** Key in the canister's `config` map holding the next tip id (decimal). */
export const TIP_SEQ_KEY = 'nextTipId';

/**
 * Width of the zero-padded decimal tip key. 20 digits covers every value
 * below 10^20 (> 2^64), far beyond any realistic tip count.
 */
const TIP_KEY_WIDTH = 20;

/** One entry of the public tip feed. Stored as-is in stable memory. */
export interface TipRecord {
    id: bigint;
    from: Principal;
    to: Principal;
    /** Odin token id (same string used by deposit / withdraw). */
    tokenId: string;
    amount: bigint;
    /** IC `time()` — nanoseconds since the Unix epoch. */
    timestamp: bigint;
}

/**
 * Encode a tip id as the StableBTreeMap key for the feed log.
 *
 * StableBTreeMap orders keys by their serialized bytes. A `bigint` key would
 * serialize as JSON text and sort lexicographically ("10" < "9"), so we use
 * a fixed-width, zero-padded decimal string: byte order == numeric order,
 * which lets the canister evict the oldest entries with `keys(0, n)`.
 */
export function tipKey(id: bigint): string {
    if (typeof id !== 'bigint' || id < 0n) {
        throw new Error('invalid tip id');
    }
    const text = id.toString();
    if (text.length > TIP_KEY_WIDTH) {
        throw new Error('invalid tip id');
    }
    return text.padStart(TIP_KEY_WIDTH, '0');
}

/**
 * Reject tips that make no sense or could be abused:
 *  - an anonymous caller has no balance to tip from and no identity to log;
 *  - the anonymous principal can never withdraw, so tipping it burns funds;
 *  - a self-tip is a no-op at best and, if the canister ever read both
 *    balances before writing, a way to mint. Rejecting it keeps the
 *    debit-then-credit ordering in `tip` from being the only safeguard.
 */
export function assertTipParties(from: Principal, to: Principal): void {
    if (from.isAnonymous()) {
        throw new Error('anonymous caller cannot tip');
    }
    if (to.isAnonymous()) {
        throw new Error('cannot tip the anonymous principal');
    }
    if (from.toText() === to.toText()) {
        throw new Error('cannot tip yourself');
    }
}

/**
 * Clamp a caller-supplied page size (Candid `Nat`, so any non-negative
 * bigint) into a safe JS number in `[0, MAX_TIPS]`.
 */
export function clampLimit(limit: bigint): number {
    if (limit <= 0n) {
        return 0;
    }
    if (limit >= BigInt(MAX_TIPS)) {
        return MAX_TIPS;
    }
    return Number(limit);
}

/** How many oldest entries must be evicted to bring `len` back to `max`. */
export function excessCount(len: number, max: number = MAX_TIPS): number {
    return len > max ? len - max : 0;
}

/**
 * The last `limit` items of an oldest-first array, returned newest first.
 * `limit <= 0` returns `[]` (note `slice(-0)` would return everything).
 */
export function newestFirst<T>(items: T[], limit: number): T[] {
    if (limit <= 0 || items.length === 0) {
        return [];
    }
    const start = Math.max(0, items.length - limit);
    return items.slice(start).reverse();
}
