import { useEffect, useState } from 'react';
import type { OdinUser } from 'odin-connect';

import { odin } from './client';

export interface OdinProfileState {
    profile: OdinUser | null;
    /** Env-aware avatar URL, only when the profile has an image. */
    avatarUrl: string | null;
    loading: boolean;
    /** The principal is not a known Odin user (it is still tippable). */
    notFound: boolean;
}

/**
 * Public Odin profile (username, avatar) for any principal, via the SDK's
 * public API — no login needed. Used by the tip jar page to show who you are
 * tipping. A lookup failure is reported as `notFound`, not thrown.
 */
export function useOdinProfile(principal: string | null): OdinProfileState {
    const [profile, setProfile] = useState<OdinUser | null>(null);
    const [loading, setLoading] = useState(false);
    const [notFound, setNotFound] = useState(false);

    useEffect(() => {
        let active = true;
        setProfile(null);
        setNotFound(false);
        if (principal === null) {
            return;
        }
        setLoading(true);
        odin.api
            .getUser(principal)
            .then((user) => {
                if (active) {
                    setProfile(user);
                }
            })
            .catch(() => {
                if (active) {
                    setNotFound(true);
                }
            })
            .finally(() => {
                if (active) {
                    setLoading(false);
                }
            });
        return () => {
            active = false;
        };
    }, [principal]);

    const avatarUrl =
        principal !== null && profile?.image
            ? odin.api.getUserAvatarUrl(principal)
            : null;

    return { profile, avatarUrl, loading, notFound };
}
