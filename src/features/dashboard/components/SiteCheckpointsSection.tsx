import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Feather from 'react-native-vector-icons/Feather';
import { useTranslation } from 'react-i18next';
import ScalePressable from '../../../components/common/ScalePressable';
import {
  agencyApiService,
  type AgencyCheckpoint,
} from '../../../services/agencyApiService';
import { colors } from '../../../styles/colors';
import { scaleFont, scaleHeight, scaleWidth } from '../../../styles/dimensions';
import { spacing } from '../../../styles/spacing';
import { typography } from '../../../styles/typography';
import { appAlert } from '../../../services/alertService';

type Props = { siteId: number };

const SiteCheckpointsSection: React.FC<Props> = ({ siteId }) => {
  const { t } = useTranslation();
  const [checkpoints, setCheckpoints] = useState<AgencyCheckpoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      setError('');
      setLoading(true);
      setCheckpoints(await agencyApiService.getSiteCheckpoints(siteId));
    } catch (e) {
      setError(
        e instanceof Error ? e.message : t('dashboard.checkpointsLoadFailed'),
      );
    } finally {
      setLoading(false);
    }
  }, [siteId, t]);

  useEffect(() => {
    load();
  }, [load]);

  const add = async () => {
    const name = draft.trim();
    if (!name) {
      appAlert.alert(
        t('dashboard.missingDetails'),
        t('dashboard.checkpointNameRequired'),
        { type: 'error' },
      );
      return;
    }
    try {
      setSaving(true);
      const nextOrder =
        checkpoints.reduce(
          (m, p) => Math.max(m, Number(p.sequence_order) || 0),
          0,
        ) + 1;
      const created = await agencyApiService.createSiteCheckpoint(siteId, {
        name,
        sequenceOrder: nextOrder,
      });
      setCheckpoints(cur =>
        [...cur, created].sort(
          (a, b) =>
            Number(a.sequence_order) - Number(b.sequence_order) || a.id - b.id,
        ),
      );
      setDraft('');
    } catch (e) {
      appAlert.alert(
        t('dashboard.checkpointAddFailed'),
        e instanceof Error ? e.message : t('dashboard.tryAgain'),
        { type: 'error' },
      );
    } finally {
      setSaving(false);
    }
  };

  const confirmRemove = (point: AgencyCheckpoint) => {
    appAlert.alert(
      t('dashboard.removeCheckpointTitle'),
      t('dashboard.removeCheckpointConfirm', { name: point.name }),
      [
        { text: t('dashboard.cancel'), style: 'cancel' },
        {
          text: t('dashboard.removeCheckpointTitle'),
          style: 'destructive',
          onPress: async () => {
            try {
              setDeletingId(point.id);
              await agencyApiService.deleteSiteCheckpoint(siteId, point.id);
              setCheckpoints(cur => cur.filter(item => item.id !== point.id));
            } catch (e) {
              appAlert.error(
                t('dashboard.checkpointRemoveFailed'),
                e instanceof Error ? e.message : t('dashboard.tryAgain'),
              );
            } finally {
              setDeletingId(null);
            }
          },
        },
      ],
    );
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{t('dashboard.checkpointsTitle')}</Text>
      <Text style={styles.hint}>{t('dashboard.checkpointsHint')}</Text>
      <View style={styles.addRow}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          style={styles.input}
          placeholder={t('dashboard.checkpointNamePlaceholder')}
          placeholderTextColor="#98A0AD"
          maxLength={80}
          editable={!saving}
        />
        <ScalePressable
          style={[styles.addButton, saving && styles.dim]}
          onPress={add}
          disabled={saving}
          accessibilityRole="button"
          accessibilityLabel={t('dashboard.addCheckpoint')}
        >
          {saving ? (
            <ActivityIndicator color={colors.white} size="small" />
          ) : (
            <Feather name="plus" size={scaleFont(20)} color={colors.white} />
          )}
        </ScalePressable>
      </View>
      {loading ? (
        <View style={styles.stateRow}>
          <ActivityIndicator color={colors.primary} size="small" />
          <Text style={styles.stateText}>
            {t('dashboard.checkpointsLoading')}
          </Text>
        </View>
      ) : error ? (
        <View style={styles.stateRow}>
          <Text style={[styles.stateText, styles.err]}>{error}</Text>
          <ScalePressable onPress={load} accessibilityRole="button">
            <Text style={styles.retry}>{t('dashboard.tryAgain')}</Text>
          </ScalePressable>
        </View>
      ) : checkpoints.length === 0 ? (
        <Text style={styles.empty}>{t('dashboard.noCheckpointsYet')}</Text>
      ) : (
        <View style={styles.list}>
          {checkpoints.map((point, index) => (
            <View key={point.id} style={styles.row}>
              <View style={styles.seq}>
                <Text style={styles.seqText}>{index + 1}</Text>
              </View>
              <Text style={styles.rowName} numberOfLines={1}>
                {point.name}
              </Text>
              <ScalePressable
                style={styles.del}
                onPress={() => confirmRemove(point)}
                disabled={deletingId === point.id}
                accessibilityRole="button"
                accessibilityLabel={t('dashboard.removeCheckpointTitle')}
              >
                {deletingId === point.id ? (
                  <ActivityIndicator
                    color={colors.status.danger}
                    size="small"
                  />
                ) : (
                  <Feather
                    name="trash-2"
                    size={scaleFont(18)}
                    color={colors.status.danger}
                  />
                )}
              </ScalePressable>
            </View>
          ))}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { marginTop: spacing.md },
  label: {
    fontFamily: typography.fontFamily,
    fontSize: scaleFont(16),
    fontWeight: typography.weights.medium,
    color: colors.primary,
    marginBottom: spacing.xs,
  },
  hint: {
    fontFamily: typography.fontFamily,
    fontSize: scaleFont(12),
    color: colors.textGray,
    lineHeight: scaleFont(18),
    marginBottom: spacing.sm,
  },
  addRow: { flexDirection: 'row', gap: scaleWidth(8) },
  input: {
    flex: 1,
    minHeight: scaleHeight(50),
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: '#000',
    borderRadius: scaleWidth(8),
    paddingHorizontal: scaleWidth(12),
    color: colors.primary,
    fontSize: scaleFont(15),
    fontFamily: typography.fontFamily,
  },
  addButton: {
    width: scaleWidth(50),
    minHeight: scaleHeight(50),
    borderRadius: scaleWidth(8),
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dim: { opacity: 0.6 },
  stateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  stateText: {
    fontFamily: typography.fontFamily,
    fontSize: scaleFont(14),
    color: colors.textGray,
  },
  err: { color: colors.status.danger, flex: 1 },
  retry: {
    fontFamily: typography.fontFamily,
    fontSize: scaleFont(14),
    fontWeight: typography.weights.semiBold,
    color: colors.status.info,
  },
  empty: {
    fontFamily: typography.fontFamily,
    fontSize: scaleFont(14),
    color: colors.textGray,
    fontStyle: 'italic',
    paddingVertical: spacing.sm,
  },
  list: { marginTop: spacing.sm, gap: spacing.xs },
  row: {
    minHeight: scaleHeight(48),
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderWidth: 1,
    borderColor: colors.light.border,
    borderRadius: scaleWidth(8),
    backgroundColor: colors.white,
  },
  seq: {
    width: scaleHeight(27),
    height: scaleHeight(27),
    borderRadius: scaleHeight(14),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.light.border,
  },
  seqText: {
    color: colors.primary,
    fontFamily: typography.fontFamily,
    fontSize: scaleFont(12),
    fontWeight: typography.weights.semiBold,
  },
  rowName: {
    flex: 1,
    color: colors.primary,
    fontFamily: typography.fontFamily,
    fontSize: scaleFont(15),
    fontWeight: typography.weights.medium,
  },
  del: {
    width: scaleWidth(40),
    height: scaleHeight(40),
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default SiteCheckpointsSection;
