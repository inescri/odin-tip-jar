import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import type { InternalBalance } from '../canister/useInternalBalances';
import { useTokenMeta } from '../odin/useTokenMeta';
import { TokenAmountList } from './TokenAmountList';

interface BalancesWidgetProps {
    balances: InternalBalance[];
    loading: boolean;
    /** False until the first successful fetch; until then "empty" is unknown. */
    loaded: boolean;
    error: string | null;
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
    note: { margin: 0 },
    error: { margin: '0 0 0.5rem' },
};

/**
 * Summary of the connected user's internal (in-canister) balances — the funds
 * they can tip or withdraw. Read-only; HomePage owns the balance state so this
 * updates whenever a tip, deposit or withdraw refreshes it.
 */
export function BalancesWidget({ balances, loading, loaded, error, onRefresh }: BalancesWidgetProps) {
    const { t } = useTranslation();
    const tokenIds = useMemo(() => balances.map((b) => b.token), [balances]);
    const meta = useTokenMeta(tokenIds);

    return (
        <section className="card sidebar-lead" aria-labelledby="balances-heading">
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

            {error !== null ? (
                <p className="error" style={styles.error} role="alert">
                    {t('balances.error', { error })}
                </p>
            ) : null}

            {balances.length > 0 ? (
                <TokenAmountList items={balances} meta={meta} />
            ) : loaded ? (
                <p className="note" style={styles.note}>{t('balances.empty')}</p>
            ) : error === null ? (
                // Not fetched yet (actor still resolving or first read in flight).
                <p className="note" style={styles.note}>{t('feed.loading')}</p>
            ) : null}
        </section>
    );
}
