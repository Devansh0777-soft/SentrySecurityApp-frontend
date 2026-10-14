import { useMemo } from 'react';
import { StyleSheet, type TextStyle } from 'react-native';
import { useTranslation } from 'react-i18next';

import { colors } from '../../styles/colors';
import { scaleHeight, scaleFont } from '../../styles/dimensions';
import {
  INDIC_LINE_HEIGHT_RATIO,
  isIndicLanguage,
  lineHeightForLanguage,
  scriptSafeText,
} from '../../styles/typography';

/**
 * Builds the script-safe text styles shared by every onboarding screen.
 *
 * Why this exists: Hindi (Devanagari) and Punjabi (Gurmukhi) render matras and
 * other diacritics above and below the headline, so they need a taller line box
 * than the Latin-tuned values in the Figma spec. React Native treats `lineHeight`
 * as an exact line box, so a value below the font's ascent + descent clips the
 * top of the text. Android additionally adds Latin-derived "font padding" on top
 * of the line box, which displaces Indic glyphs further.
 *
 * This hook keeps the exact Latin metrics for English (no visual change) and only
 * widens the line box — plus disables Android font padding — for hi/pa. All sizes
 * stay in Figma units and are scaled, so the fix remains responsive across screen
 * sizes, resolutions and Android/iOS.
 *
 * `subtitle` carries its own `marginTop` so the heading/subtitle pair can be laid
 * out with normal flow instead of two hard-coded absolute `top` offsets. That
 * removes the fixed-spacing collision when translated text needs an extra line,
 * while landing on the exact same pixels for English.
 */
export const useOnboardingTextStyles = () => {
  const { i18n } = useTranslation();
  const language = i18n.resolvedLanguage ?? i18n.language;

  return useMemo(() => {
    // Figma sizes (design units); scaleFont keeps them responsive.
    const headingSize = scaleFont(42);
    const subtitleSize = scaleFont(20);
    const controlSize = scaleFont(24);

    const indic = isIndicLanguage(language);

    const heading: TextStyle = {
      ...scriptSafeText,
      fontSize: headingSize,
      fontWeight: '800',
      color: colors.primary,
      lineHeight: lineHeightForLanguage(headingSize, scaleFont(48), language),
    };

    const subtitle: TextStyle = {
      ...scriptSafeText,
      fontSize: subtitleSize,
      color: '#000000',
      lineHeight: lineHeightForLanguage(subtitleSize, scaleFont(26), language),
      // Figma gap is 24px. Indic line boxes already carry generous internal
      // leading, so halve it to keep a 3-line subtitle clear of the dots row.
      marginTop: scaleHeight(indic ? 12 : 24),
    };

    // Skip / Next / Get Started labels.
    const control: TextStyle = {
      ...scriptSafeText,
      fontSize: controlSize,
      fontWeight: '600',
      lineHeight: lineHeightForLanguage(controlSize, scaleFont(29), language),
    };

    const skipText: TextStyle = { ...control, color: '#000000' };
    const actionText: TextStyle = { ...control, color: colors.white };

    return StyleSheet.create({
      heading,
      subtitle,
      skipText,
      actionText,
    });
  }, [language]);
};

export { INDIC_LINE_HEIGHT_RATIO };
export default useOnboardingTextStyles;
