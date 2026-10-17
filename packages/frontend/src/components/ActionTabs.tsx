import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useOdinConnect } from '../odin/useOdinConnect';
import { parseApprovalReturnState } from '../odin/approvalFlow';
import type { CanisterActor } from '../canister/idl';
import type { InternalBalance } from '../canister/useInternalBalances';
import { DepositForm } from './DepositForm';
import { TipForm } from './TipForm';
import { WithdrawForm } from './WithdrawForm';

type Tab = 'tip' | 'deposit' | 'withdraw';

const TABS: readonly Tab[] = ['tip', 'deposit', 'withdraw'];

const LABEL_KEYS = {
    tip: 'tabs.send',
    deposit: 'tabs.deposit',
    withdraw: 'tabs.withdraw',
} as const satisfies Record<Tab, string>;

interface ActionTabsProps {
    actor: CanisterActor | null;
    balances: InternalBalance[];
    refresh: () => Promise<void>;
    onTipped: () => void | Promise<void>;
}

/**
 * The main action panel: Send Tip | Deposit | Withdraw as tabs.
 *
 * Every panel stays mounted and inactive ones are only `hidden`. Deposit and
 * withdraw finish their ICRC-2 approval in an effect on the SDK `request`
 * (after a popup, or after a redirect-mode reload); unmounting an inactive
 * form would drop that effect and the deposit/withdraw would never run.
 */
export function ActionTabs({ actor, balances, refresh, onTipped }: ActionTabsProps) {
    const { t } = useTranslation();
    const { request } = useOdinConnect();
    const [active, setActive] = useState<Tab>('tip');
    const tabRefs = useRef<Partial<Record<Tab, HTMLButtonElement | null>>>({});

    // Bring the owning tab forward when a deposit/withdraw approval starts or
    // returns from a redirect, so its progress and result are visible. Keyed
    // on the request id: status changes of the same request do not re-run
    // it, so the user can still switch away while waiting.
    const requestId = request?.id ?? null;
    const approvalFlow =
        request?.action === 'icrc_approve'
            ? (parseApprovalReturnState(request.returnState)?.flow ?? null)
            : null;
    useEffect(() => {
        if (approvalFlow !== null) {
            setActive(approvalFlow);
        }
    }, [requestId, approvalFlow]);

    const onKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
        const index = TABS.indexOf(active);
        let next: Tab | null = null;
        if (e.key === 'ArrowRight') {
            next = TABS[(index + 1) % TABS.length];
        } else if (e.key === 'ArrowLeft') {
            next = TABS[(index - 1 + TABS.length) % TABS.length];
        } else if (e.key === 'Home') {
            next = TABS[0];
        } else if (e.key === 'End') {
            next = TABS[TABS.length - 1];
        }
        if (next !== null) {
            e.preventDefault();
            setActive(next);
            tabRefs.current[next]?.focus();
        }
    };

    return (
        <div className="panel">
            <div className="tabs" role="tablist" aria-label={t('tabs.label')}>
                {TABS.map((tab) => (
                    <button
                        key={tab}
                        ref={(el) => {
                            tabRefs.current[tab] = el;
                        }}
                        type="button"
                        role="tab"
                        id={`tab-${tab}`}
                        className="tab"
                        aria-selected={active === tab}
                        aria-controls={`panel-${tab}`}
                        tabIndex={active === tab ? 0 : -1}
                        onClick={() => setActive(tab)}
                        onKeyDown={onKeyDown}
                    >
                        {t(LABEL_KEYS[tab])}
                    </button>
                ))}
            </div>

            <div
                className="panel-body"
                role="tabpanel"
                id="panel-tip"
                aria-labelledby="tab-tip"
                hidden={active !== 'tip'}
            >
                <TipForm actor={actor} balances={balances} onTipped={onTipped} bare />
            </div>
            <div
                className="panel-body"
                role="tabpanel"
                id="panel-deposit"
                aria-labelledby="tab-deposit"
                hidden={active !== 'deposit'}
            >
                <DepositForm actor={actor} refresh={refresh} bare />
            </div>
            <div
                className="panel-body"
                role="tabpanel"
                id="panel-withdraw"
                aria-labelledby="tab-withdraw"
                hidden={active !== 'withdraw'}
            >
                <WithdrawForm actor={actor} balances={balances} refresh={refresh} bare />
            </div>
        </div>
    );
}
