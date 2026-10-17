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
    head: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '0.5rem',
        marginBottom: '0.5rem',
    },
    heading: { margin: 0 },
    list: { listStyle: 'none', padding: 0, margin: 0 },
    note: { margin: 0 },
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
        <section className="card balances-card" aria-labelledby="balances-heading">
            <div style={styles.head}>
                <h2 id="balances-heading" style={styles.heading}>
                    {t('balances.heading')}
                </h2>
                <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    onClick={() => void onRefresh()}
                    disabled={loading}
                >
                    {loading ? t('feed.loading') : t('balances.refresh')}
                </button>
            </div>

            {balances.length === 0 ? (
                <p className="note" style={styles.note}>{loading ? t('feed.loading') : t('balances.empty')}</p>
            ) : (
                <ul style={styles.list}>
                    {balances.map((b) => {
                        const m = meta.get(b.token);
                        return (
                            <li key={b.token} className="balances-total">
                                <span className="balances-ticker">{m?.ticker ?? b.token}</span>
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
