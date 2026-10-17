import { describe, expect, it } from 'vitest';

import { formatTokenAmount } from './amounts';
import { KNOWN_TOKENS, tokenPlaces } from './tokens';

describe('KNOWN_TOKENS', () => {
    it('describes Odin BTC, which the public token endpoint does not serve', () => {
        const btc = KNOWN_TOKENS.get('btc');
        expect(btc).toEqual({ id: 'btc', ticker: 'BTC', divisibility: 8, decimals: 3 });
    });

    it('scales BTC amounts from millisats (11 places)', () => {
        const btc = KNOWN_TOKENS.get('btc');
        expect(tokenPlaces(btc)).toBe(11);
        // 1 BTC = 100_000_000 sats = 100_000_000_000 millisats.
        expect(formatTokenAmount(100_000_000_000n, tokenPlaces(btc))).toBe('1');
        // 1 sat.
        expect(formatTokenAmount(1_000n, tokenPlaces(btc))).toBe('0.00000001');
    });
});

describe('tokenPlaces', () => {
    it('is 0 for unknown tokens so raw amounts are shown unscaled', () => {
        expect(tokenPlaces(undefined)).toBe(0);
    });

    it('adds divisibility and decimals', () => {
        expect(tokenPlaces({ id: 'x', ticker: 'X', divisibility: 8, decimals: 0 })).toBe(8);
    });
});
