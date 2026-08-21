'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { buildShareUrl, canNativeShare, copyToClipboard } from '../lib/share';

export default function ShareRoomButton({ roomId, accessCode }: { roomId: string; accessCode?: string }) {
  const locale = useLocale();
  const t = useTranslations('gameRoom.share');
  const [copied, setCopied] = useState(false);

  const share = async () => {
    const url = buildShareUrl(roomId, accessCode, locale);
    if (canNativeShare()) {
      try {
        await navigator.share({ title: t('title'), text: t('text'), url });
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return;
      }
    }
    if (await copyToClipboard(url)) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    }
  };

  return <button type="button" className="btn btn-outline-primary" onClick={share}>{copied ? t('copied') : t('button')}</button>;
}
