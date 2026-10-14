import React, { useRef, useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { useAuth } from '../../authentication/context/AuthContext';
import Feather from 'react-native-vector-icons/Feather';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors } from '../../../styles/colors';
import { scaleFont, scaleHeight, scaleWidth } from '../../../styles/dimensions';

/**
 * The menu is an overlay positioned absolutely inside the screen's SafeAreaView
 * (edges: top/bottom). Absolute `top` is measured from the top of that
 * SafeAreaView's padding box (i.e. from the very top, above the status-bar
 * inset), while the header is a normal-flow child that is pushed down by the
 * inset. So the dropdown must add the top inset plus the header height to sit
 * cleanly beneath the header instead of behind it.
 */
const HEADER_HEIGHT = scaleHeight(64);
const MENU_GAP = scaleHeight(6);
const MENU_EDGE = scaleWidth(12);

type Props = {
  onLogout?: () => void;
  onMyProfile?: () => void;
  identity?: { name: string; company: string; initials: string };
  hideIdentity?: boolean;
};

const Row = ({
  icon,
  label,
  right,
  active,
  danger,
  expanded,
  showChevron = true,
  disabled,
  onPress,
}: {
  icon: React.ComponentProps<typeof Feather>['name'];
  label: string;
  right?: string;
  active?: boolean;
  danger?: boolean;
  expanded?: boolean;
  showChevron?: boolean;
  disabled?: boolean;
  onPress?: () => void;
}) => {
  const tint = danger ? '#F22121' : active ? '#2563EB' : colors.primary;
  return (
    <TouchableOpacity
      style={styles.row}
      onPress={onPress}
      activeOpacity={0.75}
      disabled={disabled}
      accessibilityState={{ disabled }}
    >
      <Feather name={icon} size={scaleFont(21)} color={tint} />
      <Text style={[styles.rowLabel, { color: tint }]}>{label}</Text>
      <View style={styles.right}>
        {right ? <Text style={styles.rightText}>{right}</Text> : null}
        {active ? (
          <Feather name="check" size={scaleFont(19)} color="#2563EB" />
        ) : !danger && showChevron ? (
          <Feather
            name={
              expanded === undefined
                ? 'chevron-right'
                : expanded
                ? 'chevron-down'
                : 'chevron-right'
            }
            size={scaleFont(20)}
            color={colors.primary}
          />
        ) : null}
      </View>
    </TouchableOpacity>
  );
};

