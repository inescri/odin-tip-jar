import { useTranslation } from 'react-i18next';

import { useOdinConnect } from '../odin/useOdinConnect';
import { AccountPill } from './AccountPill';
import { LanguageSwitcher } from './LanguageSwitcher';

const styles: Record<string, React.CSSProperties> = {
    bar: {
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: '0.75rem',
        minHeight: '40px',
    },
};

/**
 * Connect/account control. Renders the right affordance for each auth state:
 * a loading hint while restoring, a Connect button when disconnected (or after
 * an error, with the error shown), and the account pill (identity, copy,
 * settings menu) once authenticated. The language picker sits in the bar
 * until the account menu takes it over.
 */
export function AuthBar() {
    const { t } = useTranslation();
    const { status, principal, profile, user, error, connect, disconnect } =
        useOdinConnect();

    if (status === 'restoring') {
        return (
            <div style={styles.bar}>
                <LanguageSwitcher />
                {t('auth.restoring')}
            </div>
        );
    }

    if (status === 'connected' && principal !== null && user !== null) {
        return (
            <AccountPill
                principal={principal}
                profile={profile}
                user={user}
                onDisconnect={disconnect}
            />
        );
    }

    const connecting = status === 'connecting';
    return (
        <div style={styles.bar}>
            {/* Logged out there is no account menu, so language stays here. */}
            <LanguageSwitcher />
            <button
                type="button"
                className="btn btn-primary"
                onClick={connect}
                disabled={connecting}
            >
                {connecting ? t('auth.connecting') : t('auth.connect')}
            </button>
            {status === 'error' && error !== null ? (
                <span className="error" role="alert">
                    {error}
                </span>
            ) : null}
        </div>
    );
}
