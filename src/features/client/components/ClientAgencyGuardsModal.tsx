import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Feather from 'react-native-vector-icons/Feather';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { useTranslation } from 'react-i18next';

import ScalePressable from '../../../components/common/ScalePressable';
import {
  clientService,
  type ClientAgencyGuardData,
  type ClientAssignedGuard,
} from '../../../services/clientService';
import { colors } from '../../../styles/colors';
import { scaleFont } from '../../../styles/dimensions';
import { spacing } from '../../../styles/spacing';
import { typography } from '../../../styles/typography';
import { appAlert } from '../../../services/alertService';

type Props = {
  visible: boolean;
  agencyId: number | null;
  agencyName: string;
  onClose: () => void;
};

export default function ClientAgencyGuardsModal({
  visible,
  agencyId,
  agencyName,
  onClose,
}: Props) {
  const { t } = useTranslation();
  const [data, setData] = useState<ClientAgencyGuardData | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [agencyRating, setAgencyRating] = useState(0);
  const [agencyComment, setAgencyComment] = useState('');
  const [ratingGuard, setRatingGuard] = useState<ClientAssignedGuard | null>(
    null,
  );
  const [guardRating, setGuardRating] = useState(0);
  const [guardComment, setGuardComment] = useState('');

  const load = useCallback(async () => {
    if (!agencyId) return;
    setLoading(true);
    setError('');
    try {
      const response = await clientService.getAssignedGuards(agencyId);
      setData(response);
      setAgencyRating(Number(response.agencyRating.client_rating) || 0);
      setAgencyComment(response.agencyRating.client_comment || '');
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : t('clientAgency.loadFailed'),
      );
    } finally {
      setLoading(false);
    }
  }, [agencyId, t]);

  useEffect(() => {
    if (visible) load();
  }, [load, visible]);

  const saveAgencyRating = async () => {
    if (!agencyId || !agencyRating) return;
    setSaving(true);
    try {
      await clientService.rateAgency(
        agencyId,
        agencyRating,
        agencyComment.trim(),
      );
      await load();
      appAlert.alert(
        t('clientAgency.ratingSaved'),
        t('clientAgency.thankYou'),
        { type: 'success' },
      );
    } catch (saveError) {
      appAlert.alert(
        t('clientAgency.unableToRate'),
        saveError instanceof Error ? saveError.message : t('auth.tryAgain'),
        { type: 'error' },
      );
    } finally {
      setSaving(false);
    }
  };

  const openGuardRating = (guard: ClientAssignedGuard) => {
    setRatingGuard(guard);
    setGuardRating(Number(guard.client_rating) || 0);
    setGuardComment(guard.client_comment || '');
  };

  const saveGuardRating = async () => {
    if (!ratingGuard || !guardRating) return;
    setSaving(true);
    try {
      await clientService.rateGuard(
        ratingGuard.id,
        guardRating,
        guardComment.trim(),
      );
      setRatingGuard(null);
      await load();
      appAlert.alert(
        t('clientAgency.ratingSaved'),
        t('clientAgency.thankYou'),
        { type: 'success' },
      );
    } catch (saveError) {
      appAlert.alert(
        t('clientAgency.unableToRate'),
        saveError instanceof Error ? saveError.message : t('auth.tryAgain'),
        { type: 'error' },
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={s.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={s.sheet} accessibilityViewIsModal>
          <View style={s.header}>
            <View style={s.flex}>
              <Text style={s.title}>{t('clientAgency.guardsOnSite')}</Text>
              <Text style={s.subtitle}>{agencyName}</Text>
            </View>
            <ScalePressable style={s.close} onPress={onClose} disabled={saving}>
              <Feather name="x" size={scaleFont(23)} color={colors.primary} />
            </ScalePressable>
          </View>
          {loading ? (
            <View style={s.state}>
              <ActivityIndicator color={colors.primary} />
              <Text style={s.muted}>{t('clientAgency.loadingGuards')}</Text>
            </View>
          ) : error ? (
            <View style={s.state}>
              <Text style={s.error}>{error}</Text>
              <ScalePressable style={s.outlineButton} onPress={load}>
                <Text style={s.outlineText}>{t('superAdmin.tryAgain')}</Text>
              </ScalePressable>
            </View>
          ) : data ? (
            <ScrollView
              contentContainerStyle={s.content}
              showsVerticalScrollIndicator={false}
            >
              <View style={s.ratingCard}>
                <Text style={s.sectionTitle}>
                  {t('clientAgency.rateAgency')}
                </Text>
                <RatingStars value={agencyRating} onChange={setAgencyRating} />
                <TextInput
                  style={s.comment}
                  value={agencyComment}
                  onChangeText={setAgencyComment}
                  placeholder={t('clientAgency.feedbackPlaceholder')}
                  placeholderTextColor={colors.textGray}
                  multiline
                  maxLength={500}
                />
                <ScalePressable
                  style={[
                    s.primaryButton,
                    (!agencyRating || saving) && s.disabled,
                  ]}
                  onPress={saveAgencyRating}
                  disabled={!agencyRating || saving}
                >
                  <Text style={s.primaryText}>
                    {t('clientAgency.saveRating')}
                  </Text>
                </ScalePressable>
              </View>

              {!data.guards.length ? (
                <View style={s.state}>
                  <Feather
                    name="users"
                    size={scaleFont(28)}
                    color={colors.primary}
                  />
                  <Text style={s.sectionTitle}>
                    {t('clientAgency.noGuards')}
                  </Text>
                  <Text style={s.muted}>{t('clientAgency.noGuardsHint')}</Text>
                </View>
              ) : (
                data.guards.map(guard => (
                  <View key={guard.id} style={s.guardCard}>
                    <View style={s.guardHeader}>
                      <View style={s.flex}>
                        <Text style={s.guardName}>{guard.full_name}</Text>
                        <Text style={s.muted}>
                          {guard.site_name} · {guard.guard_code}
                        </Text>
                      </View>
                      <View
                        style={[
                          s.status,
                          guard.status === 'on_duty' ? s.onSite : s.offDuty,
                        ]}
                      >
                        <Text
                          style={[
                            s.statusText,
                            guard.status === 'on_duty'
                              ? s.onSiteText
                              : s.offDutyText,
                          ]}
                        >
                          {guard.status === 'on_duty'
                            ? t('clientAgency.onSite')
                            : t('dashboard.offDuty')}
                        </Text>
                      </View>
                    </View>
                    <View style={s.guardFooter}>
                      <Text style={s.average}>
                        ★ {guard.average_rating || '—'} ·{' '}
                        {t('clientAgency.overallRating')}
                      </Text>
                      <ScalePressable
                        style={s.rateButton}
                        onPress={() => openGuardRating(guard)}
                      >
                        <Feather
                          name="star"
                          size={scaleFont(17)}
                          color={colors.gold}
                        />
                        <Text style={s.rateText}>{t('clientAgency.rate')}</Text>
                      </ScalePressable>
                    </View>
                    {ratingGuard?.id === guard.id ? (
                      <View style={s.guardRatingPanel}>
                        <RatingStars
                          value={guardRating}
                          onChange={setGuardRating}
                        />
                        <TextInput
                          style={s.comment}
                          value={guardComment}
                          onChangeText={setGuardComment}
                          placeholder={t(
                            'clientAgency.guardFeedbackPlaceholder',
                          )}
                          placeholderTextColor={colors.textGray}
                          multiline
                          maxLength={500}
                        />
                        <View style={s.actions}>
                          <ScalePressable
                            style={s.outlineButton}
                            onPress={() => setRatingGuard(null)}
                            disabled={saving}
                          >
                            <Text style={s.outlineText}>
                              {t('superAdmin.cancel')}
                            </Text>
                          </ScalePressable>
                          <ScalePressable
                            style={[
                              s.primaryButton,
                              (!guardRating || saving) && s.disabled,
                            ]}
                            onPress={saveGuardRating}
                            disabled={!guardRating || saving}
                          >
                            <Text style={s.primaryText}>
                              {t('clientAgency.saveRating')}
                            </Text>
                          </ScalePressable>
                        </View>
                      </View>
                    ) : null}
                  </View>
                ))
              )}
            </ScrollView>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

function RatingStars({
  value,
  onChange,
}: {
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <View style={s.stars} accessibilityRole="radiogroup">
      {[1, 2, 3, 4, 5].map(star => (
        <ScalePressable
          key={star}
          onPress={() => onChange(star)}
          accessibilityRole="radio"
          accessibilityState={{ selected: value === star }}
        >
          <MaterialIcons
            name={star <= value ? 'star' : 'star-border'}
            size={scaleFont(28)}
            color={colors.gold}
          />
        </ScalePressable>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing.md,
    backgroundColor: 'rgba(11,31,58,0.68)',
  },
  sheet: {
    maxHeight: '88%',
    backgroundColor: colors.white,
    borderRadius: spacing.md,
    padding: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: spacing.md,
  },
  flex: { flex: 1 },
  title: {
    color: colors.primary,
    fontSize: scaleFont(typography.sizes.xl),
    fontWeight: typography.weights.bold,
  },
  subtitle: {
    color: colors.textGray,
    fontSize: scaleFont(typography.sizes.sm),
    marginTop: spacing.xs,
  },
  close: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.light.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    gap: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  state: {
    minHeight: 150,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    padding: spacing.md,
  },
  error: {
    color: colors.status.danger,
    fontSize: scaleFont(typography.sizes.sm),
    textAlign: 'center',
  },
  muted: {
    color: colors.textGray,
    fontSize: scaleFont(typography.sizes.sm),
    lineHeight: scaleFont(typography.sizes.lg),
  },
  ratingCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: spacing.md,
    padding: spacing.md,
    gap: spacing.sm,
  },
  sectionTitle: {
    color: colors.primary,
    fontSize: scaleFont(typography.sizes.md),
    fontWeight: typography.weights.bold,
  },
  stars: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  comment: {
    minHeight: 78,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: spacing.sm,
    padding: spacing.sm,
    color: colors.primary,
    fontSize: scaleFont(typography.sizes.sm),
    textAlignVertical: 'top',
  },
  primaryButton: {
    minHeight: 44,
    borderRadius: spacing.sm,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    flex: 1,
  },
  primaryText: {
    color: colors.white,
    fontSize: scaleFont(typography.sizes.sm),
    fontWeight: typography.weights.bold,
  },
  disabled: { opacity: 0.45 },
  outlineButton: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    flex: 1,
  },
  outlineText: {
    color: colors.primary,
    fontSize: scaleFont(typography.sizes.sm),
    fontWeight: typography.weights.semiBold,
  },
  guardCard: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  guardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  guardName: {
    color: colors.primary,
    fontSize: scaleFont(typography.sizes.lg),
    fontWeight: typography.weights.semiBold,
  },
  status: {
    borderWidth: 1,
    borderRadius: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  onSite: { borderColor: colors.status.success },
  offDuty: { borderColor: colors.border },
  statusText: {
    fontSize: scaleFont(typography.sizes.xs),
    fontWeight: typography.weights.semiBold,
  },
  onSiteText: { color: colors.status.success },
  offDutyText: { color: colors.textGray },
  guardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  average: {
    flex: 1,
    color: colors.gold,
    fontSize: scaleFont(typography.sizes.sm),
    fontWeight: typography.weights.medium,
  },
  rateButton: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: colors.gold,
    borderRadius: spacing.sm,
    paddingHorizontal: spacing.sm,
  },
  rateText: {
    color: colors.gold,
    fontSize: scaleFont(typography.sizes.sm),
    fontWeight: typography.weights.semiBold,
  },
  guardRatingPanel: { gap: spacing.sm, paddingTop: spacing.sm },
  actions: { flexDirection: 'row', gap: spacing.sm },
});
