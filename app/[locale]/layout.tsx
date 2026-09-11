import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { NextIntlClientProvider } from 'next-intl';
import ToastHost from '../../components/ToastHost';
import '../globals.css';
import Script from 'next/script';
import ThemeApplier from '../../components/ThemeApplier';
import AuthProvider from '../../components/AuthProvider';
import { auth } from '../../auth';
import { isApplicationAuthConfigured } from '../../lib/auth/config';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
    title: 'GuessX - Number Guessing Game',
    description: 'A real-time number guessing game for two players',
    icons: {
        icon: '/logo.svg',
        shortcut: '/logo.svg',
        apple: '/logo.svg',
    },
};

interface LayoutProps {
    children: React.ReactNode;
    params: Promise<{ locale: string }>;
}

export default async function RootLayout({ children, params }: LayoutProps) {
    const { locale } = await params;

    // console.log('🏴 Layout debug: rendering with locale:', locale);

    // Validate locale and fallback to default if needed
    const validLocale = ['en', 'fr'].includes(locale) ? locale : 'en';

    // Load messages directly on server
    const messages = (await import(`../../messages/${validLocale}.json`)).default;
    const applicationAuthAvailable = isApplicationAuthConfigured();
    let session = null;

    // A session lookup must never turn a temporary identity/database outage into
    // a login wall for casual guests.
    if (applicationAuthAvailable) {
        try {
            session = await auth();
        } catch {
            session = null;
        }
    }

    return (
        <html lang={validLocale} suppressHydrationWarning>
            <body className={inter.className} suppressHydrationWarning>
                <ThemeApplier />
                <AuthProvider available={applicationAuthAvailable} session={session}>
                    <NextIntlClientProvider locale={validLocale} messages={messages}>
                        {children}
                        <ToastHost />
                    </NextIntlClientProvider>
                </AuthProvider>
                <Script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js" />
            </body>
        </html>
    );
}
