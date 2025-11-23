'use client';

import { useEffect, useState } from 'react';

interface CelebrationProps {
  type: 'win' | 'lose';
  show?: boolean;
  onComplete?: () => void;
}

export default function Celebration({ type, show = true, onComplete }: CelebrationProps) {
  // Generate random emojis for animation
  const winEmojis = ['🎉', '🎊', '🥳', '✨', '🎈', '🎀', '🎁', '💫', '🌟', '⭐'];
  const loseEmojis = ['👎', '😢', '💔', '😞', '😔', '😕', '😣', '😖', '😩', '😭'];

  const emojis = type === 'win' ? winEmojis : loseEmojis;
  const emojiElements = Array.from({ length: 30 }, (_, i) => {
    const emoji = emojis[Math.floor(Math.random() * emojis.length)];
    const delay = Math.random() * 3; // Random delay up to 3 seconds
    const duration = 4 + Math.random() * 3; // Duration between 4-7 seconds
    const left = Math.random() * 100; // Random horizontal position (0-100%)
    const fontSize = 2 + Math.random() * 1.5; // Random size between 2-3.5rem
    const rotationOffset = Math.random() * 360; // Random starting rotation

    return (
      <div
        key={i}
        className="celebration-emoji"
        style={{
          left: `${left}%`,
          animationDelay: `${delay}s`,
          animationDuration: `${duration}s`,
          fontSize: `${fontSize}rem`,
          transform: `rotate(${rotationOffset}deg)`,
        }}
      >
        {emoji}
      </div>
    );
  });

  if (!show) return null;

  return (
    <>
      <style jsx>{`
        .celebration-overlay {
          position: fixed;
          top: 0;
          left: 0;
          width: 100vw;
          height: 100vh;
          background: rgba(0, 0, 0, 0.1);
          z-index: 9999;
          pointer-events: none;
        }

        .celebration-emoji {
          position: absolute;
          animation: emojiFallDown linear forwards;
          top: -100px;
        }

        @keyframes emojiFallDown {
          0% {
            transform: translateY(-100px) rotate(0deg) scale(1);
            opacity: 0;
          }
          10% {
            opacity: 1;
          }
          90% {
            opacity: 1;
          }
          100% {
            transform: translateY(calc(100vh + 100px)) rotate(360deg) scale(0.8);
            opacity: 0;
          }
        }

        /* Reset animation for reduced motion */
        @media (prefers-reduced-motion: reduce) {
          .celebration-emoji {
            animation: none;
            opacity: 0.5;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
          }
        }
      `}</style>
      <div className="celebration-overlay">
        {emojiElements}
      </div>
    </>
  );
}
