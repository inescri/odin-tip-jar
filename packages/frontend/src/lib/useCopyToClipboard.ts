import { useCallback, useEffect, useState } from 'react';

const COPIED_MS = 2000;

/**
 * Copy `text` to the clipboard. `copied` is true for a short moment after a
 * successful copy. When the Clipboard API is unavailable (insecure context,
 * permission denied) `onFail` runs instead, so the caller can offer a manual
 * fallback, and `failed` stays true until the next attempt.
 */
export function useCopyToClipboard(
    text: string,
    onFail?: () => void,
): { copied: boolean; failed: boolean; copy: () => Promise<void> } {
    const [copied, setCopied] = useState(false);
    const [failed, setFailed] = useState(false);

    useEffect(() => {
        if (!copied) {
            return;
        }
        const timer = window.setTimeout(() => setCopied(false), COPIED_MS);
        return () => window.clearTimeout(timer);
    }, [copied]);

    const copy = useCallback(async () => {
        try {
            await navigator.clipboard.writeText(text);
            setFailed(false);
            setCopied(true);
        } catch {
            setFailed(true);
            onFail?.();
        }
    }, [text, onFail]);

    return { copied, failed, copy };
}
