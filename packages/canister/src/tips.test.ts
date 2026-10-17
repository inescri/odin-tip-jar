import { describe, expect, it } from 'vitest';
import { Principal } from '@dfinity/principal';

import {
    assertTipParties,
    clampLimit,
    excessCount,
    MAX_TIPS,
    newestFirst,
    tipKey,
} from './tips';

const ALICE = Principal.fromText('aaaaa-aa');
const BOB = Principal.fromText('mxzaz-hqaaa-aaaar-qaada-cai');

describe('tipKey', () => {
    it('is fixed-width and zero-padded', () => {
        expect(tipKey(0n)).toBe('00000000000000000000');
        expect(tipKey(42n)).toHaveLength(20);
        expect(tipKey(42n).endsWith('42')).toBe(true);
    });

    it('sorts numerically under lexicographic comparison', () => {
        expect(tipKey(9n) < tipKey(10n)).toBe(true);
        expect(tipKey(99n) < tipKey(100n)).toBe(true);
        expect(tipKey(10n ** 19n) > tipKey(10n ** 19n - 1n)).toBe(true);
    });

    it('round-trips through BigInt', () => {
        expect(BigInt(tipKey(123456789n))).toBe(123456789n);
    });

    it('rejects negative and oversized ids', () => {
        expect(() => tipKey(-1n)).toThrow(/invalid tip id/);
        expect(() => tipKey(10n ** 20n)).toThrow(/invalid tip id/);
    });
});

describe('assertTipParties', () => {
    it('accepts two distinct non-anonymous principals', () => {
        expect(() => assertTipParties(ALICE, BOB)).not.toThrow();
        expect(() => assertTipParties(BOB, ALICE)).not.toThrow();
    });

    it('rejects an anonymous caller', () => {
        expect(() => assertTipParties(Principal.anonymous(), BOB)).toThrow(
            /anonymous caller/,
        );
    });

    it('rejects the anonymous principal as recipient', () => {
        expect(() => assertTipParties(ALICE, Principal.anonymous())).toThrow(
            /anonymous principal/,
        );
    });

    it('rejects a self-tip', () => {
        expect(() =>
            assertTipParties(ALICE, Principal.fromText(ALICE.toText())),
        ).toThrow(/yourself/);
    });
});

describe('clampLimit', () => {
    it('maps zero to zero', () => {
        expect(clampLimit(0n)).toBe(0);
    });

    it('passes in-range values through', () => {
        expect(clampLimit(20n)).toBe(20);
        expect(clampLimit(BigInt(MAX_TIPS))).toBe(MAX_TIPS);
    });

    it('caps values above the log bound', () => {
        expect(clampLimit(10_000n)).toBe(MAX_TIPS);
        expect(clampLimit(1n << 128n)).toBe(MAX_TIPS);
    });
});

describe('excessCount', () => {
    it('is zero at or below the bound', () => {
        expect(excessCount(3, 500)).toBe(0);
        expect(excessCount(500, 500)).toBe(0);
        expect(excessCount(0, 500)).toBe(0);
    });

    it('is the overshoot above the bound', () => {
        expect(excessCount(501, 500)).toBe(1);
        expect(excessCount(510, 500)).toBe(10);
    });

    it('defaults to MAX_TIPS', () => {
        expect(excessCount(MAX_TIPS + 2)).toBe(2);
    });
});

describe('newestFirst', () => {
    it('returns the tail reversed', () => {
        expect(newestFirst([1, 2, 3, 4], 2)).toEqual([4, 3]);
    });

    it('returns everything reversed when limit exceeds length', () => {
        expect(newestFirst([1, 2, 3], 10)).toEqual([3, 2, 1]);
    });

    it('returns an empty array for a zero or negative limit', () => {
        expect(newestFirst([1, 2, 3], 0)).toEqual([]);
        expect(newestFirst([1, 2, 3], -1)).toEqual([]);
    });

    it('handles an empty input', () => {
        expect(newestFirst([], 5)).toEqual([]);
    });

    it('does not mutate the input', () => {
        const input = [1, 2, 3];
        newestFirst(input, 2);
        expect(input).toEqual([1, 2, 3]);
    });
});
