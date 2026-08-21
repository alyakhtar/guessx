'use client';

import { useEffect } from 'react';
import GameRoom from '../../../../components/GameRoom';

export default function GamePage() {
    useEffect(() => {
        // Prevent zoom on mobile
        const viewport = document.querySelector('meta[name="viewport"]');
        if (viewport) {
            viewport.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no');
        }
    }, []);

    return <GameRoom />;
}
