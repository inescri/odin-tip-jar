import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import type { InternalBalance } from '../canister/useInternalBalances';
import { tokenPlaces, useTokenMeta } from '../odin/useTokenMeta';
import { formatTokenAmount } from '../lib/amounts';

interface BalancesWidgetProps {
    balances: InternalBalance[];
    loading: boolean;
    onRefresh: () => void | Promise<void>;
}

const styles: Record<string, React.CSSProperties> = {
    card: {
        border: '1px solid #e2e2e2',
        borderRadius: '12px',
        padding: '1.25rem',
    },
    head: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '0.5rem',
    },
    heading: { margin: 0, fontSize: '1.1rem' },
    refresh: {
        padding: '0.25rem 0.6rem',
        borderRadius: '8px',
        border: '1px solid #ccc',
        background: 'transparent',
        color: 'inherit',
        fontSize: '0.8rem',
        cursor: 'pointer',
    },
    list: { listStyle: 'none', padding: 0, margin: 0 },
    ticker: { fontWeight: 600, opacity: 0.8 },
    note: { fontSize: '0.9rem', opacity: 0.7, margin: 0 },
};

/**
 * Summary of the connected user's internal (in-canister) balances — the funds
 * they can tip or withdraw. Read-only; HomePage owns the balance state so this
 * updates whenever a tip, deposit or withdraw refreshes it.
 */
export function BalancesWidget({ balances, loading, onRefresh }: BalancesWidgetProps) {
    const { t } = useTranslation();
    const tokenIds = useMemo(() => balances.map((b) => b.token), [balances]);
    const meta = useTokenMeta(tokenIds);

    return (
        <section className="balances-card" style={styles.card} aria-labelledby="balances-heading">
            <div style={styles.head}>
                <h2 id="balances-heading" style={styles.heading}>
                    {t('balances.heading')}
                </h2>
                <button
                    type="button"
                    style={styles.refresh}
                    onClick={() => void onRefresh()}
                    disabled={loading}
                >
                    {loading ? t('feed.loading') : t('balances.refresh')}
                </button>
            </div>

            {balances.length === 0 ? (
                <p style={styles.note}>{loading ? t('feed.loading') : t('balances.empty')}</p>
            ) : (
                <ul style={styles.list}>
                    {balances.map((b) => {
                        const m = meta.get(b.token);
                        return (
                            <li key={b.token} className="balances-total">
                                <span style={styles.ticker}>{m?.ticker ?? b.token}</span>
                                <span className="balances-amount">
                                    {formatTokenAmount(b.amount, tokenPlaces(m))}
                                </span>
                            </li>
                        );
                    })}
                </ul>
            )}
        </section>
    );
}
