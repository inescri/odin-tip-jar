import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { buildJarPath, buildJarUrl } from '../lib/jar';

interface JarLinkCardProps {
    principal: string;
}

const styles: Record<string, React.CSSProperties> = {
    card: {
        border: '1px solid #f7931a',
        borderRadius: '12px',
        padding: '1.25rem',
        marginTop: '1.5rem',
        background: '#fff8f0',
    },
    row: { display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' },
    input: {
        padding: '0.5rem',
        borderRadius: '8px',
        border: '1px solid #ccc',
        flex: '1 1 320px',
        minWidth: 0,
        fontFamily: 'ui-monospace, monospace',
        fontSize: '0.9rem',
    },
    button: {
        padding: '0.5rem 1rem',
        borderRadius: '8px',
        border: 'none',
        background: '#f7931a',
        color: '#fff',
        fontWeight: 600,
        cursor: 'pointer',
    },
    link: {
        padding: '0.5rem 0.8rem',
        borderRadius: '8px',
        border: '1px solid #ccc',
        color: 'inherit',
        textDecoration: 'none',
    },
    note: { fontSize: '0.85rem', opacity: 0.75, marginTop: '0.75rem', marginBottom: 0 },
};

/** The connected user's shareable tip jar link, with copy + open actions. */
export function JarLinkCard({ principal }: JarLinkCardProps) {
    const { t } = useTranslation();
    const url = buildJarUrl(window.location.origin, principal);
    const [copied, setCopied] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (!copied) {
            return;
        }
        const timer = window.setTimeout(() => setCopied(false), 2000);
        return () => window.clearTimeout(timer);
    }, [copied]);

    const copy = useCallback(async () => {
        try {
            await navigator.clipboard.writeText(url);
            setCopied(true);
        } catch {
            // Clipboard API unavailable (insecure context / permission): fall
            // back to selecting the text so the user can copy manually.
            inputRef.current?.select();
        }
    }, [url]);

    return (
        <section style={styles.card}>
            <h2 style={{ marginTop: 0 }}>{t('jar.heading')}</h2>
            <div style={styles.row}>
                <input
                    ref={inputRef}
                    style={styles.input}
                    type="text"
                    readOnly
                    value={url}
                    onFocus={(e) => e.currentTarget.select()}
                    aria-label={t('jar.linkLabel')}
                />
                <button type="button" style={styles.button} onClick={() => void copy()}>
                    {copied ? t('jar.copied') : t('jar.copy')}
                </button>
                <a href={buildJarPath(principal)} style={styles.link}>
                    {t('jar.open')}
                </a>
            </div>
            <p style={styles.note}>{t('jar.linkLabel')}</p>
        </section>
    );
}
