import { useCallback, useEffect, useMemo, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { OdinUtils } from 'odin-connect';
import type { OdinTokenWithBalance } from 'odin-connect';

import { useOdinConnect } from '../odin/useOdinConnect';
import { approvalFor, claimRequest } from '../odin/approvalFlow';
import type { ApprovalReturnState } from '../odin/approvalFlow';
import type { CanisterActor } from '../canister/idl';
import { APP_CANISTER_ID } from '../canister/config';
import { formatTokenAmount } from '../lib/amounts';

type Stage = 'idle' | 'approving' | 'crediting' | 'done';

interface DepositFormProps {
    actor: CanisterActor | null;
    refresh: () => Promise<void>;
    /** Render without the card chrome and heading (inside the action tabs). */
    bare?: boolean;
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
    error: { color: '#c0392b', fontSize: '0.9rem', marginTop: '0.5rem' },
    ok: { color: '#1e824c', fontSize: '0.9rem', marginTop: '0.5rem' },
    note: { fontSize: '0.8rem', opacity: 0.7, marginTop: '0.75rem' },
};

/**
 * Deposit flow: user picks an Odin token + amount, the odin-connect ICRC-2
 * approval (a popup, or a redirect to Odin in wallet in-app browsers) grants
 * the app canister an allowance, then — once the approval's result is in the
 * SDK state — the canister's deposit() pulls the approved funds
 * (icrc2_transfer_from) and credits the internal ledger before the balance is
 * refreshed.
 *
 * The credit is backed by real funds because the canister moves the tokens
 * itself inside deposit() before crediting — icrcApprove alone only grants the
 * allowance.
 */
export function DepositForm({ actor, refresh, bare = false }: DepositFormProps) {
    const { t } = useTranslation();
    const { user, principal, request } = useOdinConnect();

    const [holdings, setHoldings] = useState<OdinTokenWithBalance[]>([]);
    const [selectedId, setSelectedId] = useState('');
    const [amount, setAmount] = useState('');
    const [stage, setStage] = useState<Stage>('idle');
    const [error, setError] = useState<string | null>(null);

    // Any token the user holds on Odin can be deposited — every Odin token
    // lives on the shared Odin ledger, addressed by subaccount.
    const depositable = useMemo(() => holdings, [holdings]);

    const loadHoldings = useCallback(async () => {
        if (user === null) {
            return;
        }
        try {
            const result = await user.getBalances({ page: 1, limit: 50 });
            setHoldings(result.map((b) => ({ token: b, balance: BigInt(b.balance) })));
        } catch (err) {
            setError(t('deposit.errors.loadTokens', { message: toMessage(err, t('errors.unexpected')) }));
        }
    }, [user, t]);

    useEffect(() => {
        void loadHoldings();
    }, [loadHoldings]);

    // This flow's ICRC-2 approval, if it is the SDK's latest request.
    const approval = approvalFor(request, 'deposit');
    // 'approving' is derived from the SDK state, so it is right in both modes
    // (and simply absent after a redirect reload, when the result is in).
    const shownStage: Stage =
        approval?.request.status === 'pending' ? 'approving' : stage;
    const busy = shownStage === 'approving' || shownStage === 'crediting';

    // 1. From the button: validate, then start the ICRC-2 approval of the app
    //    canister to pull `raw` of this token. Not awaited — in a wallet
    //    in-app browser the SDK redirects to Odin and the page reloads, so an
    //    awaited promise would never return. The result arrives as
    //    `request` and is handled by the effect below.
    const deposit = useCallback(() => {
        setError(null);
        setStage('idle');

        if (APP_CANISTER_ID === '') {
            setError(t('errors.noCanisterConfigured'));
            return;
        }
        if (user === null || principal === null) {
            setError(t('errors.notConnected'));
            return;
        }
        const holding = depositable.find((h) => h.token.id === selectedId);
        if (!holding) {
            setError(t('errors.selectTokenDeposit'));
            return;
        }

        let raw: bigint;
        try {
            raw = OdinUtils.convertToOdinAmount(amount, holding.token);
        } catch {
            setError(t('errors.invalidAmount'));
            return;
        }
        if (raw <= 0n) {
            setError(t('errors.amountGreaterThanZero'));
            return;
        }

        // Unlike a direct transfer this only grants an allowance — the
        // canister must call icrc2_transfer_from to actually move the funds.
        // `request.input` will carry { token, spender, amount }; `returnState`
        // tags the approval as this flow's (withdraw approves too).
        const returnState: ApprovalReturnState = { flow: 'deposit' };
        void user.icrcApprove({
            token: holding.token.id,
            spender: APP_CANISTER_ID,
            amount: raw,
            returnState,
        });
    }, [user, principal, depositable, selectedId, amount, t]);

    // 2. When the approval settles (popup, or after the redirect reload): on
    //    success, pull the approved funds into the canister and credit the
    //    internal ledger — deposit() runs icrc2_transfer_from, then credits
    //    the caller. Everything comes from `request.input`, not from form
    //    state, which a redirect wipes.
    //
    //    "success" is only a UI signal; it is not trusted as proof of the
    //    allowance. The canister's icrc2_transfer_from is the on-chain check:
    //    without a real allowance it fails and nothing is credited.
    useEffect(() => {
        const current = approvalFor(request, 'deposit');
        if (current === null) {
            return;
        }
        const { id, status, input } = current.request;
        if (status === 'rejected') {
            if (claimRequest(id)) {
                setError(t('errors.approvalRejected'));
            }
            return;
        }
        if (status === 'failed') {
            if (claimRequest(id)) {
                setError(
                    t('deposit.errors.approvalFailed', {
                        message: current.request.error ?? t('errors.unexpected'),
                    }),
                );
            }
            return;
        }
        if (status !== 'success') {
            return;
        }
        if (user !== null && user.getIdentity() === null) {
            // No delegation to call the canister with (should not happen:
            // connect requests one whenever a canister id is configured).
            if (claimRequest(id)) {
                setError(t('errors.canisterUnavailableDeposit'));
            }
            return;
        }
        if (actor === null) {
            // After a redirect reload the actor is still being built from the
            // restored delegation; this effect re-runs once it exists.
            return;
        }
        // At most once per approval: claimed before the await, so re-renders,
        // StrictMode and remounts cannot deposit twice.
        if (!claimRequest(id)) {
            return;
        }
        void (async () => {
            setError(null);
            setStage('crediting');
            try {
                await actor.deposit(input.token, input.amount);
            } catch (err) {
                setStage('idle');
                setError(t('deposit.errors.depositFailed', { message: toMessage(err, t('errors.unexpected')) }));
                return;
            }

            setStage('done');
            setAmount('');
            await refresh();
            void loadHoldings();
        })();
    }, [request, user, actor, refresh, loadHoldings, t]);

    return (
        <section style={bare ? undefined : styles.card}>
            {bare ? null : <h2 style={{ marginTop: 0 }}>{t('deposit.heading')}</h2>}

            <div style={styles.row}>
                <select
                    style={styles.select}
                    value={selectedId}
                    onChange={(e) => setSelectedId(e.target.value)}
                    disabled={busy}
                >
                    <option value="">{t('deposit.selectToken')}</option>
                    {depositable.map(({ token, balance }) => (
                        <option key={token.id} value={token.id}>
                            {token.ticker} ({formatTokenAmount(balance, token.divisibility + token.decimals)})
                        </option>
                    ))}
                </select>

                <input
                    style={styles.input}
                    type="text"
                    inputMode="decimal"
                    placeholder={t('deposit.amountPlaceholder')}
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    disabled={busy}
                />

                <button
                    type="button"
                    style={styles.button}
                    onClick={deposit}
                    disabled={busy || selectedId === '' || amount === ''}
                >
                    {shownStage === 'approving'
                        ? t('deposit.awaitingApproval')
                        : shownStage === 'crediting'
                          ? t('deposit.crediting')
                          : t('deposit.submit')}
                </button>
            </div>

            {error !== null ? (
                <div style={styles.error} role="alert">
                    {error}
                </div>
            ) : null}
            {shownStage === 'done' && error === null ? (
                <div style={styles.ok}>{t('deposit.credited')}</div>
            ) : null}

            <p style={styles.note}>
                <Trans i18nKey="deposit.note" components={[<code key="0" />, <code key="1" />]} />
            </p>
        </section>
    );
}
