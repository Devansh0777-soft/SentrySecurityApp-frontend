import React, { useEffect, useRef, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import Feather from 'react-native-vector-icons/Feather';
import { useTranslation } from 'react-i18next';
import { useIsFocused } from '@react-navigation/native';

import { colors } from '../../../styles/colors';
import { scaleFont, scaleHeight, scaleWidth } from '../../../styles/dimensions';
import ScalePressable from '../../../components/common/ScalePressable';
import SuperAdminNotificationsModal from '../../superAdmin/components/SuperAdminNotificationsModal';
import { notificationService } from '../../../services/notificationService';
import type { AppNotification } from '../../../services/notificationService';
import { playIncidentBuzzer } from '../../../services/notificationSound';
import { useAuth } from '../../authentication/context/AuthContext';

/** First uppercase letter of the authenticated user's name; "U" only when unavailable. */
const userInitial = (name?: string | null) => {
  const trimmed = (name ?? '').trim();
  return trimmed ? trimmed.charAt(0).toUpperCase() : 'U';
};

type Props = {
  profileMenuOpen: boolean;
  onProfilePress: () => void;
  onNotificationPress?: () => void;
  onBeforeOpenNotifications?: () => void;
  unreadNotificationCount?: number;
  avatarInitials?: string;
  onNotificationSelect?: (notification: AppNotification) => void;
  /**
   * Incident buzzer polling. Only the agency app may buzz: guards and clients
   * reuse this header, so they pass false — clients learn about an incident
   * through their (silent) alerts after the escalation window instead.
   */
  enableIncidentBuzzer?: boolean;
};

const AgencyTopNavigation: React.FC<Props> = ({
  profileMenuOpen,
  onProfilePress,
  onNotificationPress,
  onBeforeOpenNotifications,
  unreadNotificationCount = 0,
  avatarInitials,
  onNotificationSelect,
  enableIncidentBuzzer = true,
}) => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const resolvedAvatarInitials = avatarInitials || userInitial(user?.full_name);
  const isFocused = useIsFocused();
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [internalUnreadCount, setInternalUnreadCount] = useState(0);
  const lastUnreadCount = useRef<number | null>(null);
  const managesNotifications = !onNotificationPress;

  useEffect(() => {
    if (!managesNotifications || !isFocused) return;
    let active = true;
    const refresh = () => {
      notificationService
        .getUnreadCount()
        .then(response => {
          if (!active) return;
          // Incident buzzer is driven ONLY by sound-pending poll below;
          // keep the badge count here but never play sound from it.
          lastUnreadCount.current = response.count;
          setInternalUnreadCount(response.count);
        })
        .catch(() => {
          if (active) setInternalUnreadCount(0);
        });
      // Agency incident buzzer: backend sets sound_pending at 0/5/10/15 min
      // after a guard files an incident; this poll consumes the flag and
      // plays the bundled buzzer exactly once per tick. Acknowledging the
      // incident clears the flag chain so the buzzer stops. Guard and client
      // screens reuse this header with enableIncidentBuzzer=false, so they
      // never poll or play it.
      if (enableIncidentBuzzer) {
        notificationService.pollIncidentBuzzer().then(
          response => {
            if (active && response.playSound) playIncidentBuzzer();
          },
          () => undefined,
        );
      }
    };
    refresh();
    const interval = setInterval(refresh, 30000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [isFocused, managesNotifications, enableIncidentBuzzer]);

  const visibleUnreadCount = managesNotifications
    ? internalUnreadCount
    : unreadNotificationCount;

  return (
    <>
      <View style={styles.header}>
        <Image
          source={require('../../../assets/images/sentry-logo-horizontal.png')}
          style={styles.logo}
          resizeMode="contain"
        />
        <View style={styles.actions}>
          <ScalePressable
            style={styles.bell}
            onPress={
              onNotificationPress ??
              (() => {
                onBeforeOpenNotifications?.();
                setNotificationsOpen(true);
              })
            }
            accessibilityLabel={t('superAdmin.notifications')}
          >
            <Feather name="bell" size={scaleFont(25)} color={colors.primary} />
            {visibleUnreadCount > 0 ? (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>
                  {visibleUnreadCount > 9 ? '9+' : visibleUnreadCount}
                </Text>
              </View>
            ) : null}
          </ScalePressable>
          <ScalePressable
            style={styles.profileTrigger}
            onPress={onProfilePress}
            accessibilityLabel={t('dashboard.myProfile')}
          >
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{resolvedAvatarInitials}</Text>
              <View style={styles.online} />
            </View>
            <Feather
              name={profileMenuOpen ? 'chevron-up' : 'chevron-down'}
              size={scaleFont(22)}
              color={colors.primary}
            />
          </ScalePressable>
        </View>
      </View>
      {managesNotifications ? (
        <SuperAdminNotificationsModal
          visible={notificationsOpen}
          onClose={() => setNotificationsOpen(false)}
          onUnreadCountChange={setInternalUnreadCount}
          emptyHint={t('dashboard.noNotificationsHint')}
          onNotificationSelect={notification => {
            setNotificationsOpen(false);
            onNotificationSelect?.(notification);
          }}
        />
      ) : null}
    </>
  );
};

const styles = StyleSheet.create({
  header: {
    height: scaleHeight(64),
    borderBottomWidth: 1,
    borderColor: '#F3F4F6',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: scaleWidth(14),
    backgroundColor: colors.white,
    zIndex: 30,
    elevation: 0,
    overflow: 'hidden',
  },
  logo: { width: scaleWidth(180), height: scaleHeight(180) },
  actions: { flexDirection: 'row', alignItems: 'center', gap: scaleWidth(10) },
  bell: { position: 'relative' },
  badge: {
    position: 'absolute',
    right: -scaleWidth(5),
    top: -scaleHeight(5),
    width: scaleWidth(13),
    height: scaleWidth(13),
    borderRadius: scaleWidth(7),
    backgroundColor: '#E50914',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: colors.white, fontSize: scaleFont(8), fontWeight: '700' },
  profileTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scaleWidth(10),
  },
  avatar: {
    width: scaleWidth(39),
    height: scaleWidth(39),
    borderRadius: scaleWidth(20),
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: colors.white,
    fontWeight: '700',
    fontSize: scaleFont(15),
  },
  online: {
    position: 'absolute',
    right: -1,
    bottom: 0,
    width: scaleWidth(11),
    height: scaleWidth(11),
    borderRadius: scaleWidth(6),
    backgroundColor: '#19B563',
    borderWidth: 1,
    borderColor: colors.white,
  },
});

export default AgencyTopNavigation;
