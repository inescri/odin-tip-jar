import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { AuthBar } from './components/AuthBar';
import { HomePage } from './components/HomePage';
import { LanguageSwitcher } from './components/LanguageSwitcher';
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
        <main style={{ fontFamily: 'system-ui, sans-serif', padding: '2rem', maxWidth: '880px' }}>
            {/* Wraps as whole groups: the title and the controls each stay
                intact and move to their own line instead of being squeezed
                until words break mid-token. */}
            <header
                style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '1rem',
                }}
            >
                <h1 style={{ margin: 0 }}>
                    <a href="/" style={{ color: 'inherit', textDecoration: 'none' }}>
                        {t('app.title')}
                    </a>
                </h1>
                <div
                    style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        alignItems: 'center',
                        gap: '0.75rem',
                        marginLeft: 'auto',
                    }}
                >
                    <LanguageSwitcher />
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
