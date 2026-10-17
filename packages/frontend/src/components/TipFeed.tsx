import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import type { Tip } from '../canister/idl';
import { tokenPlaces, useTokenMeta } from '../odin/useTokenMeta';
import { formatTokenAmount } from '../lib/amounts';
import { buildJarPath, formatTipTime, shortPrincipal } from '../lib/jar';

interface TipFeedProps {
    tips: Tip[];
    loading: boolean;
    error?: string | null;
    /** Hide the "to" column (every row has the same recipient). */
    hideTo?: boolean;
}

const styles: Record<string, React.CSSProperties> = {
    card: {
        border: '1px solid #e2e2e2',
        borderRadius: '12px',
        padding: '1.25rem',
        marginTop: '1.5rem',
    },
    tableWrap: { overflowX: 'auto' },
    table: { width: '100%', borderCollapse: 'collapse', fontSize: '0.95rem' },
    th: {
        textAlign: 'left',
        padding: '0.5rem 0.6rem',
        borderBottom: '1px solid #e2e2e2',
        fontWeight: 600,
        fontSize: '0.85rem',
        opacity: 0.8,
        whiteSpace: 'nowrap',
    },
    td: {
        padding: '0.5rem 0.6rem',
        borderBottom: '1px solid #f0f0f0',
        whiteSpace: 'nowrap',
    },
    principal: {
        fontFamily: 'ui-monospace, monospace',
        color: 'inherit',
    },
    amount: { fontVariantNumeric: 'tabular-nums', fontWeight: 600 },
    note: { fontSize: '0.9rem', opacity: 0.7, margin: 0 },
    error: { color: '#c0392b', fontSize: '0.9rem', margin: 0 },
};

/**
 * Public tip feed table. Principals link to the sender's / recipient's own
 * tip jar page. Token tickers and amount scaling come from the public token
 * endpoint, so the table renders while logged out.
 */
export function TipFeed({ tips, loading, error = null, hideTo = false }: TipFeedProps) {
    const { t, i18n } = useTranslation();
    const tokenIds = useMemo(() => tips.map((tip) => tip.tokenId), [tips]);
    const meta = useTokenMeta(tokenIds);

    return (
        <section style={styles.card}>
            <h2 style={{ marginTop: 0 }}>{t('feed.heading')}</h2>

            {error !== null ? (
                <p style={styles.error} role="alert">
                    {error}
                </p>
            ) : tips.length === 0 ? (
                <p style={styles.note}>
                    {loading ? t('feed.loading') : t('feed.empty')}
                </p>
            ) : (
                <div style={styles.tableWrap}>
                    <table style={styles.table}>
                        <thead>
                            <tr>
                                <th style={styles.th}>{t('feed.when')}</th>
                                <th style={styles.th}>{t('feed.from')}</th>
                                {hideTo ? null : <th style={styles.th}>{t('feed.to')}</th>}
                                <th style={styles.th}>{t('feed.amount')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {tips.map((tip) => {
                                const from = tip.from.toText();
                                const to = tip.to.toText();
                                const m = meta.get(tip.tokenId);
                                return (
                                    <tr key={tip.id.toString()}>
                                        <td style={styles.td}>
                                            {formatTipTime(tip.timestamp, i18n.resolvedLanguage)}
                                        </td>
                                        <td style={styles.td}>
                                            <a href={buildJarPath(from)} style={styles.principal} title={from}>
                                                {shortPrincipal(from)}
                                            </a>
                                        </td>
                                        {hideTo ? null : (
                                            <td style={styles.td}>
                                                <a href={buildJarPath(to)} style={styles.principal} title={to}>
                                                    {shortPrincipal(to)}
                                                </a>
                                            </td>
                                        )}
                                        <td style={{ ...styles.td, ...styles.amount }}>
                                            {formatTokenAmount(tip.amount, tokenPlaces(m))}{' '}
                                            {m?.ticker ?? tip.tokenId}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </section>
    );
}
