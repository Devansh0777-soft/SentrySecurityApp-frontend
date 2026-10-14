import type { TextStyle } from 'react-native';

export const typography = {
  fontFamily: 'Inter',

  sizes: {
    xs: 12,
    sm: 14,
    md: 16,
    lg: 18,
    xl: 20,
    xxl: 24,
    xxxl: 32,
    display: 42,
  },

  weights: {
    regular: '400',
    medium: '500',
    semiBold: '600',
    bold: '700',
    extraBold: '800',
  },
} as const;

/**
 * Locales rendered with Devanagari (Hindi) or Gurmukhi (Punjabi) scripts.
 */
export const INDIC_LANGUAGES = ['hi', 'pa'] as const;

/**
 * Minimum lineHeight ÷ fontSize ratio that safely fits Devanagari/Gurmukhi.
 *
 * React Native applies `lineHeight` as an *exact* line box (Android:
 * CustomLineHeightSpan, iOS: NSParagraphStyle). Both scripts add vowel signs
 * (matras) and other diacritics above and below the headline, so their natural
 * ascent + descent is far taller than Latin (~1.35em vs ~1.17em). Any ratio
 * below that pushes diacritics outside the line box, where the platform clips
 * them — the "top of the text is cut off" bug. 1.45 keeps a safe margin above
 * the tallest OEM Android Indic fonts.
 */
export const INDIC_LINE_HEIGHT_RATIO = 1.45;

/** True when a locale needs the extra vertical room for Indic diacritics. */
export const isIndicLanguage = (language?: string): boolean =>
  !!language && (INDIC_LANGUAGES as readonly string[]).includes(language);

/**
 * Returns a lineHeight that never clips Devanagari/Gurmukhi diacritics, while
 * preserving the designer's original Latin lineHeight so approved English
 * layouts are untouched.
 *
 * Pass `undefined` as `latinLineHeight` when the original style had no explicit
 * lineHeight (platform natural metrics) — that stays natural for Latin locales.
 */
export const lineHeightForLanguage = (
  fontSize: number,
  latinLineHeight: number | undefined,
  language?: string,
): number | undefined =>
  isIndicLanguage(language)
    ? Math.round(fontSize * INDIC_LINE_HEIGHT_RATIO)
    : latinLineHeight;

/**
 * Base style for every translated <Text>.
 *
 * Android reserves extra top/bottom "font padding" derived from Latin metrics
 * and adds it on top of the line box, which displaces Indic glyphs. Disabling it
 * (iOS ignores this prop) makes Android measure text from the real font metrics.
 */
export const scriptSafeText: TextStyle = {
  includeFontPadding: false,
};
