import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;

    // Skip internal paths and static files
    if (
        pathname.startsWith('/api') ||
        pathname.startsWith('/_next') ||
        pathname.includes('.') ||
        pathname === '/favicon.ico'
    ) {
        return NextResponse.next();
    }

    // Check if path already has a locale
    const localePattern = /^\/(en|fr)(\/|$)/;
    if (localePattern.test(pathname)) {
        return NextResponse.next();
    }

    // Get preferred locale from cookie, default to 'en'
    const preferredLocale = request.cookies.get('NEXT_LOCALE')?.value || 'en';

    // Valid locale check
    const validLocale = ['en', 'fr'].includes(preferredLocale) ? preferredLocale : 'en';

    // Redirect to the preferred locale
    const newUrl = new URL(`/${validLocale}${pathname === '/' ? '' : pathname}`, request.url);
    return NextResponse.redirect(newUrl);
}

export const config = {
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - api (API routes)
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         * - files with extensions (like .png, .jpg, etc.)
         */
        '/((?!api|_next/static|_next/image|favicon.ico).*)'
    ]
};
