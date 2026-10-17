import { useEffect, useState } from 'react';

import { createAnonymousActor } from './actor';
import { APP_CANISTER_ID } from './config';
import type { CanisterActor } from './idl';

/**
 * A query-only actor for public reads (the tip feed, a tip jar's totals) that
 * must work while logged out. Built once on mount. Null when no canister id
 * is configured or the agent could not be created.
 *
 * Never use it for `tip` / `deposit` / `withdraw`: those act on the caller's
 * own balance and the canister rejects anonymous callers.
 */
export function useAnonymousActor(): CanisterActor | null {
    const [actor, setActor] = useState<CanisterActor | null>(null);

    useEffect(() => {
        let active = true;
        if (APP_CANISTER_ID === '') {
            return;
        }
        createAnonymousActor()
            .then((a) => {
                if (active) {
                    setActor(a);
                }
            })
            .catch(() => {
                if (active) {
                    setActor(null);
                }
            });
        return () => {
            active = false;
        };
    }, []);

    return actor;
}
