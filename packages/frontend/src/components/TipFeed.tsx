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
    // Table colours live in styles.css (`.feed-table`); layout only here.
    card: { marginTop: '1.5rem' },
    tableWrap: { overflowX: 'auto' },
    amount: { fontVariantNumeric: 'tabular-nums', fontWeight: 600 },
    message: { margin: 0 },
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
        <section className="card" style={styles.card}>
            <h2>{t('feed.heading')}</h2>

            {error !== null ? (
                <p className="error" style={styles.message} role="alert">
                    {error}
                </p>
            ) : tips.length === 0 ? (
                <p className="note" style={styles.message}>
                    {loading ? t('feed.loading') : t('feed.empty')}
                </p>
            ) : (
                <div style={styles.tableWrap}>
                    <table className="feed-table">
                        <thead>
                            <tr>
                                <th>{t('feed.when')}</th>
                                <th>{t('feed.from')}</th>
                                {hideTo ? null : <th>{t('feed.to')}</th>}
                                <th>{t('feed.amount')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {tips.map((tip) => {
                                const from = tip.from.toText();
                                const to = tip.to.toText();
                                const m = meta.get(tip.tokenId);
                                return (
                                    <tr key={tip.id.toString()}>
                                        <td>
                                            {formatTipTime(tip.timestamp, i18n.resolvedLanguage)}
                                        </td>
                                        <td>
                                            <a href={buildJarPath(from)} title={from}>
                                                {shortPrincipal(from)}
                                            </a>
                                        </td>
                                        {hideTo ? null : (
                                            <td>
                                                <a href={buildJarPath(to)} title={to}>
                                                    {shortPrincipal(to)}
                                                </a>
                                            </td>
                                        )}
                                        <td style={styles.amount}>
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
