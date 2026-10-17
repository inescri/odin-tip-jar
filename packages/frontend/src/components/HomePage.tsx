import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import { useOdinConnect } from '../odin/useOdinConnect';
import { useAnonymousActor } from '../canister/useAnonymousActor';
import { useCanisterActor } from '../canister/useCanisterActor';
import { useInternalBalances } from '../canister/useInternalBalances';
import { useRecentTips } from '../canister/useTips';
import { ActionTabs } from './ActionTabs';
import { BalancesWidget } from './BalancesWidget';
import { JarLinkCard } from './JarLinkCard';
import { TipFeed } from './TipFeed';

/**
 * Landing page. Connected: the tabbed action panel (send / deposit /
 * withdraw) beside a sidebar with internal balances and the user's jar link.
 * Everyone: the global recent-tips feed.
 */
export function HomePage() {
    const { t } = useTranslation();
    const { status, principal } = useOdinConnect();

    // Internal balances live here so deposit, withdraw and tip share one
    // source of truth — any refresh updates every selector.
    const actor = useCanisterActor();
    const { balances, loading, refresh } = useInternalBalances(actor);

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
                <div className="layout">
                    <div className="layout-main">
                        <ActionTabs
                            actor={actor}
                            balances={balances}
                            refresh={refresh}
                            onTipped={onTipped}
                        />
                    </div>
                    <aside className="layout-sidebar">
                        <BalancesWidget balances={balances} loading={loading} onRefresh={refresh} />
                        <JarLinkCard principal={principal} />
                    </aside>
                </div>
            ) : status === 'restoring' ? null : (
                <p>{t('app.connectPrompt')}</p>
            )}

            <TipFeed tips={feed.tips} loading={feed.loading} error={feed.error} />
        </>
    );
}
