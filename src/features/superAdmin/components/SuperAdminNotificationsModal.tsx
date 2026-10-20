import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Feather from 'react-native-vector-icons/Feather';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import ScalePressable from '../../../components/common/ScalePressable';
import {
  notificationService,
  type AppNotification,
} from '../../../services/notificationService';
import { colors } from '../../../styles/colors';
import { scaleFont } from '../../../styles/dimensions';
import { spacing } from '../../../styles/spacing';
import { typography } from '../../../styles/typography';
import { appAlert } from '../../../services/alertService';

type Props = {
  visible: boolean;
  onClose: () => void;
  onUnreadCountChange: (count: number) => void;
  onReviewApprovals?: () => void;
  emptyHint?: string;
  onNotificationSelect?: (notification: AppNotification) => void;
};

const formatDate = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
};

const notificationIcon = (type: string) =>
  type.includes('APPROVAL') ? 'check-circle' : 'bell';

export default function SuperAdminNotificationsModal({
  visible,
  onClose,
  onUnreadCountChange,
  onReviewApprovals,
  emptyHint,
  onNotificationSelect,
}: Props) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const [workingId, setWorkingId] = useState<number | null>(null);
  const [error, setError] = useState('');

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await notificationService.getAll();
      setNotifications(data);
      onUnreadCountChange(data.filter(item => item.status === 'unread').length);
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : t('auth.tryAgain'),
      );
    } finally {
      setLoading(false);
    }
  }, [onUnreadCountChange, t]);

  useEffect(() => {
    if (visible) loadNotifications();
  }, [loadNotifications, visible]);

  const markRead = async (notification: AppNotification) => {
    if (notification.status === 'read') {
      onNotificationSelect?.(notification);
      return;
    }
    setWorkingId(notification.id);
    try {
      await notificationService.markAsRead(notification.id);
      setNotifications(current =>
        current.map(item =>
          item.id === notification.id ? { ...item, status: 'read' } : item,
        ),
      );
      onUnreadCountChange(
        notifications.filter(
          item => item.id !== notification.id && item.status === 'unread',
        ).length,
      );
      onNotificationSelect?.(notification);
    } catch (markError) {
      appAlert.alert(
        t('superAdmin.notifications'),
        markError instanceof Error ? markError.message : t('auth.tryAgain'),
        { type: 'error' },
      );
    } finally {
      setWorkingId(null);
    }
  };

  const markAllRead = async () => {
    if (!notifications.some(item => item.status === 'unread')) return;
    setWorkingId(-1);
    try {
      await notificationService.markAllAsRead();
      setNotifications(current =>
        current.map(item => ({ ...item, status: 'read' })),
      );
      onUnreadCountChange(0);
    } catch (markError) {
      appAlert.alert(
        t('superAdmin.notifications'),
        markError instanceof Error ? markError.message : t('auth.tryAgain'),
        { type: 'error' },
      );
    } finally {
      setWorkingId(null);
    }
  };

  const removeNotification = (notification: AppNotification) => {
    appAlert.alert(
      t('superAdmin.deleteNotification'),
      t('superAdmin.deleteNotificationMessage'),
      [
        { text: t('superAdmin.cancel'), style: 'cancel' },
        {
          text: t('superAdmin.delete'),
          style: 'destructive',
          onPress: async () => {
            setWorkingId(notification.id);
            try {
              await notificationService.remove(notification.id);
              setNotifications(current =>
                current.filter(item => item.id !== notification.id),
              );
              if (notification.status === 'unread') {
                onUnreadCountChange(
                  notifications.filter(
                    item =>
                      item.id !== notification.id && item.status === 'unread',
                  ).length,
                );
              }
            } catch (removeError) {
              appAlert.error(
                t('superAdmin.deleteNotification'),
                removeError instanceof Error
                  ? removeError.message
                  : t('auth.tryAgain'),
              );
            } finally {
              setWorkingId(null);
            }
          },
        },
      ],
    );
  };

  const unreadCount = notifications.filter(
    item => item.status === 'unread',
  ).length;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={[styles.overlay, { paddingTop: insets.top }]}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityLabel={t('dashboard.close')}
        />
        <View style={styles.sheet}>
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>{t('superAdmin.notifications')}</Text>
              <Text style={styles.subtitle}>
                {unreadCount ? String(unreadCount) : ''}
              </Text>
            </View>
            <View style={styles.headerActions}>
              <ScalePressable
                style={[styles.markAll, !unreadCount && styles.disabled]}
                onPress={() => markAllRead()}
                disabled={!unreadCount || workingId !== null}
                accessibilityLabel={t('superAdmin.markAllRead')}
              >
                <Text style={styles.markAllText}>
                  {t('superAdmin.markAllRead')}
                </Text>
              </ScalePressable>
              <ScalePressable
                style={styles.close}
                onPress={onClose}
                accessibilityLabel={t('dashboard.close')}
              >
                <Feather name="x" size={scaleFont(22)} color={colors.primary} />
              </ScalePressable>
            </View>
          </View>

          <ScrollView
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {onReviewApprovals ? (
              <ScalePressable style={styles.retry} onPress={onReviewApprovals}>
                <Text style={styles.retryText}>
                  {t('superAdmin.reviewApprovals')}
                </Text>
              </ScalePressable>
            ) : null}
            {loading ? (
              <View style={styles.state}>
                <ActivityIndicator color={colors.primary} />
                <Text style={styles.stateText}>
                  {t('superAdmin.loadingNotifications')}
                </Text>
              </View>
            ) : null}
            {!loading && error ? (
              <View style={styles.state}>
                <Feather
                  name="alert-circle"
                  size={scaleFont(24)}
                  color={colors.status.danger}
                />
                <Text style={styles.stateText}>{error}</Text>
                <ScalePressable
                  style={styles.retry}
                  onPress={() => loadNotifications()}
                >
                  <Text style={styles.retryText}>
                    {t('superAdmin.tryAgain')}
                  </Text>
                </ScalePressable>
              </View>
            ) : null}
            {!loading && !error && !notifications.length ? (
              <View style={styles.state}>
                <View style={styles.emptyIcon}>
                  <Feather
                    name="bell"
                    size={scaleFont(24)}
                    color={colors.primary}
                  />
                </View>
                <Text style={styles.emptyTitle}>
                  {t('superAdmin.noNotifications')}
                </Text>
                <Text style={styles.stateText}>
                  {emptyHint || t('superAdmin.approvalHint')}
                </Text>
              </View>
            ) : null}
            {!loading && !error
              ? notifications.map(notification => (
                  <ScalePressable
                    key={notification.id}
                    style={[
                      styles.notification,
                      notification.status === 'unread' && styles.unread,
                    ]}
                    onPress={() => markRead(notification)}
                    disabled={workingId === notification.id}
                    accessibilityLabel={`${
                      notification.status === 'unread' ? 'Mark as read: ' : ''
                    }${notification.title}`}
                  >
                    <View style={styles.icon}>
                      <Feather
                        name={notificationIcon(notification.type)}
                        size={scaleFont(21)}
                        color={colors.primary}
                      />
                    </View>
                    <View style={styles.notificationCopy}>
                      <View style={styles.notificationTitleRow}>
                        <Text
                          style={styles.notificationTitle}
                          numberOfLines={1}
                        >
                          {notification.title}
                        </Text>
                        {notification.status === 'unread' ? (
                          <View style={styles.unreadDot} />
                        ) : null}
                      </View>
                      <Text style={styles.message}>{notification.message}</Text>
                      <Text style={styles.date}>
                        {formatDate(notification.created_at)}
                      </Text>
                    </View>
                    <ScalePressable
                      style={styles.delete}
                      onPress={() => removeNotification(notification)}
                      accessibilityLabel={`Delete ${notification.title}`}
                    >
                      <Feather
                        name="trash-2"
                        size={scaleFont(17)}
                        color={colors.textGray}
                      />
                    </ScalePressable>
                  </ScalePressable>
                ))
              : null}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(11,31,58,0.56)',
    justifyContent: 'flex-start',
  },
  sheet: {
    maxHeight: '82%',
    backgroundColor: colors.white,
    borderBottomLeftRadius: spacing.lg,
    borderBottomRightRadius: spacing.lg,
    overflow: 'hidden',
  },
  header: {
    minHeight: 74,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  title: {
    color: colors.primary,
    fontSize: scaleFont(typography.sizes.xl),
    fontWeight: typography.weights.bold,
  },
  subtitle: {
    marginTop: spacing.xs,
    color: colors.textGray,
    fontSize: scaleFont(typography.sizes.sm),
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  markAll: {
    minHeight: 36,
    paddingHorizontal: spacing.sm,
    borderRadius: spacing.sm,
    borderWidth: 1,
    borderColor: colors.primary,
    justifyContent: 'center',
  },
  markAllText: {
    color: colors.primary,
    fontSize: scaleFont(typography.sizes.xs),
    fontWeight: typography.weights.semiBold,
  },
  close: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.light.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: { opacity: 0.45 },
  list: { padding: spacing.md, gap: spacing.sm, flexGrow: 1 },
  notification: {
    minHeight: 84,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: spacing.sm,
    padding: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  unread: { borderColor: colors.status.info, backgroundColor: '#F7FAFF' },
  icon: {
    width: 42,
    height: 42,
    borderRadius: spacing.sm,
    backgroundColor: '#E9F0FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  notificationCopy: { flex: 1, gap: spacing.xs },
  notificationTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  notificationTitle: {
    flex: 1,
    color: colors.primary,
    fontSize: scaleFont(typography.sizes.sm),
    fontWeight: typography.weights.semiBold,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.status.info,
  },
  message: {
    color: colors.textGray,
    fontSize: scaleFont(typography.sizes.xs),
    lineHeight: 17,
  },
  date: { color: colors.textGray, fontSize: scaleFont(typography.sizes.xs) },
  delete: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  state: {
    flex: 1,
    minHeight: 220,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
  },
  stateText: {
    color: colors.textGray,
    fontSize: scaleFont(typography.sizes.sm),
    lineHeight: 20,
    textAlign: 'center',
  },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.light.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    color: colors.primary,
    fontSize: scaleFont(typography.sizes.lg),
    fontWeight: typography.weights.bold,
  },
  retry: {
    minHeight: 40,
    borderRadius: spacing.sm,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryText: {
    color: colors.white,
    fontSize: scaleFont(typography.sizes.sm),
    fontWeight: typography.weights.semiBold,
  },
});
