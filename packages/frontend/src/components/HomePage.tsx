import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import { useOdinConnect } from '../odin/useOdinConnect';
import { useAnonymousActor } from '../canister/useAnonymousActor';
import { useCanisterActor } from '../canister/useCanisterActor';
import { useInternalBalances } from '../canister/useInternalBalances';
import { useRecentTips } from '../canister/useTips';
import { DepositForm } from './DepositForm';
import { JarLinkCard } from './JarLinkCard';
import { TipFeed } from './TipFeed';
import { TipForm } from './TipForm';
import { WithdrawForm } from './WithdrawForm';

/**
 * Landing page: the connected user's own jar link, deposit / withdraw / tip
 * forms, and the global recent-tips feed (visible to everyone).
 */
export function HomePage() {
    const { t } = useTranslation();
    const { status, principal } = useOdinConnect();

    // Internal balances live here so deposit, withdraw and tip share one
    // source of truth — any refresh updates every selector.
    const actor = useCanisterActor();
    const { balances, refresh } = useInternalBalances(actor);

    // The feed is public: read through the anonymous actor so it renders
    // before (and without) a login.
    const anonActor = useAnonymousActor();
    const feed = useRecentTips(anonActor, null, 20);

    const onTipped = useCallback(async () => {
        await Promise.all([refresh(), feed.refresh()]);
    }, [refresh, feed]);

    return (
        <>
            <p>{t('app.intro')}</p>

            {status === 'connected' && principal !== null ? (
                <>
                    <JarLinkCard principal={principal} />
                    <TipForm actor={actor} balances={balances} onTipped={onTipped} />
                    <DepositForm actor={actor} balances={balances} refresh={refresh} />
                    <WithdrawForm actor={actor} balances={balances} refresh={refresh} />
                </>
            ) : status === 'restoring' ? null : (
                <p>{t('app.connectPrompt')}</p>
            )}

            <TipFeed tips={feed.tips} loading={feed.loading} error={feed.error} />
        </>
    );
}
