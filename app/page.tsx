'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function RootPage() {
    const router = useRouter();

    useEffect(() => {
        // Get preferred locale from localStorage, default to 'en'
        const preferredLocale = localStorage.getItem('preferredLocale') || 'en';

        // Redirect to the preferred locale
        router.replace(`/${preferredLocale}`);
    }, [router]);

    return (
        <div className="d-flex justify-content-center align-items-center min-vh-100">
            <div className="text-center">
                <div className="spinner-border" role="status">
                    <span className="visually-hidden">Loading...</span>
                </div>
                <p className="mt-2">Setting up your language...</p>
            </div>
        </div>
    );
}
