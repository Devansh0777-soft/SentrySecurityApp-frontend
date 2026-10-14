import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  Pressable,
  StyleSheet,
} from 'react-native';
import Feather from 'react-native-vector-icons/Feather';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../../styles/colors';
import { scaleWidth, scaleHeight, scaleFont } from '../../styles/dimensions';
import {
  INDIC_LINE_HEIGHT_RATIO,
  scriptSafeText,
} from '../../styles/typography';

const LANGUAGES = [
  { code: 'en', shortLabel: '', label: 'English', nativeLabel: '' },
  { code: 'hi', shortLabel: 'हिं', label: 'Hindi', nativeLabel: 'हिंदी' },
  { code: 'pa', shortLabel: 'ਪੰ', label: 'Punjabi', nativeLabel: 'ਪੰਜਾਬੀ' },
];

const LanguageSelector: React.FC = () => {
  const { i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const [visible, setVisible] = useState(false);

  const current = LANGUAGES.find(l => l.code === i18n.language) ?? LANGUAGES[0];

  const selectLanguage = (code: string) => {
    i18n.changeLanguage(code);
    setVisible(false);
  };

  return (
    <>
      <TouchableOpacity
        style={styles.pill}
        onPress={() => setVisible(true)}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        accessibilityRole="button"
        accessibilityLabel={`Language: ${current.label}`}
        accessibilityHint="Opens the language menu"
        accessibilityState={{ expanded: visible }}
      >
        <Feather name="globe" size={scaleFont(20)} color={colors.primary} />
        <Text style={styles.text}>{current.code.toUpperCase()}</Text>
        <Feather
          name={visible ? 'chevron-up' : 'chevron-down'}
          size={scaleFont(20)}
          color={colors.primary}
        />
      </TouchableOpacity>

      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={() => setVisible(false)}
      >
        <Pressable
          style={[
            styles.overlay,
            {
              paddingTop: Math.max(
                scaleHeight(72),
                insets.top + scaleHeight(16),
              ),
            },
          ]}
          onPress={() => setVisible(false)}
        >
          <View style={styles.dropdown} onStartShouldSetResponder={() => true}>
            {LANGUAGES.map(lang => (
              <TouchableOpacity
                key={lang.code}
                style={styles.option}
                onPress={() => selectLanguage(lang.code)}
              >
                {lang.code === 'en' ? (
                  <Feather
                    name="globe"
                    size={scaleFont(20)}
                    color={colors.primary}
                  />
                ) : (
                  <Text style={styles.shortLabel}>{lang.shortLabel}</Text>
                )}
                <Text style={styles.optionText}>{lang.label}</Text>
                {!!lang.nativeLabel && (
                  <Text style={styles.nativeLabel}>{lang.nativeLabel}</Text>
                )}
                {lang.code === current.code && (
                  <Feather
                    name="check"
                    size={scaleFont(22)}
                    color="#246BFD"
                    style={styles.checkIcon}
                  />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </Pressable>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  pill: {
    // Anchor to the top-right of whatever row the host screen places us in.
    // NOTE: vertical safe-area offset is intentionally NOT applied here — each
    // host owns it exactly once (SafeAreaView edge or an absolute top inset).
    // Applying insets.top here too would double the offset on screens that
    // already use SafeAreaView edges={['top']}, pushing this button too low.
    alignSelf: 'flex-end',
    // Keep a consistent right margin matching the screens' content gutter.
    marginRight: scaleWidth(19),
    minWidth: scaleWidth(93),
    // minHeight (not a fixed height) so the taller script-safe line box and the
    // 20px icons always fit inside the pill instead of being clipped.
    minHeight: scaleHeight(44),
    paddingHorizontal: scaleWidth(10),
    paddingVertical: scaleHeight(6),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 100,
    gap: scaleWidth(6),
    zIndex: 2,
  },
  text: {
    // The native-language labels (हिंदी, ਪੰਜਾਬੀ) carry Devanagari/Gurmukhi
    // diacritics, so the line box needs headroom above the Latin-tuned 1.2x.
    // `scriptSafeText` also disables Android's Latin-derived font padding.
    ...scriptSafeText,
    fontSize: scaleFont(20),
    fontWeight: '700',
    color: colors.primary,
    lineHeight: Math.ceil(scaleFont(20) * INDIC_LINE_HEIGHT_RATIO),
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.25)',
    justifyContent: 'flex-start',
    // Match the pill's right gutter so the dropdown aligns under the button.
    paddingRight: scaleWidth(19),
    paddingLeft: scaleWidth(19),
    paddingTop: scaleHeight(72),
  },
  dropdown: {
    // Sit directly beneath the pill instead of stretching full width.
    alignSelf: 'flex-end',
    maxHeight: scaleHeight(320),
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 15,
    paddingTop: scaleHeight(8),
    paddingHorizontal: scaleWidth(13),
    paddingBottom: scaleHeight(8),
    elevation: 12,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 15,
    shadowOffset: { width: 5, height: 15 },
  },
  option: {
    minHeight: scaleHeight(45),
    flexDirection: 'row',
    alignItems: 'center',
  },
  shortLabel: {
    ...scriptSafeText,
    width: scaleWidth(24),
    fontSize: scaleFont(20),
    fontWeight: '500',
    color: colors.primary,
    lineHeight: Math.ceil(scaleFont(20) * INDIC_LINE_HEIGHT_RATIO),
  },
  optionText: {
    ...scriptSafeText,
    marginLeft: scaleWidth(17),
    fontSize: scaleFont(20),
    fontWeight: '500',
    color: colors.primary,
    lineHeight: Math.ceil(scaleFont(20) * INDIC_LINE_HEIGHT_RATIO),
  },
  nativeLabel: {
    ...scriptSafeText,
    marginLeft: 'auto',
    fontSize: scaleFont(20),
    fontWeight: '500',
    color: colors.primary,
    lineHeight: Math.ceil(scaleFont(20) * INDIC_LINE_HEIGHT_RATIO),
  },
  checkIcon: { marginLeft: 'auto' },
});

export default LanguageSelector;
