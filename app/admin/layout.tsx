import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { NextIntlClientProvider } from 'next-intl';
import Script from 'next/script';
import ToastHost from '../../components/ToastHost';
import ThemeApplier from '../../components/ThemeApplier';
import messages from '../../messages/en.json';
import { authorizeAdminHeaders } from '../../lib/adminAuth';
import '../globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
    title: 'GuessX Admin',
    description: 'GuessX administration',
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
    const authorization = await authorizeAdminHeaders(await headers());

    if (!authorization.ok) notFound();

    return (
        <html lang="en" suppressHydrationWarning>
            <body className={inter.className} suppressHydrationWarning>
                <ThemeApplier />
                <NextIntlClientProvider locale="en" messages={messages}>
                    {children}
                    <ToastHost />
                </NextIntlClientProvider>
                <Script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js" />
            </body>
        </html>
    );
}
