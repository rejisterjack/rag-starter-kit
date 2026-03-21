/** @type {import('next-i18n-router').Config} */
const i18nConfig = {
  locales: ['en', 'es', 'fr', 'de', 'ja', 'zh'],
  defaultLocale: 'en',
  localeDetector: false,
  prefixDefault: false,
};

module.exports = i18nConfig;
