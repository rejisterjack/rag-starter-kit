interface I18nConfig {
  locales: string[];
  defaultLocale: string;
  localeDetector?: boolean;
  prefixDefault?: boolean;
}

export const i18nConfig: I18nConfig = {
  locales: ['en', 'es', 'fr', 'de', 'ja', 'zh'],
  defaultLocale: 'en',
  localeDetector: false,
  prefixDefault: false,
};

export default i18nConfig;
