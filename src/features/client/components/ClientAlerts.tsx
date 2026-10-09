import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import Feather from 'react-native-vector-icons/Feather';

import { useTranslation } from 'react-i18next';

import {
  clientService,
  type ClientAlert,
} from '../../../services/clientService';
import { colors } from '../../../styles/colors';
import { scaleFont } from '../../../styles/dimensions';
import { spacing } from '../../../styles/spacing';
import { typography } from '../../../styles/typography';
import ScalePressable from '../../../components/common/ScalePressable';

type SeverityFilter = 'all' | 'high' | 'medium' | 'low';

const incidentAppearance = {
  high: { icon: 'alert-circle', color: colors.status.danger, tint: '#FDECEC' },
  medium: { icon: 'bell', color: colors.gold, tint: '#FFF8E7' },
  low: { icon: 'shield', color: colors.status.info, tint: '#EFF6FF' },
} as const;

const statusLabel = (status: ClientAlert['status']) =>
  status === 'in_progress'
    ? 'Work in progress'
    : status.charAt(0).toUpperCase() + status.slice(1);
const statusStyle = (status: ClientAlert['status']) =>
  status === 'resolved'
    ? s.resolved
    : status === 'in_progress'
    ? s.inProgress
    : s.pending;

export default function ClientAlerts() {
  const { t } = useTranslation();
  const [alerts, setAlerts] = useState<ClientAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<SeverityFilter>('all');
  const load = useCallback(async () => {
    try {
      setError('');
      setAlerts(await clientService.getAlerts());
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : t('client.loadFailedAlerts'),
      );
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);
  const visibleAlerts = useMemo(
    () =>
      filter === 'all'
        ? alerts
        : alerts.filter(alert => alert.severity === filter),
    [alerts, filter],
  );
  if (loading)
    return (
      <View style={s.state}>
        <ActivityIndicator color={colors.primary} />
        <Text style={s.muted}>{t('client.loadingAlerts')}</Text>
      </View>
    );
  if (error)
    return (
      <View style={s.state}>
        <Text style={s.error}>{error}</Text>
      </View>
    );
  if (!alerts.length)
    return (
      <View style={s.state}>
        <Feather name="shield" size={scaleFont(26)} color={colors.primary} />
        <Text style={s.title}>{t('client.noAlerts')}</Text>
        <Text style={s.muted}>
          {t('client.noAlertsHint')}
        </Text>
      </View>
    );
  return (
    <ScrollView
      contentContainerStyle={s.list}
      refreshControl={
        <RefreshControl
          refreshing={loading}
          onRefresh={() => {
            setLoading(true);
            load();
          }}
          tintColor={colors.primary}
        />
      }
    >
      <View style={s.filters}>
        {(['all', 'high', 'medium', 'low'] as const).map(value => (
          <ScalePressable
            key={value}
            style={[s.filter, filter === value && s.filterActive]}
            onPress={() => setFilter(value)}
            accessibilityRole="tab"
            accessibilityState={{ selected: filter === value }}
          >
            <Text
              style={[s.filterText, filter === value && s.filterTextActive]}
            >
              {t(`client.alertFilters.${value}`)}
            </Text>
          </ScalePressable>
        ))}
      </View>
      {visibleAlerts.length ? (
        visibleAlerts.map(alert => {
          const appearance = incidentAppearance[alert.severity];
          return (
            <View key={alert.id} style={s.card}>
              <View style={[s.icon, { backgroundColor: appearance.tint }]}>
                <Feather
                  name={appearance.icon}
                  size={scaleFont(24)}
                  color={appearance.color}
                />
              </View>
              <View style={s.copy}>
                <View style={s.row}>
                  <Text style={[s.code, { color: appearance.color }]}>
                    {alert.incident_code}
                  </Text>
                  <View style={[s.status, statusStyle(alert.status)]}>
                    <Text style={[s.statusText, statusStyle(alert.status)]}>
                      {statusLabel(alert.status)}
                    </Text>
                  </View>
                </View>
                <Text style={s.notes} numberOfLines={3}>
                  {alert.notes}
                </Text>
                <Text style={s.meta}>
                  {alert.site_name} · {alert.agency_name}
                </Text>
                <Text style={s.meta}>
                  {new Date(alert.created_at).toLocaleString()}
                </Text>
              </View>
            </View>
          );
        })
      ) : (
        <View style={s.emptyFiltered}>
          <Text style={s.muted}>{t('client.noAlertsFiltered', { filter })}</Text>
        </View>
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  list: { gap: spacing.md },
  heading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  headingMark: {
    width: spacing.xs,
    height: spacing.lg,
    backgroundColor: colors.gold,
  },
  headingText: {
    color: colors.primary,
    fontFamily: typography.fontFamily,
    fontSize: scaleFont(typography.sizes.lg),
    fontWeight: typography.weights.bold,
  },
  filters: { flexDirection: 'row', gap: spacing.sm },
  filter: {
    flex: 1,
    minHeight: 42,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
  },
  filterActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterText: {
    color: colors.primary,
    fontFamily: typography.fontFamily,
    fontSize: scaleFont(typography.sizes.sm),
    fontWeight: typography.weights.semiBold,
  },
  filterTextActive: { color: colors.white },
  state: {
    minHeight: 180,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    padding: spacing.lg,
  },
  emptyFiltered: {
    minHeight: 120,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: spacing.md,
    backgroundColor: colors.white,
  },
  icon: {
    width: spacing.xxxl,
    height: spacing.xxxl,
    borderRadius: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: { flex: 1, gap: spacing.xs },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
  code: {
    fontFamily: typography.fontFamily,
    fontSize: scaleFont(typography.sizes.sm),
    fontWeight: typography.weights.semiBold,
  },
  status: {
    borderWidth: 1,
    borderRadius: spacing.lg,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  statusText: {
    fontFamily: typography.fontFamily,
    fontSize: scaleFont(typography.sizes.xs),
    fontWeight: typography.weights.semiBold,
  },
  pending: {
    color: '#B45309',
    borderColor: '#F59E0B',
    backgroundColor: '#FFFBEB',
  },
  inProgress: {
    color: colors.status.info,
    borderColor: colors.status.info,
    backgroundColor: '#EFF6FF',
  },
  resolved: {
    color: colors.status.success,
    borderColor: colors.status.success,
    backgroundColor: '#F0FDF4',
  },
  notes: {
    color: colors.primary,
    fontFamily: typography.fontFamily,
    fontSize: scaleFont(typography.sizes.md),
    fontWeight: typography.weights.semiBold,
    lineHeight: scaleFont(typography.sizes.lg),
  },
  meta: {
    color: colors.textGray,
    fontFamily: typography.fontFamily,
    fontSize: scaleFont(typography.sizes.sm),
  },
  title: {
    color: colors.primary,
    fontFamily: typography.fontFamily,
    fontSize: scaleFont(typography.sizes.lg),
    fontWeight: typography.weights.bold,
  },
  muted: {
    color: colors.textGray,
    fontFamily: typography.fontFamily,
    fontSize: scaleFont(typography.sizes.sm),
    textAlign: 'center',
  },
  error: {
    color: colors.status.danger,
    fontFamily: typography.fontFamily,
    fontSize: scaleFont(typography.sizes.sm),
    textAlign: 'center',
  },
});
