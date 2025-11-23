'use client';

import { useState, useEffect } from 'react';
import { socketService } from '../../lib/socket';
import Lobby from '../../components/Lobby';

export default function Home() {
    const [isConnected, setIsConnected] = useState(false);

    useEffect(() => {
        const socket = socketService.connect();

        socket.on('connect', () => {
            console.log('Connected to server');
            setIsConnected(true);
        });

        socket.on('disconnect', () => {
            console.log('Disconnected from server');
            setIsConnected(false);
        });

        socket.on('connected', (data) => {
            console.log('Server connection confirmed:', data);
            setIsConnected(true);
        });

        return () => {
            // Don't disconnect here - we want to maintain connection between pages
        };
    }, []);

    return (
        <main className="container-fluid p-2 p-md-4 d-flex flex-column justify-content-center align-items-center min-vh-100">
            <div className="w-100">
                <Lobby />
            </div>
        </main>
    );
}
