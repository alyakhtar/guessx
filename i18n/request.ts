import { getRequestConfig } from 'next-intl/server';

export default getRequestConfig(async ({ locale }) => {
    // Ensure we have a valid locale, fallback to default if needed
    const validLocale = ['en', 'fr'].includes(locale) ? locale : 'en';

    // console.log('🏴 i18n/request.ts: Loading locale:', validLocale);

    const messages = (await import(`../messages/${validLocale}.json`)).default;
    // console.log('🏴 i18n/request.ts: Loaded messages keys:', Object.keys(messages));

    return {
        messages,
        locale: validLocale
    };
});
