import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, StyleSheet, Text, View } from 'react-native';

import ScalePressable from '../../../components/common/ScalePressable';
import {
  type AgencyIncident,
  agencyApiService,
} from '../../../services/agencyApiService';
import { colors } from '../../../styles/colors';
import { scaleFont, scaleHeight } from '../../../styles/dimensions';
import { spacing } from '../../../styles/spacing';
import { typography } from '../../../styles/typography';
import { appAlert } from '../../../services/alertService';

type Status = 'pending' | 'in_progress' | 'resolved';
const options: Array<{ value: Status; label: string }> = [
  { value: 'pending', label: 'Pending' },
  { value: 'in_progress', label: 'Work in progress' },
  { value: 'resolved', label: 'Resolved' },
];

export default function IncidentStatusModal({
  visible,
  incident,
  onClose,
  onUpdated,
}: {
  visible: boolean;
  incident: AgencyIncident | null;
  onClose: () => void;
  onUpdated: (incident: AgencyIncident) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<Status>('pending');
  const status = (incident?.status || 'pending') as Status;
  useEffect(() => {
    if (visible) setSelected(status);
  }, [status, visible]);
  const save = async () => {
    if (!incident || saving) return;
    try {
      setSaving(true);
      onUpdated(
        await agencyApiService.updateIncidentStatus(incident.id, selected),
      );
      onClose();
    } catch (error) {
      appAlert.alert(
        'Unable to update incident',
        error instanceof Error ? error.message : 'Please try again.',
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
        <ScalePressable style={s.backdrop} onPress={onClose}>
          <View />
        </ScalePressable>
        <View style={s.sheet}>
          <View style={s.titleRow}>
            <View style={s.titleMark} />
            <Text style={s.title}>Incident details</Text>
          </View>
          <View style={s.detailCard}>
            <Text style={s.code}>{incident?.incident_code}</Text>
            <Text style={s.notes}>{incident?.notes}</Text>
            <Text style={s.site}>{incident?.site_name}</Text>
          </View>
          <Text style={s.label}>Update status</Text>
          <View style={s.options}>
            {options.map(option => (
              <ScalePressable
                key={option.value}
                style={[s.option, selected === option.value && s.selected]}
                onPress={() => setSelected(option.value)}
                accessibilityRole="radio"
                accessibilityState={{ selected: selected === option.value }}
              >
                <View
                  style={[
                    s.radio,
                    selected === option.value && s.radioSelected,
                  ]}
                />
                <Text
                  style={[
                    s.optionText,
                    selected === option.value && s.selectedText,
                  ]}
                >
                  {option.label}
                </Text>
              </ScalePressable>
            ))}
          </View>
          <ScalePressable
            style={s.save}
            onPress={save}
            disabled={saving || selected === status}
          >
            {saving ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={s.saveText}>Save changes</Text>
            )}
          </ScalePressable>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing.md,
    backgroundColor: 'rgba(11, 31, 58, 0.28)',
  },
  backdrop: { ...StyleSheet.absoluteFill },
  sheet: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: spacing.md,
    padding: spacing.lg,
    gap: spacing.md,
    backgroundColor: colors.white,
    shadowColor: colors.primary,
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  titleMark: {
    width: spacing.xs,
    height: scaleHeight(25),
    backgroundColor: colors.gold,
  },
  title: {
    color: colors.primary,
    fontFamily: typography.fontFamily,
    fontSize: scaleFont(typography.sizes.xl),
    fontWeight: typography.weights.bold,
  },
  detailCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: spacing.sm,
    padding: spacing.md,
    gap: spacing.sm,
    backgroundColor: colors.light.background,
  },
  code: {
    color: colors.status.info,
    fontFamily: typography.fontFamily,
    fontSize: scaleFont(typography.sizes.sm),
    fontWeight: typography.weights.semiBold,
  },
  notes: {
    color: colors.primary,
    fontFamily: typography.fontFamily,
    fontSize: scaleFont(typography.sizes.md),
    fontWeight: typography.weights.medium,
    lineHeight: scaleFont(typography.sizes.xl),
  },
  site: {
    color: colors.textGray,
    fontFamily: typography.fontFamily,
    fontSize: scaleFont(typography.sizes.sm),
  },
  label: {
    color: colors.primary,
    fontFamily: typography.fontFamily,
    fontSize: scaleFont(typography.sizes.md),
    fontWeight: typography.weights.semiBold,
    marginTop: spacing.sm,
  },
  options: { gap: spacing.sm },
  option: {
    minHeight: scaleHeight(50),
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.white,
  },
  selected: {
    borderColor: colors.primary,
    backgroundColor: colors.light.background,
  },
  radio: {
    width: scaleHeight(16),
    height: scaleHeight(16),
    borderRadius: scaleHeight(8),
    borderWidth: 1,
    borderColor: colors.textGray,
  },
  radioSelected: {
    borderColor: colors.status.info,
    borderWidth: scaleHeight(5),
  },
  optionText: {
    color: colors.textGray,
    fontFamily: typography.fontFamily,
    fontSize: scaleFont(typography.sizes.md),
    fontWeight: typography.weights.medium,
  },
  selectedText: {
    color: colors.primary,
    fontWeight: typography.weights.semiBold,
  },
  save: {
    minHeight: scaleHeight(50),
    borderRadius: spacing.sm,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.sm,
  },
  saveText: {
    color: colors.white,
    fontFamily: typography.fontFamily,
    fontSize: scaleFont(typography.sizes.lg),
    fontWeight: typography.weights.bold,
  },
});
