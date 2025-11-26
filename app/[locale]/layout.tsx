import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { NextIntlClientProvider } from 'next-intl';
import '../globals.css';
import Script from 'next/script';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
    title: 'GuessX - Number Guessing Game',
    description: 'A real-time number guessing game for two players',
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

    return (
        <html lang={validLocale} suppressHydrationWarning>
            <body className={inter.className} suppressHydrationWarning>
                <NextIntlClientProvider locale={validLocale} messages={messages}>
                    {children}
                </NextIntlClientProvider>
                <Script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js" />
            </body>
        </html>
    );
}
