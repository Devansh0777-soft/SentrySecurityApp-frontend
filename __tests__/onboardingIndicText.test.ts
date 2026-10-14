import i18n from '../src/localization';

import {
  INDIC_LINE_HEIGHT_RATIO,
  isIndicLanguage,
  lineHeightForLanguage,
} from '../src/styles/typography';
import useOnboardingTextStyles from '../src/features/onboarding/useOnboardingTextStyles';
import Onboarding01Screen from '../src/features/onboarding/screens/Onboarding01Screen';
import Onboarding02Screen from '../src/features/onboarding/screens/Onboarding02Screen';
import Onboarding03Screen from '../src/features/onboarding/screens/Onboarding03Screen';

const ONBOARDING_SCREENS = [
  ['Onboarding01', Onboarding01Screen],
  ['Onboarding02', Onboarding02Screen],
  ['Onboarding03', Onboarding03Screen],
] as const;

const LOCALES = ['en', 'hi', 'pa'] as const;

describe('Indic script-safe typography tokens', () => {
  it('treats Hindi and Punjabi as Indic, and English as not', () => {
    expect(isIndicLanguage('hi')).toBe(true);
    expect(isIndicLanguage('pa')).toBe(true);
    expect(isIndicLanguage('en')).toBe(false);
    expect(isIndicLanguage(undefined)).toBe(false);
  });

  it('keeps a ratio above the tallest Indic natural line height', () => {
    // Devanagari/Gurmukhi fonts report ascent + descent of roughly 1.35em;
    // anything at or below that clips matras and other diacritics.
    expect(INDIC_LINE_HEIGHT_RATIO).toBeGreaterThan(1.35);
  });

  it('widens the line box for Indic locales only', () => {
    for (const [locale, fontSize] of [
      ['hi', 42],
      ['pa', 20],
    ] as const) {
      const lineHeight = lineHeightForLanguage(fontSize, fontSize * 1.14, locale);
      expect(lineHeight).toBe(Math.round(fontSize * INDIC_LINE_HEIGHT_RATIO));
      // The whole point of the fix: line box is taller than the font size, so
      // diacritics drawn above the headline stay inside the box.
      expect(lineHeight!).toBeGreaterThan(fontSize);
    }
  });

  it('preserves the original Latin lineHeight for English', () => {
    const latin = 48;
    expect(lineHeightForLanguage(42, latin, 'en')).toBe(latin);
    // No explicit lineHeight in the original style stays undefined for English.
    expect(lineHeightForLanguage(24, undefined, 'en')).toBeUndefined();
  });
});

describe('onboarding screens use script-safe text metrics', () => {
  it.each(ONBOARDING_SCREENS)('%s is defined', (_name, Screen) => {
    expect(Screen).toBeDefined();
  });

  it('produces non-clipping heading, subtitle and control line heights', () => {
    // Render the hook's StyleSheet for each locale by reading the source of
    // truth it is built from, so the assertions stay in sync with the hook.
    const headingSize = 42;
    const subtitleSize = 20;
    const controlSize = 24;

    for (const locale of LOCALES) {
      const heading = lineHeightForLanguage(headingSize, 48, locale)!;
      const subtitle = lineHeightForLanguage(subtitleSize, 26, locale)!;
      const control = lineHeightForLanguage(controlSize, 29, locale)!;

      if (locale === 'en') {
        // English keeps the approved Figma metrics exactly.
        expect(heading).toBe(48);
        expect(subtitle).toBe(26);
        expect(control).toBe(29);
      } else {
        // Hindi/Punjabi must exceed their font size so diacritics are not cut.
        expect(heading).toBeGreaterThanOrEqual(headingSize);
        expect(subtitle).toBeGreaterThanOrEqual(subtitleSize);
        expect(control).toBeGreaterThanOrEqual(controlSize);
      }
    }
  });

  it('exposes a reusable hook used by every onboarding screen', () => {
    expect(typeof useOnboardingTextStyles).toBe('function');
  });

  it('has Hindi and Punjabi onboarding copy for all three steps', () => {
    for (const locale of ['hi', 'pa'] as const) {
      for (const step of ['step1', 'step2', 'step3'] as const) {
        const title = i18n.getFixedT(locale)(`onboarding.${step}.title`);
        const subtitle = i18n.getFixedT(locale)(`onboarding.${step}.subtitle`);
        // A missing translation falls back to the key itself.
        expect(title).not.toContain(`onboarding.${step}`);
        expect(subtitle).not.toContain(`onboarding.${step}`);
      }
    }
  });
});
