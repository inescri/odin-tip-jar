import { useCallback, useEffect, useState } from 'react';

import type { CanisterActor } from './idl';

export interface InternalBalance {
    token: string; // Odin token id
    amount: bigint;
}

function toMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}

/**
 * The caller's internal ledger balances, read from the app canister. Exposes
 * `refresh()` so the deposit flow can pull the updated balance after crediting.
 *
 * `loaded` stays false until a fetch for the current actor has succeeded, so
 * callers can tell "no balances" apart from "not fetched yet". `refresh()`
 * never rejects; a failed read lands in `error`.
 */
export function useInternalBalances(actor: CanisterActor | null) {
    const [balances, setBalances] = useState<InternalBalance[]>([]);
    const [loading, setLoading] = useState(false);
    const [loaded, setLoaded] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const refresh = useCallback(async () => {
        if (actor === null) {
            setBalances([]);
            setLoaded(false);
            setError(null);
            return;
        }
        setLoading(true);
        setError(null);
        try {
            const entries = await actor.getBalances();
            setBalances(
                entries.map(([token, amount]: [string, bigint]) => ({
                    token,
                    amount,
                })),
            );
            setLoaded(true);
        } catch (err) {
            setError(toMessage(err));
        } finally {
            setLoading(false);
        }
    }, [actor]);

    useEffect(() => {
        void refresh();
    }, [refresh]);

    return { balances, loading, loaded, error, refresh };
}
