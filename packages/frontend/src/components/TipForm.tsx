import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { OdinUtils } from 'odin-connect';
import { Principal } from '@dfinity/principal';

import { useOdinConnect } from '../odin/useOdinConnect';
import { tokenPlaces, useTokenMeta } from '../odin/useTokenMeta';
import type { CanisterActor } from '../canister/idl';
import type { InternalBalance } from '../canister/useInternalBalances';
import { APP_CANISTER_ID } from '../canister/config';
import { formatTokenAmount } from '../lib/amounts';
import { parsePrincipal, shortPrincipal } from '../lib/jar';

type Stage = 'idle' | 'tipping' | 'done';

interface TipFormProps {
    actor: CanisterActor | null;
    balances: InternalBalance[];
    /** Prefilled and locked recipient (tip jar page). Free input when absent. */
    recipient?: string;
    /** Called after a successful tip so the parent can refresh balances/feed. */
    onTipped: () => void | Promise<void>;
}

function toMessage(error: unknown, fallback: string): string {
    if (error instanceof Error) {
        return error.message;
    }
    return typeof error === 'string' ? error : fallback;
}

const styles: Record<string, React.CSSProperties> = {
    card: {
        border: '1px solid #e2e2e2',
        borderRadius: '12px',
        padding: '1.25rem',
        marginTop: '1.5rem',
    },
    row: { display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' },
    label: { fontSize: '0.85rem', opacity: 0.7, minWidth: '2.5rem' },
    recipient: {
        padding: '0.5rem',
        borderRadius: '8px',
        width: '100%',
        maxWidth: '440px',
        fontFamily: 'ui-monospace, monospace',
    },
    chip: {
        display: 'inline-block',
        padding: '0.4rem 0.6rem',
        borderRadius: '8px',
        background: '#f4f4f4',
        fontFamily: 'ui-monospace, monospace',
        fontSize: '0.9rem',
    },
    select: { padding: '0.5rem', borderRadius: '8px', minWidth: '160px' },
    input: { padding: '0.5rem', borderRadius: '8px', width: '160px' },
    button: {
        padding: '0.5rem 1rem',
        borderRadius: '8px',
        border: 'none',
        background: '#f7931a',
        color: '#fff',
        fontWeight: 600,
        cursor: 'pointer',
    },
    max: {
        padding: '0.5rem 0.6rem',
        borderRadius: '8px',
        border: '1px solid #ccc',
        background: 'transparent',
        cursor: 'pointer',
    },
    error: { color: '#c0392b', fontSize: '0.9rem', marginTop: '0.5rem' },
    ok: { color: '#1e824c', fontSize: '0.9rem', marginTop: '0.5rem' },
    note: { fontSize: '0.8rem', opacity: 0.7, marginTop: '0.75rem' },
};

/**
 * Tip flow: pick a recipient (or use the locked one), a token from the
 * caller's internal balances and an amount, then call the canister's `tip`.
 *
 * Unlike deposit/withdraw this needs no Odin approval popup or redirect —
 * the funds are already inside the canister — so the call is simply awaited
 * from the click handler. The canister is the source of truth: it re-checks
 * the balance (debit rejects overdrafts) and rejects self/anonymous tips.
 */
export function TipForm({ actor, balances, recipient, onTipped }: TipFormProps) {
    const { t } = useTranslation();
    const { principal } = useOdinConnect();

    const locked = recipient !== undefined;
    const [to, setTo] = useState(recipient ?? '');
    const [selectedTokenId, setSelectedTokenId] = useState('');
    const [amount, setAmount] = useState('');
    const [stage, setStage] = useState<Stage>('idle');
    const [error, setError] = useState<string | null>(null);

    const tokenIds = useMemo(() => balances.map((b) => b.token), [balances]);
    const meta = useTokenMeta(tokenIds);

    const selected = useMemo(
        () => balances.find((b) => b.token === selectedTokenId) ?? null,
        [balances, selectedTokenId],
    );
    const selectedToken = meta.get(selectedTokenId);
    const places = tokenPlaces(selectedToken);
    const busy = stage === 'tipping';

    const fillMax = useCallback(() => {
        // Needs real divisibility/decimals; without meta the formatted value
        // would be at the wrong scale.
        if (selected && selectedToken) {
            setAmount(formatTokenAmount(selected.amount, places));
        }
    }, [selected, selectedToken, places]);

    const sendTip = useCallback(async () => {
        setError(null);
        setStage('idle');

        if (APP_CANISTER_ID === '') {
            setError(t('errors.noCanisterConfigured'));
            return;
        }
        if (actor === null) {
            setError(t('errors.canisterUnavailableTip'));
            return;
        }
        const target = parsePrincipal(to);
        if (target === null) {
            setError(t('tip.errors.invalidRecipient'));
            return;
        }
        if (target === principal) {
            setError(t('tip.errors.selfTip'));
            return;
        }
        if (selected === null) {
            setError(t('errors.selectTokenTip'));
            return;
        }
        // Require token metadata before converting — its divisibility/decimals
        // set the scale. Guessing would tip the wrong amount.
        if (!selectedToken) {
            setError(t('errors.tokenInfoLoading'));
            return;
        }
        let raw: bigint;
        try {
            raw = OdinUtils.convertToOdinAmount(amount, selectedToken);
        } catch {
            setError(t('errors.invalidAmount'));
            return;
        }
        if (raw <= 0n) {
            setError(t('errors.amountGreaterThanZero'));
            return;
        }
        if (raw > selected.amount) {
            setError(t('errors.insufficientBalance'));
            return;
        }

        setStage('tipping');
        try {
            await actor.tip(Principal.fromText(target), selected.token, raw);
        } catch (err) {
            setStage('idle');
            setError(
                t('tip.errors.tipFailed', {
                    message: toMessage(err, t('errors.unexpected')),
                }),
            );
            return;
        }

        setStage('done');
        setAmount('');
        if (!locked) {
            setTo('');
        }
        await onTipped();
    }, [actor, to, principal, selected, selectedToken, amount, locked, onTipped, t]);

    return (
        <section style={styles.card}>
            <h2 style={{ marginTop: 0 }}>{t('tip.heading')}</h2>

            <div style={{ ...styles.row, marginBottom: '0.75rem' }}>
                <span style={styles.label}>{t('tip.recipientLabel')}</span>
                {locked ? (
                    <span style={styles.chip} title={recipient}>
                        {shortPrincipal(recipient)}
                    </span>
                ) : (
                    <input
                        style={styles.recipient}
                        type="text"
                        placeholder={t('tip.recipientPlaceholder')}
                        value={to}
                        onChange={(e) => setTo(e.target.value)}
                        disabled={busy}
                        spellCheck={false}
                        autoCapitalize="off"
                    />
                )}
            </div>

            <div style={styles.row}>
                <select
                    style={styles.select}
                    value={selectedTokenId}
                    onChange={(e) => {
                        setSelectedTokenId(e.target.value);
                        setAmount('');
                    }}
                    disabled={busy}
                >
                    <option value="">{t('tip.selectToken')}</option>
                    {balances.map((b) => {
                        const m = meta.get(b.token);
                        const label = m?.ticker ?? b.token;
                        const value = formatTokenAmount(b.amount, tokenPlaces(m));
                        return (
                            <option key={b.token} value={b.token}>
                                {label} ({value})
                            </option>
                        );
                    })}
                </select>

                <input
                    style={styles.input}
                    type="text"
                    inputMode="decimal"
                    placeholder={t('tip.amountPlaceholder')}
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    disabled={busy}
                />

                <button
                    type="button"
                    style={styles.max}
                    onClick={fillMax}
                    disabled={busy || selected === null || selectedToken === undefined}
                >
                    {t('tip.max')}
                </button>

                <button
                    type="button"
                    style={styles.button}
                    onClick={() => void sendTip()}
                    disabled={busy || selectedTokenId === '' || amount === '' || to === ''}
                >
                    {busy ? t('tip.sending') : t('tip.submit')}
                </button>
            </div>

            <p style={styles.note}>{t('tip.note')}</p>

            {error !== null ? (
                <div style={styles.error} role="alert">
                    {error}
                </div>
            ) : null}
            {stage === 'done' && error === null ? (
                <div style={styles.ok}>{t('tip.sent')}</div>
            ) : null}

            {balances.length === 0 ? (
                <p style={styles.note}>{t('tip.noBalances')}</p>
            ) : null}
        </section>
    );
}
