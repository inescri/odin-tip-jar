import { useEffect, useMemo, useRef, useState } from 'react';

import { KNOWN_TOKENS } from '../lib/tokens';
import type { TokenMeta } from '../lib/tokens';
import { useOdinConnect } from './useOdinConnect';

export { tokenPlaces } from '../lib/tokens';
export type { TokenMeta } from '../lib/tokens';

/**
 * Resolve Odin token metadata (ticker, divisibility, decimals) for a set of
 * token ids via the public token endpoint — works while logged out, which
 * the tip feed and tip jar pages need.
 *
 * Ledger built-ins the endpoint does not serve (BTC) come from
 * `KNOWN_TOKENS` and are never fetched. Ids that fail to resolve are
 * remembered and not retried, and the returned Map keeps its identity when
 * nothing new resolved, so effects depending on it do not loop.
 */
export function useTokenMeta(tokenIds: readonly string[]): Map<string, TokenMeta> {
    const { getToken } = useOdinConnect();
    const [resolved, setResolved] = useState<Map<string, TokenMeta>>(
        () => new Map(KNOWN_TOKENS),
    );
    const failed = useRef(new Set<string>());

    // A stable primitive key for the id set, so a new array with the same ids
    // does not re-run the effect.
    const idsKey = useMemo(
        () => Array.from(new Set(tokenIds)).sort().join('\n'),
        [tokenIds],
    );

    useEffect(() => {
        let active = true;
        const missing = idsKey
            .split('\n')
            .filter(
                (id) => id !== '' && !resolved.has(id) && !failed.current.has(id),
            );
        if (missing.length === 0) {
            return;
        }
        Promise.all(
            missing.map((id) =>
                getToken(id)
                    .then((token) => [id, token] as const)
                    .catch(() => {
                        failed.current.add(id);
                        return null;
                    }),
            ),
        ).then((entries) => {
            if (!active) {
                return;
            }
            setResolved((prev) => {
                const next = new Map(prev);
                let changed = false;
                for (const entry of entries) {
                    if (entry !== null) {
                        next.set(entry[0], entry[1]);
                        changed = true;
                    }
                }
                return changed ? next : prev;
            });
        });
        return () => {
            active = false;
        };
    }, [idsKey, resolved, getToken]);

    return resolved;
}
