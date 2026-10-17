import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { useOdinConnect } from '../odin/useOdinConnect';
import { useOdinProfile } from '../odin/useOdinProfile';
import { tokenPlaces, useTokenMeta } from '../odin/useTokenMeta';
import { useAnonymousActor } from '../canister/useAnonymousActor';
import { useCanisterActor } from '../canister/useCanisterActor';
import { useInternalBalances } from '../canister/useInternalBalances';
import { useReceivedTotals, useRecentTips } from '../canister/useTips';
import { formatTokenAmount } from '../lib/amounts';
import { shortPrincipal } from '../lib/jar';
import { JarLinkCard } from './JarLinkCard';
import { TipFeed } from './TipFeed';
import { TipForm } from './TipForm';

interface TipJarPageProps {
    /** Validated, non-anonymous principal from `?jar=`. */
    recipient: string;
}

const styles: Record<string, React.CSSProperties> = {
    back: { display: 'inline-block', marginTop: '1rem', color: 'inherit' },
    profile: {
        display: 'flex',
        alignItems: 'center',
        gap: '1rem',
        marginTop: '1rem',
    },
    avatar: {
        width: '64px',
        height: '64px',
        borderRadius: '50%',
        objectFit: 'cover',
        background: '#eee',
        flexShrink: 0,
    },
    name: { margin: 0, fontSize: '1.5rem' },
    principal: {
        fontFamily: 'ui-monospace, monospace',
        fontSize: '0.9rem',
        opacity: 0.7,
        wordBreak: 'break-all',
    },
    card: {
        border: '1px solid #e2e2e2',
        borderRadius: '12px',
        padding: '1.25rem',
        marginTop: '1.5rem',
    },
    totals: { listStyle: 'none', padding: 0, margin: 0 },
    total: {
        display: 'flex',
        justifyContent: 'space-between',
        padding: '0.35rem 0',
        borderBottom: '1px solid #f0f0f0',
        fontVariantNumeric: 'tabular-nums',
    },
    note: { fontSize: '0.9rem', opacity: 0.7, margin: 0 },
};

/**
 * A user's public tip jar: profile, lifetime received totals, their recent
 * tips, and — when the visitor is connected — a tip form locked to them.
 * Reads go through the anonymous actor so the page renders while logged out.
 */
export function TipJarPage({ recipient }: TipJarPageProps) {
    const { t } = useTranslation();
    const { status, principal } = useOdinConnect();

    // Public reads (work logged out).
    const anonActor = useAnonymousActor();
    const { profile, avatarUrl, loading: profileLoading, notFound } =
        useOdinProfile(recipient);
    const totalsState = useReceivedTotals(anonActor, recipient);
    const feed = useRecentTips(anonActor, recipient, 20);

    const totalTokenIds = useMemo(
        () => totalsState.totals.map((b) => b.token),
        [totalsState.totals],
    );
    const meta = useTokenMeta(totalTokenIds);

    // Authenticated side (only when connected): the visitor's own balances to
    // tip from.
    const actor = useCanisterActor();
    const { balances, refresh } = useInternalBalances(actor);

    const onTipped = useCallback(async () => {
        await Promise.all([refresh(), totalsState.refresh(), feed.refresh()]);
    }, [refresh, totalsState, feed]);

    const displayName =
        profile?.username ??
        (profileLoading ? t('jar.loadingProfile') : shortPrincipal(recipient));
    const isOwn = status === 'connected' && principal === recipient;

    return (
        <>
            <a href="/" style={styles.back}>
                {t('jar.back')}
            </a>

            <div style={styles.profile}>
                {avatarUrl !== null ? (
                    <img src={avatarUrl} alt={displayName} style={styles.avatar} />
                ) : (
                    <div style={styles.avatar} aria-hidden="true" />
                )}
                <div style={{ minWidth: 0 }}>
                    <h2 style={styles.name}>{t('jar.title', { name: displayName })}</h2>
                    <div style={styles.principal} title={recipient}>
                        {recipient}
                    </div>
                    {notFound ? <p style={styles.note}>{t('jar.unknownUser')}</p> : null}
                </div>
            </div>

            <section style={styles.card}>
                <h2 style={{ marginTop: 0 }}>{t('jar.receivedHeading')}</h2>
                {totalsState.error !== null ? (
                    <p style={{ ...styles.note, color: '#c0392b' }} role="alert">
                        {totalsState.error}
                    </p>
                ) : totalsState.totals.length === 0 ? (
                    <p style={styles.note}>
                        {totalsState.loading ? t('feed.loading') : t('jar.noReceived')}
                    </p>
                ) : (
                    <ul style={styles.totals}>
                        {totalsState.totals.map((b) => {
                            const m = meta.get(b.token);
                            return (
                                <li key={b.token} style={styles.total}>
                                    <span>{m?.ticker ?? b.token}</span>
                                    <strong>{formatTokenAmount(b.amount, tokenPlaces(m))}</strong>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </section>

            {isOwn ? (
                <>
                    <p>{t('jar.ownJar')}</p>
                    <JarLinkCard principal={recipient} />
                </>
            ) : status === 'connected' ? (
                <TipForm
                    actor={actor}
                    balances={balances}
                    recipient={recipient}
                    onTipped={onTipped}
                />
            ) : status === 'restoring' ? null : (
                <p>{t('jar.connectToTip')}</p>
            )}

            <TipFeed tips={feed.tips} loading={feed.loading} error={feed.error} hideTo />
        </>
    );
}
