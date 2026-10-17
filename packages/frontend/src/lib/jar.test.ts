import { describe, expect, it } from 'vitest';

import {
    buildJarPath,
    buildJarUrl,
    formatTipTime,
    parsePrincipal,
    readJarParam,
    shortPrincipal,
    tipTimeToDate,
} from './jar';

const PRINCIPAL = 'mxzaz-hqaaa-aaaar-qaada-cai';
const ANONYMOUS = '2vxsx-fae';

describe('parsePrincipal', () => {
    it('returns the canonical text of a valid principal', () => {
        expect(parsePrincipal(PRINCIPAL)).toBe(PRINCIPAL);
        expect(parsePrincipal(`  ${PRINCIPAL}  `)).toBe(PRINCIPAL);
    });

    it('rejects garbage and empty input', () => {
        expect(parsePrincipal('')).toBeNull();
        expect(parsePrincipal('   ')).toBeNull();
        expect(parsePrincipal('not-a-principal')).toBeNull();
        expect(parsePrincipal('https://evil.example')).toBeNull();
    });

    it('rejects the anonymous principal', () => {
        expect(parsePrincipal(ANONYMOUS)).toBeNull();
    });
});

describe('readJarParam', () => {
    it('reads a valid principal', () => {
        expect(readJarParam(`?jar=${PRINCIPAL}`)).toBe(PRINCIPAL);
    });

    it('ignores other params', () => {
        expect(readJarParam(`?lang=zh&jar=${PRINCIPAL}&x=1`)).toBe(PRINCIPAL);
    });

    it('is null when absent or invalid', () => {
        expect(readJarParam('')).toBeNull();
        expect(readJarParam('?lang=zh')).toBeNull();
        expect(readJarParam('?jar=nope')).toBeNull();
        expect(readJarParam(`?jar=${ANONYMOUS}`)).toBeNull();
    });
});

describe('buildJarPath / buildJarUrl', () => {
    it('builds a same-origin path', () => {
        expect(buildJarPath(PRINCIPAL)).toBe(`/?jar=${PRINCIPAL}`);
    });

    it('builds an absolute url from an origin', () => {
        expect(buildJarUrl('https://tips.example', PRINCIPAL)).toBe(
            `https://tips.example/?jar=${PRINCIPAL}`,
        );
    });

    it('round-trips through readJarParam', () => {
        const url = new URL(buildJarUrl('https://tips.example', PRINCIPAL));
        expect(readJarParam(url.search)).toBe(PRINCIPAL);
    });
});

describe('shortPrincipal', () => {
    it('leaves short principals alone', () => {
        expect(shortPrincipal('aaaaa-aa')).toBe('aaaaa-aa');
    });

    it('elides the middle of long principals', () => {
        expect(shortPrincipal(PRINCIPAL)).toBe('mxzaz-…a-cai');
    });
});

describe('tipTimeToDate / formatTipTime', () => {
    it('converts nanoseconds to a Date', () => {
        const ms = Date.UTC(2026, 9, 17, 12, 34, 56);
        expect(tipTimeToDate(BigInt(ms) * 1_000_000n).getTime()).toBe(ms);
    });

    it('drops sub-millisecond precision', () => {
        const ms = 1_700_000_000_000;
        const ns = BigInt(ms) * 1_000_000n + 999_999n;
        expect(tipTimeToDate(ns).getTime()).toBe(ms);
    });

    it('formats to a non-empty locale string', () => {
        const ns = BigInt(Date.UTC(2026, 0, 1)) * 1_000_000n;
        expect(formatTipTime(ns, 'en').length).toBeGreaterThan(0);
        expect(formatTipTime(ns, undefined).length).toBeGreaterThan(0);
    });
});
