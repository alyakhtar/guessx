'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import type { QuickReaction, QuickReactionEvent } from '../types/game';

const reactions: QuickReaction[] = ['nice', 'close', 'gg'];

export function QuickReactionButtons({ disabled, onReact }: { disabled?: boolean; onReact: (reaction: QuickReaction) => void }) {
  const t = useTranslations('quickReactions');
  const [coolingDown, setCoolingDown] = useState(false);

  useEffect(() => {
    if (!coolingDown) return;
    const timer = setTimeout(() => setCoolingDown(false), 2000);
    return () => clearTimeout(timer);
  }, [coolingDown]);

  return (
    <div className="d-flex flex-wrap justify-content-center gap-2" aria-label={t('title')}>
      {reactions.map((reaction) => (
        <button
          type="button"
          key={reaction}
          className="btn btn-sm btn-outline-secondary"
          disabled={disabled || coolingDown}
          onClick={() => {
            onReact(reaction);
            setCoolingDown(true);
          }}
        >
          {t(`presets.${reaction}`)}
        </button>
      ))}
    </div>
  );
}

export function QuickReactionOverlay({ reaction }: { reaction: QuickReactionEvent }) {
  const t = useTranslations('quickReactions');

  return (
    <div className="position-absolute top-0 start-50 translate-middle-x z-1 mt-1">
      <span className="badge rounded-pill text-bg-primary shadow-sm px-3 py-2" role="status" aria-live="polite">
        {t(`presets.${reaction.reaction}`)}
      </span>
    </div>
  );
}
