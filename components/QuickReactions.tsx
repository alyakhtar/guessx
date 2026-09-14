'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import type { QuickReaction, QuickReactionEvent } from '../types/game';
import { showToast } from '../lib/toast';

const reactions: QuickReaction[] = ['nice', 'close', 'gg', 'fire', 'wow', 'lol', 'thumbsUp', 'thumbsDown', 'heart'];
const REACTION_COOLDOWN_MS = 10_000;
export const reactionEmoji: Record<QuickReaction, string> = {
  nice: '👏',
  close: '😱',
  gg: '🤝',
  fire: '🔥',
  wow: '🤯',
  lol: '😂',
  thumbsUp: '👍',
  thumbsDown: '👎',
  heart: '❤️',
};

export function QuickReactionButtons({ disabled, onReact }: { disabled?: boolean; onReact: (reaction: QuickReaction) => void }) {
  const t = useTranslations('quickReactions');
  const [coolingDown, setCoolingDown] = useState(false);

  useEffect(() => {
    if (!coolingDown) return;
    const timer = setTimeout(() => setCoolingDown(false), REACTION_COOLDOWN_MS);
    return () => clearTimeout(timer);
  }, [coolingDown]);

  return (
    <div className="quick-reaction-buttons" aria-label={t('title')}>
      {reactions.map((reaction) => (
        <button
          type="button"
          key={reaction}
          className={`btn btn-sm btn-outline-secondary quick-reaction-button ${disabled || coolingDown ? 'disabled' : ''}`}
          aria-disabled={disabled || coolingDown}
          aria-label={t(`presets.${reaction}`)}
          title={t(`presets.${reaction}`)}
          onClick={() => {
            if (coolingDown) {
              showToast(t('cooldown'), { variant: 'info' });
              return;
            }
            if (disabled) return;
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

export function QuickReactionCelebration({ reaction }: { reaction: QuickReactionEvent }) {
  const t = useTranslations('quickReactions');
  const emoji = reactionEmoji[reaction.reaction];

  return (
    <div className="quick-reaction-celebration" role="status" aria-live="polite">
      <div className="quick-reaction-celebration__wash" aria-hidden="true" />
      <div className="quick-reaction-celebration__content">
        <span className="quick-reaction-celebration__emoji" aria-hidden="true">{emoji}</span>
        <span className="quick-reaction-celebration__label">{t(`presets.${reaction.reaction}`)}</span>
      </div>
      <span className="quick-reaction-celebration__burst quick-reaction-celebration__burst--one" aria-hidden="true">{emoji}</span>
      <span className="quick-reaction-celebration__burst quick-reaction-celebration__burst--two" aria-hidden="true">{emoji}</span>
      <span className="quick-reaction-celebration__burst quick-reaction-celebration__burst--three" aria-hidden="true">{emoji}</span>
    </div>
  );
}
