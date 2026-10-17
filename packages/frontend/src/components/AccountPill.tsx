import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { OdinConnectedUser, OdinUser } from 'odin-connect';

import { SUPPORTED_LOCALES } from '../i18n';
import { buildJarPath, shortPrincipal } from '../lib/jar';

interface AccountPillProps {
    principal: string;
    profile: OdinUser | null;
    user: OdinConnectedUser;
    onDisconnect: () => void;
}

function CopyIcon() {
    return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="9" y="9" width="13" height="13" rx="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
        </svg>
    );
}

function CheckIcon() {
    return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M20 6 9 17l-5-5" />
        </svg>
    );
}

function ChevronIcon() {
    return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="m6 9 6 6 6-6" />
        </svg>
    );
}

/**
 * Connected account control: avatar + handle + short principal in one pill,
 * a copy-principal button, and a dropdown with language, a link to the
 * user's own jar, and Disconnect. The menu closes on outside click, Escape,
 * or after any selection.
 */
export function AccountPill({ principal, profile, user, onDisconnect }: AccountPillProps) {
    const { t, i18n } = useTranslation();
    const [open, setOpen] = useState(false);
    const [copied, setCopied] = useState(false);
    const rootRef = useRef<HTMLDivElement>(null);
    const toggleRef = useRef<HTMLButtonElement>(null);

    const name = profile?.username ?? t('auth.connected');
    const initial = (profile?.username ?? '?').slice(0, 1).toUpperCase();

    useEffect(() => {
        if (!copied) {
            return;
        }
        const timer = window.setTimeout(() => setCopied(false), 1500);
        return () => window.clearTimeout(timer);
    }, [copied]);

    useEffect(() => {
        if (!open) {
            return;
        }
        const onPointer = (e: PointerEvent) => {
            if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                setOpen(false);
                toggleRef.current?.focus();
            }
        };
        document.addEventListener('pointerdown', onPointer);
        document.addEventListener('keydown', onKey);
        return () => {
            document.removeEventListener('pointerdown', onPointer);
            document.removeEventListener('keydown', onKey);
        };
    }, [open]);

    const copy = useCallback(async () => {
        try {
            await navigator.clipboard.writeText(principal);
            setCopied(true);
        } catch {
            // Clipboard API unavailable (insecure context / permission); the
            // full principal is still in the pill's tooltip.
        }
    }, [principal]);

    return (
        <div className="account" ref={rootRef}>
            <div className="account-pill">
                <button
                    type="button"
                    className="pill-main"
                    onClick={() => setOpen((v) => !v)}
                    aria-haspopup="menu"
                    aria-expanded={open}
                    title={principal}
                >
                    {profile?.image ? (
                        <img
                            // Env-aware (dev/local/prod image hosts differ).
                            src={user.buildAvatarImageUrl()}
                            alt=""
                            className="pill-avatar"
                        />
                    ) : (
                        <span className="pill-avatar" aria-hidden="true">
                            {initial}
                        </span>
                    )}
                    <span className="pill-text">
                        <span className="pill-name">{name}</span>
                        <span className="pill-principal">{shortPrincipal(principal)}</span>
                    </span>
                </button>
                <button
                    type="button"
                    className="icon-button"
                    onClick={() => void copy()}
                    aria-label={copied ? t('account.copied') : t('account.copyPrincipal')}
                    title={copied ? t('account.copied') : t('account.copyPrincipal')}
                    data-copied={copied}
                >
                    {copied ? <CheckIcon /> : <CopyIcon />}
                </button>
                <button
                    ref={toggleRef}
                    type="button"
                    className="icon-button"
                    onClick={() => setOpen((v) => !v)}
                    aria-haspopup="menu"
                    aria-expanded={open}
                    aria-label={t('account.menu')}
                >
                    <ChevronIcon />
                </button>
            </div>

            {open ? (
                <div className="menu" role="menu" aria-label={t('account.menu')}>
                    <div className="menu-label">{t('account.language')}</div>
                    {SUPPORTED_LOCALES.map((locale) => {
                        const active = i18n.resolvedLanguage === locale;
                        return (
                            <button
                                key={locale}
                                type="button"
                                role="menuitemradio"
                                aria-checked={active}
                                className="menu-item"
                                onClick={() => {
                                    void i18n.changeLanguage(locale);
                                    setOpen(false);
                                }}
                            >
                                {t(`language.${locale}`)}
                                {active ? <CheckIcon /> : null}
                            </button>
                        );
                    })}
                    <div className="menu-divider" role="separator" />
                    <a role="menuitem" className="menu-item" href={buildJarPath(principal)}>
                        {t('account.myJar')}
                    </a>
                    <button
                        type="button"
                        role="menuitem"
                        className="menu-item danger"
                        onClick={() => {
                            setOpen(false);
                            onDisconnect();
                        }}
                    >
                        {t('auth.disconnect')}
                    </button>
                </div>
            ) : null}
        </div>
    );
}
