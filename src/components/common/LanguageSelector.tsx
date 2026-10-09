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
import { colors } from '../../styles/colors';
import { scaleWidth, scaleHeight, scaleFont } from '../../styles/dimensions';

const LANGUAGES = [
  { code: 'en', shortLabel: '', label: 'English', nativeLabel: '' },
  { code: 'hi', shortLabel: 'हिं', label: 'Hindi', nativeLabel: 'हिंदी' },
  { code: 'pa', shortLabel: 'ਪੰ', label: 'Punjabi', nativeLabel: 'ਪੰਜਾਬੀ' },
];

const LanguageSelector: React.FC = () => {
  const { i18n } = useTranslation();
  const [visible, setVisible] = useState(false);

  const current = LANGUAGES.find(l => l.code === i18n.language) ?? LANGUAGES[0];

  const selectLanguage = (code: string) => {
    i18n.changeLanguage(code);
    setVisible(false);
  };

  return (
    <>
      <TouchableOpacity style={styles.pill} onPress={() => setVisible(true)}>
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
        <Pressable style={styles.overlay} onPress={() => setVisible(false)}>
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
    alignSelf: 'flex-end',
    minWidth: scaleWidth(93),
    minHeight: scaleHeight(32),
    paddingHorizontal: scaleWidth(10),
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 100,
    justifyContent: 'center',
    gap: scaleWidth(4),
    zIndex: 2,
  },
  text: {
    fontSize: scaleFont(20),
    fontWeight: '700',
    color: colors.primary,
    lineHeight: scaleFont(24),
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.25)',
    justifyContent: 'flex-start',
    paddingHorizontal: scaleWidth(19),
    paddingTop: scaleHeight(72),
  },
  dropdown: {
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
    width: scaleWidth(24),
    fontSize: scaleFont(20),
    fontWeight: '500',
    color: colors.primary,
  },
  optionText: {
    marginLeft: scaleWidth(17),
    fontSize: scaleFont(20),
    fontWeight: '500',
    color: colors.primary,
  },
  nativeLabel: {
    marginLeft: 'auto',
    fontSize: scaleFont(20),
    fontWeight: '500',
    color: colors.primary,
  },
  checkIcon: { marginLeft: 'auto' },
});

export default LanguageSelector;