const AgencyProfileMenu: React.FC<Props> = ({
  onLogout,
  onMyProfile,
  identity,
  hideIdentity = false,
}) => {
  const { i18n, t } = useTranslation();
  const { logout, user } = useAuth();
  // Fall back to the authenticated user's name so the avatar shows their real
  // initial; "U" is used only when no name is available.
  const authName = (user?.full_name ?? '').trim();
  const resolvedIdentity = identity ?? {
    name: authName || 'Agency Admin',
    company: 'Sentry Security Services',
    initials: authName ? authName.charAt(0).toUpperCase() : 'U',
  };
  const logoutPending = useRef(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const logoutHandler = async () => {
    if (logoutPending.current) return;
    logoutPending.current = true;
    setLoggingOut(true);
    try {
      // Centralised logout clears persisted auth and flips auth state;
      // AppNavigator resets the stack to AuthFlow so Back cannot return here.
      await logout();
      onLogout?.();
    } catch {
      Alert.alert(t('dashboard.logOut'), t('dashboard.tryAgain'));
    } finally {
      logoutPending.current = false;
      setLoggingOut(false);
    }
  };
  const [appearance, setAppearance] = useState('Light');
  const [languageOpen, setLanguageOpen] = useState(false);
  const [appearanceOpen, setAppearanceOpen] = useState(false);
  const language =
    i18n.language === 'hi'
      ? 'Hindi'
      : i18n.language === 'pa'
      ? 'Punjabi'
      : 'English';
  const changeLanguage = (code: 'en' | 'hi' | 'pa') => {
    i18n.changeLanguage(code);
    setLanguageOpen(false);
  };
  const selectAppearance = (value: 'Light' | 'Dark' | 'System') => {
    setAppearance(value);
    setAppearanceOpen(false);
  };
  const insets = useSafeAreaInsets();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();

  // Responsive width: keep the Figma-derived width but never let the drawer
  // reach the screen edges (respects small and large phones/tablets).
  const menuWidth = Math.min(scaleWidth(198), windowWidth - MENU_EDGE * 2);
  // Absolute `top` starts above the safe-area inset, so add the inset, the
  // header height, and a small gap to sit just beneath the header.
  const menuTop = insets.top + HEADER_HEIGHT + MENU_GAP;
  // Cap the height to the space below the header; the inner ScrollView handles
  // any overflow (e.g. when the Language/Appearance sub-lists are expanded).
  const menuMaxHeight = Math.max(
    scaleHeight(200),
    windowHeight - menuTop - insets.bottom - MENU_EDGE,
  );
  return (
    <View
      style={[
        styles.menu,
        { top: menuTop, width: menuWidth, maxHeight: menuMaxHeight },
      ]}
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        {!hideIdentity ? (
          <>
            <View style={styles.identity}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{resolvedIdentity.initials}</Text>
                <View style={styles.online} />
              </View>
              <View style={styles.identityText}>
                <Text style={styles.name} numberOfLines={1}>
                  {resolvedIdentity.name}
                </Text>
                {resolvedIdentity.company ? (
                  <Text style={styles.company} numberOfLines={1}>
                    {resolvedIdentity.company}
                  </Text>
                ) : null}
              </View>
            </View>
            <View style={styles.divider} />
          </>
        ) : null}
        <Row
          icon="user"
          label={t('dashboard.myProfile')}
          onPress={onMyProfile}
        />
        <Row icon="settings" label={t('dashboard.settings')} />
        <Row
          icon="globe"
          label={t('dashboard.language')}
          right={t(`dashboard.${language.toLowerCase()}`)}
          expanded={languageOpen}
          onPress={() => {
            setLanguageOpen(open => !open);
            setAppearanceOpen(false);
          }}
        />
        {languageOpen ? (
          <View style={[styles.dropdown, styles.languageDropdown]}>
            <Row
              icon="globe"
              label={t('dashboard.english')}
              active={language === 'English'}
              showChevron={false}
              onPress={() => changeLanguage('en')}
            />
            <Row
              icon="type"
              label={t('dashboard.hindi')}
              right="हिंदी"
              active={language === 'Hindi'}
              showChevron={false}
              onPress={() => changeLanguage('hi')}
            />
            <Row
              icon="type"
              label={t('dashboard.punjabi')}
              right="ਪੰਜਾਬੀ"
              active={language === 'Punjabi'}
              showChevron={false}
              onPress={() => changeLanguage('pa')}
            />
          </View>
        ) : null}
        <View style={styles.divider} />
        <Row
          icon="sun"
          label={t('dashboard.appearance')}
          right={t(`dashboard.${appearance.toLowerCase()}`)}
          expanded={appearanceOpen}
          onPress={() => {
            setAppearanceOpen(open => !open);
            setLanguageOpen(false);
          }}
        />
        {appearanceOpen ? (
          <View style={[styles.dropdown, styles.appearanceDropdown]}>
            <Row
              icon="sun"
              label={t('dashboard.light')}
              active={appearance === 'Light'}
              showChevron={false}
              onPress={() => selectAppearance('Light')}
            />
            <Row
              icon="moon"
              label={t('dashboard.dark')}
              active={appearance === 'Dark'}
              showChevron={false}
              onPress={() => selectAppearance('Dark')}
            />
            <Row
              icon="monitor"
              label={t('dashboard.system')}
              active={appearance === 'System'}
              showChevron={false}
              onPress={() => selectAppearance('System')}
            />
          </View>
        ) : null}
        <View style={styles.divider} />
        <Row
          icon="log-out"
          label={t('dashboard.logOut')}
          danger
          onPress={logoutHandler}
          disabled={loggingOut}
        />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  menu: {
    position: 'absolute',
    // Must stack above the header (zIndex 30) and the tap-outside backdrop
    // (zIndex 10) so the full drawer — including its top identity section — is
    // visible over the dashboard. `top`, `width`, and `maxHeight` are applied
    // inline from safe-area/window measurements.
    zIndex: 40,
    right: MENU_EDGE,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: '#D9D9D9',
    borderRadius: scaleWidth(8),
    // Clip the scrolling content to the rounded corners without affecting the
    // drop shadow (shadows are drawn outside the bounds on both platforms).
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.14,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 8,
  },
  scroll: { flexShrink: 1 },
  scrollContent: { paddingVertical: scaleHeight(8) },
  identity: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: scaleWidth(11),
    paddingBottom: scaleHeight(8),
  },
  identityText: { flex: 1 },
  avatar: {
    width: scaleWidth(30),
    height: scaleWidth(30),
    borderRadius: scaleWidth(15),
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: scaleWidth(9),
  },
  avatarText: {
    color: colors.white,
    fontWeight: '700',
    fontSize: scaleFont(12),
  },
  online: {
    position: 'absolute',
    right: -1,
    bottom: 0,
    width: scaleWidth(8),
    height: scaleWidth(8),
    borderRadius: scaleWidth(4),
    backgroundColor: '#16A34A',
  },
  name: { color: '#121212', fontSize: scaleFont(14), fontWeight: '700' },
  company: { color: '#3F3F3F', fontSize: scaleFont(10) },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#E4E4E4',
    marginHorizontal: scaleWidth(11),
  },
  row: {
    height: scaleHeight(30),
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: scaleWidth(12),
    gap: scaleWidth(9),
  },
  rowLabel: { fontSize: scaleFont(14), flex: 1 },
  right: { flexDirection: 'row', alignItems: 'center', gap: scaleWidth(5) },
  rightText: { fontSize: scaleFont(10), color: '#666' },
  dropdown: {
    backgroundColor: colors.white,
    marginHorizontal: scaleWidth(4),
  },
  languageDropdown: {},
  appearanceDropdown: {},
});

export default AgencyProfileMenu;
