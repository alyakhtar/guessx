'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { copyToClipboard } from '../lib/share';

export default function CopyCodeButton({ code }: { code: string }) {
  const t = useTranslations('gameRoom.accessCode');
  const [copied, setCopied] = useState(false);
  const genRef = useRef(0);

  useEffect(() => () => { genRef.current++; }, []);

  const copy = async () => {
    setCopied(false);
    const myGen = ++genRef.current;
    if (await copyToClipboard(code) && genRef.current === myGen) {
      setCopied(true);
      window.setTimeout(() => {
        if (genRef.current === myGen) setCopied(false);
      }, 2000);
    }
  };

  return <button type="button" className="btn btn-sm btn-outline-secondary ms-2" aria-live="polite" onClick={copy}>{copied ? t('copied') : t('copy')}</button>;
}
