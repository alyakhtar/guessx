'use client';

import { useLocale, useTranslations } from 'next-intl';
import { usePathname } from 'next/navigation';
import { useUserSettings } from '../lib/useUserSettings';

export default function LocaleSelector() {
    const locale = useLocale();
    const pathname = usePathname();
    const t = useTranslations('localeSelector');
    const { darkMode } = useUserSettings();

    // Debug logging
    // console.debug('🏴 LocaleSelector debug:', { locale, pathname });

    const changeLocale = (newLocale: string) => {
        // Set locale cookie for persistence
        document.cookie = `NEXT_LOCALE=${newLocale}; Path=/; SameSite=lax`;

        // Properly extract path components
        // pathname should be like /en, /en/game/123, etc.
        const localePrefix = `/${locale}`;

        let newPath;
        if (pathname.startsWith(localePrefix)) {
            // Remove the current locale prefix and add the new one
            const pathWithoutLocale = pathname.substring(locale.length + 1);
            newPath = `/${newLocale}${pathWithoutLocale}`;
        } else {
            // Fallback - just change the URL to root with new locale
            newPath = `/${newLocale}`;
        }

        // Force a full page reload to ensure Next.js server renders with new locale
        window.location.href = newPath;
    };

    return (
        <div className="dropdown">
            <button
                className={`btn btn-sm ${darkMode ? 'btn-outline-light' : 'btn-outline-dark'} dropdown-toggle`}
                type="button"
                data-bs-toggle="dropdown"
                aria-expanded="false"
            >
                🌐 {locale === 'en' ? 'En' : 'Fr'}
            </button>
            <ul className="dropdown-menu dropdown-menu-end">
                <li>
                    <button
                        className={`dropdown-item ${locale === 'en' ? 'active' : ''}`}
                        onClick={() => changeLocale('en')}
                    >
                        🇺🇸 {t('english')}
                    </button>
                </li>
                <li>
                    <button
                        className={`dropdown-item ${locale === 'fr' ? 'active' : ''}`}
                        onClick={() => changeLocale('fr')}
                    >
                        🇫🇷 {t('french')}
                    </button>
                </li>
            </ul>
        </div>
    );
}
