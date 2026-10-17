import type { OdinToken } from 'odin-connect';

/**
 * The subset of Odin token metadata the UI needs to label and scale an
 * amount. Narrower than the SDK's full `OdinToken` so built-in tokens that the
 * public token endpoint does not serve can be described locally.
 */
export type TokenMeta = Pick<OdinToken, 'id' | 'ticker' | 'divisibility' | 'decimals'>;

/**
 * Tokens the public `GET /token/:id` endpoint does not know. Odin's BTC is a
 * ledger built-in, not a launched token: `api.getToken('btc')` returns 404
 * ("Token not found") even though it appears in every user's balances with
 * this exact shape. Without it, BTC tips would display as raw millisats and
 * the tip form would stay disabled for BTC.
 *
 * Values mirror the `/user/:principal/balances` entry for `btc`:
 * divisibility 8 (sats) + decimals 3 (millisats) → 11 places.
 */
export const KNOWN_TOKENS: ReadonlyMap<string, TokenMeta> = new Map<string, TokenMeta>([
    ['btc', { id: 'btc', ticker: 'BTC', divisibility: 8, decimals: 3 }],
]);

/** Display scale for a token: Odin amounts scale by divisibility + decimals. */
export function tokenPlaces(token: TokenMeta | undefined): number {
    return token ? token.divisibility + token.decimals : 0;
}
