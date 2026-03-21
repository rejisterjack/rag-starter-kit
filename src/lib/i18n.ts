/**
 * Internationalization Utilities
 * 
 * Helper functions for working with translations and locale detection.
 */

import { i18nConfig } from '../../i18n.config';

/**
 * Get the supported locales from the config
 */
export const supportedLocales = i18nConfig.locales;

/**
 * Get the default locale from the config
 */
export const defaultLocale = i18nConfig.defaultLocale;

/**
 * Check if a locale is supported
 */
export function isSupportedLocale(locale: string): boolean {
  return supportedLocales.includes(locale);
}

/**
 * Get the locale from the pathname
 */
export function getLocaleFromPathname(pathname: string): string {
  const segments = pathname.split('/');
  const locale = segments[1];
  return isSupportedLocale(locale) ? locale : defaultLocale;
}

/**
 * Remove the locale prefix from a pathname
 */
export function removeLocaleFromPathname(pathname: string): string {
  const segments = pathname.split('/');
  if (isSupportedLocale(segments[1])) {
    return '/' + segments.slice(2).join('/');
  }
  return pathname;
}

/**
 * Add a locale prefix to a pathname
 */
export function addLocaleToPathname(pathname: string, locale: string): string {
  if (locale === defaultLocale && !i18nConfig.prefixDefault) {
    return pathname;
  }
  return `/${locale}${pathname}`;
}

/**
 * Locale metadata for language switcher
 */
export const localeMetadata: Record<string, { name: string; flag: string; dir: 'ltr' | 'rtl' }> = {
  en: { name: 'English', flag: '🇺🇸', dir: 'ltr' },
  es: { name: 'Español', flag: '🇪🇸', dir: 'ltr' },
  fr: { name: 'Français', flag: '🇫🇷', dir: 'ltr' },
  de: { name: 'Deutsch', flag: '🇩🇪', dir: 'ltr' },
  ja: { name: '日本語', flag: '🇯🇵', dir: 'ltr' },
  zh: { name: '中文', flag: '🇨🇳', dir: 'ltr' },
};

/**
 * Get locale metadata
 */
export function getLocaleMetadata(locale: string) {
  return localeMetadata[locale] || localeMetadata[defaultLocale];
}

/**
 * Format a number according to locale
 */
export function formatNumber(number: number, locale: string): string {
  return new Intl.NumberFormat(locale).format(number);
}

/**
 * Format a date according to locale
 */
export function formatDate(date: Date | string | number, locale: string): string {
  const d = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(d);
}

/**
 * Format a relative time (e.g., "2 hours ago")
 */
export function formatRelativeTime(date: Date | string | number, locale: string): string {
  const d = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - d.getTime()) / 1000);

  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });

  if (diffInSeconds < 60) return rtf.format(-diffInSeconds, 'second');
  if (diffInSeconds < 3600) return rtf.format(-Math.floor(diffInSeconds / 60), 'minute');
  if (diffInSeconds < 86400) return rtf.format(-Math.floor(diffInSeconds / 3600), 'hour');
  if (diffInSeconds < 604800) return rtf.format(-Math.floor(diffInSeconds / 86400), 'day');

  return formatDate(d, locale);
}
