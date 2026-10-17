import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { AuthBar } from './components/AuthBar';
import { HomePage } from './components/HomePage';
import { TipJarPage } from './components/TipJarPage';
import { useOdinConnect } from './odin/useOdinConnect';
import { readJarParam } from './lib/jar';

export function App() {
    const { t } = useTranslation();
    const { status } = useOdinConnect();

    // `?jar=<principal>` selects a tip jar page. Read it only once the SDK has
    // finished restoring: after a redirect-mode connect Odin returns to the
    // bare path and odin-connect puts the original query back in `ready()`,
    // which is exactly when `status` leaves 'restoring'. The param is left in
    // the URL — it is the page's identity, not one-shot state like `?lang=`.
    const jar = useMemo(
        () => (status === 'restoring' ? null : readJarParam(window.location.search)),
        [status],
    );

    return (
        <main className="app">
            {/* Wraps as whole groups: the title and the account control each
                stay intact and move to their own line instead of being
                squeezed until words break mid-token. */}
            <header className="app-header">
                <h1>
                    <a href="/">{t('app.title')}</a>
                </h1>
                <div className="header-controls">
                    <AuthBar />
                </div>
            </header>

            {status === 'restoring' ? (
                <p>{t('auth.restoring')}</p>
            ) : jar !== null ? (
                <TipJarPage recipient={jar} />
            ) : (
                <HomePage />
            )}
        </main>
    );
}
