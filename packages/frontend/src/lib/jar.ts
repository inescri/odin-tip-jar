import { Principal } from '@dfinity/principal';

/**
 * Query parameter that selects a tip jar page: `/?jar=<principal>`.
 *
 * Deliberately not called `to` or `redirect`: the README warns against
 * open-redirect-looking params, and this one is never used as a navigation
 * target — only validated as a principal and passed to the canister.
 */
export const JAR_PARAM = 'jar';

/**
 * Validate free-form text as a tippable principal. Returns the canonical
 * principal text, or null when the text is not a principal or is the
 * anonymous principal (which can never withdraw, so tipping it burns funds).
 */
export function parsePrincipal(text: string): string | null {
    const trimmed = text.trim();
    if (trimmed === '') {
        return null;
    }
    try {
        const principal = Principal.fromText(trimmed);
        return principal.isAnonymous() ? null : principal.toText();
    } catch {
        return null;
    }
}

/**
 * Read and validate `?jar=` from a `location.search` string. Null when absent
 * or invalid. Callers must only read the URL once odin-connect has finished
 * restoring (`status !== 'restoring'`): after a redirect-mode connect the SDK
 * puts the original query string back in `ready()`.
 */
export function readJarParam(search: string): string | null {
    const value = new URLSearchParams(search).get(JAR_PARAM);
    return value === null ? null : parsePrincipal(value);
}

/** Same-origin path to a tip jar, for in-app links. */
export function buildJarPath(principal: string): string {
    return `/?${JAR_PARAM}=${encodeURIComponent(principal)}`;
}

/** Absolute, shareable tip jar URL. */
export function buildJarUrl(origin: string, principal: string): string {
    return `${origin}${buildJarPath(principal)}`;
}

/** Shorten a principal for display: `abcde-…-xyz12`. */
export function shortPrincipal(principal: string): string {
    if (principal.length <= 16) {
        return principal;
    }
    return `${principal.slice(0, 6)}…${principal.slice(-5)}`;
}

/** Convert an IC timestamp (nanoseconds since epoch, bigint) to a Date. */
export function tipTimeToDate(ns: bigint): Date {
    return new Date(Number(ns / 1_000_000n));
}

/** Locale-formatted date-time for a tip's IC timestamp. */
export function formatTipTime(ns: bigint, locale: string | undefined): string {
    return tipTimeToDate(ns).toLocaleString(locale, {
        dateStyle: 'medium',
        timeStyle: 'short',
    });
}
