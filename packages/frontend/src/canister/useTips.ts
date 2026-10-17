import { useCallback, useEffect, useState } from 'react';
import { Principal } from '@dfinity/principal';

import type { CanisterActor, Tip } from './idl';
import type { InternalBalance } from './useInternalBalances';

function toMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}

/**
 * Recent tips from the canister's public feed, newest first. With a
 * `recipient` only tips to that principal are returned; with `null` the
 * global feed. Works with the anonymous actor. Exposes `refresh()` so the
 * tip form can reload the feed after a successful tip.
 */
export function useRecentTips(
    actor: CanisterActor | null,
    recipient: string | null,
    limit = 20,
) {
    const [tips, setTips] = useState<Tip[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const refresh = useCallback(async () => {
        if (actor === null) {
            setTips([]);
            return;
        }
        setLoading(true);
        setError(null);
        try {
            const result =
                recipient === null
                    ? await actor.getRecentTips(BigInt(limit))
                    : await actor.getTipsFor(
                          Principal.fromText(recipient),
                          BigInt(limit),
                      );
            setTips(result);
        } catch (err) {
            setError(toMessage(err));
        } finally {
            setLoading(false);
        }
    }, [actor, recipient, limit]);

    useEffect(() => {
        void refresh();
    }, [refresh]);

    return { tips, loading, error, refresh };
}

/**
 * Lifetime tip totals received by `recipient`, as (token, amount) pairs.
 * Exact regardless of feed eviction (the canister keeps a separate map).
 */
export function useReceivedTotals(
    actor: CanisterActor | null,
    recipient: string,
) {
    const [totals, setTotals] = useState<InternalBalance[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const refresh = useCallback(async () => {
        if (actor === null) {
            setTotals([]);
            return;
        }
        setLoading(true);
        setError(null);
        try {
            const entries = await actor.getReceivedTotals(
                Principal.fromText(recipient),
            );
            setTotals(
                entries.map(([token, amount]: [string, bigint]) => ({
                    token,
                    amount,
                })),
            );
        } catch (err) {
            setError(toMessage(err));
        } finally {
            setLoading(false);
        }
    }, [actor, recipient]);

    useEffect(() => {
        void refresh();
    }, [refresh]);

    return { totals, loading, error, refresh };
}
