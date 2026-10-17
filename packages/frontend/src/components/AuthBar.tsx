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
    button: {
        padding: '0.5rem 1rem',
        borderRadius: '8px',
        border: 'none',
        background: '#f7931a',
        color: '#fff',
        fontWeight: 600,
        cursor: 'pointer',
        flexShrink: 0,
    },
    error: { color: '#c0392b', fontSize: '0.9rem' },
};

/**
 * Connect/account control. Renders the right affordance for each auth state:
 * a loading hint while restoring, a Connect button when disconnected (or after
 * an error, with the error shown, plus the language picker), and the account
 * pill (identity, copy, settings menu) once authenticated.
 */
export function AuthBar() {
    const { t } = useTranslation();
    const { status, principal, profile, user, error, connect, disconnect } =
        useOdinConnect();

    if (status === 'restoring') {
        return <div style={styles.bar}>{t('auth.restoring')}</div>;
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
                style={styles.button}
                onClick={connect}
                disabled={connecting}
            >
                {connecting ? t('auth.connecting') : t('auth.connect')}
            </button>
            {status === 'error' && error !== null ? (
                <span style={styles.error} role="alert">
                    {error}
                </span>
            ) : null}
        </div>
    );
}
