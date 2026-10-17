import { useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import { buildJarPath, buildJarUrl } from '../lib/jar';
import { useCopyToClipboard } from '../lib/useCopyToClipboard';

interface JarLinkCardProps {
    principal: string;
}

const styles: Record<string, React.CSSProperties> = {
    // Accent border so the share link stands out among the cards.
    card: { marginTop: '1.5rem', borderColor: 'var(--accent-soft)' },
    row: { display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' },
    input: { flex: '1 1 320px', fontSize: '0.8rem', padding: '0 0.75rem' },
    note: { marginTop: '0.75rem', marginBottom: 0 },
};

/** The connected user's shareable tip jar link, with copy + open actions. */
export function JarLinkCard({ principal }: JarLinkCardProps) {
    const { t } = useTranslation();
    const url = buildJarUrl(window.location.origin, principal);
    const inputRef = useRef<HTMLInputElement>(null);

    // Clipboard API unavailable (insecure context / permission): fall back to
    // selecting the text so the user can copy manually.
    const selectInput = useCallback(() => inputRef.current?.select(), []);
    const { copied, copy } = useCopyToClipboard(url, selectInput);

    return (
        <section className="card" style={styles.card}>
            <h2>{t('jar.heading')}</h2>
            <div style={styles.row}>
                <input
                    ref={inputRef}
                    className="field mono"
                    style={styles.input}
                    type="text"
                    readOnly
                    value={url}
                    onFocus={(e) => e.currentTarget.select()}
                    aria-label={t('jar.linkLabel')}
                />
                <button type="button" className="btn btn-primary" onClick={() => void copy()}>
                    {copied ? t('jar.copied') : t('jar.copy')}
                </button>
                <a href={buildJarPath(principal)} className="btn btn-outline">
                    {t('jar.open')}
                </a>
            </div>
            <p className="note" style={styles.note}>{t('jar.linkLabel')}</p>
        </section>
    );
}
