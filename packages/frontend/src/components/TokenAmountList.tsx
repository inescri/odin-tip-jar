import { tokenPlaces, type TokenMeta } from '../odin/useTokenMeta';
import { formatTokenAmount } from '../lib/amounts';

interface TokenAmountListProps {
    items: readonly { token: string; amount: bigint }[];
    meta: ReadonlyMap<string, TokenMeta>;
}

const styles: Record<string, React.CSSProperties> = {
    list: { listStyle: 'none', padding: 0, margin: 0 },
};

/** Ticker + formatted amount per token, as shown in the sidebar cards. */
export function TokenAmountList({ items, meta }: TokenAmountListProps) {
    return (
        <ul style={styles.list}>
            {items.map((item) => {
                const m = meta.get(item.token);
                return (
                    <li key={item.token} className="balances-total">
                        <span className="balances-ticker">{m?.ticker ?? item.token}</span>
                        <span className="balances-amount">
                            {formatTokenAmount(item.amount, tokenPlaces(m))}
                        </span>
                    </li>
                );
            })}
        </ul>
    );
}
