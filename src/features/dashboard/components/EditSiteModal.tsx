import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Feather from 'react-native-vector-icons/Feather';
import { useTranslation } from 'react-i18next';

import {
  agencyApiService,
  type AgencySite,
} from '../../../services/agencyApiService';
import { colors } from '../../../styles/colors';
import { scaleFont, scaleHeight, scaleWidth } from '../../../styles/dimensions';
import ScalePressable from '../../../components/common/ScalePressable';
import SiteCheckpointsSection from './SiteCheckpointsSection';
import { appAlert } from '../../../services/alertService';

type Props = {
  visible: boolean;
  site: AgencySite | null;
  onClose: () => void;
  onChanged?: (site: AgencySite, action: 'updated' | 'deleted') => void;
};

const EditSiteModal: React.FC<Props> = ({
  visible,
  site,
  onClose,
  onChanged,
}) => {
  const { t } = useTranslation();
  const [siteName, setSiteName] = useState('');
  const [address, setAddress] = useState('');
  const [plan, setPlan] = useState<AgencySite['coverage_plan']>('day_shift');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (site) {
      setSiteName(site.site_name);
      setAddress(site.site_address ?? '');
      setPlan(site.coverage_plan ?? 'day_shift');
      setError('');
    }
  }, [site]);
  if (!site) return null;
  const planChoices: Array<[NonNullable<AgencySite['coverage_plan']>, string]> =
    [
      ['day_shift', t('dashboard.dayShift')],
      ['night_watch', t('dashboard.nightWatch')],
      ['24x7', t('dashboard.coverage24x7')],
    ];
  const save = async () => {
    if (!siteName.trim() || !address.trim()) {
      setError(t('dashboard.siteAndAddressRequired'));
      return;
    }
    setSaving(true);
    setError('');
    try {
      const updated = await agencyApiService.updateSite(site.id, {
        siteName: siteName.trim(),
        siteAddress: address.trim(),
        city: site.city,
        state: site.state,
        latitude: site.latitude,
        longitude: site.longitude,
        coveragePlan: plan,
        startTime: site.start_time,
        endTime: site.end_time,
      });
      onChanged?.(updated, 'updated');
      onClose();
      appAlert.alert(t('dashboard.saveChanges'), t('dashboard.siteUpdated'), {
        type: 'success',
      });
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : t('dashboard.siteUpdateFailed'),
      );
    } finally {
      setSaving(false);
    }
  };
  const confirmRemove = () =>
    appAlert.alert(
      t('dashboard.removeSite'),
      t('dashboard.removeSiteConfirm'),
      [
        { text: t('superAdmin.cancel'), style: 'cancel' },
        {
          text: t('dashboard.removeSite'),
          style: 'destructive',
          onPress: async () => {
            setSaving(true);
            setError('');
            try {
              await agencyApiService.removeSite(site.id);
              onChanged?.(site, 'deleted');
              onClose();
              appAlert.success(
                t('dashboard.removeSite'),
                t('dashboard.siteRemoved'),
              );
            } catch (removeError) {
              setError(
                removeError instanceof Error
                  ? removeError.message
                  : t('dashboard.siteRemoveFailed'),
              );
            } finally {
              setSaving(false);
            }
          },
        },
      ],
    );

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={s.overlay}>
        <View style={s.sheet} accessibilityViewIsModal>
          <View style={s.header}>
            <Text style={s.code}>ST-{site.id}</Text>
            <ScalePressable
              style={s.close}
              onPress={onClose}
              disabled={saving}
              accessibilityRole="button"
              accessibilityLabel={t('dashboard.close')}
            >
              <Feather name="x" size={scaleFont(25)} color={colors.primary} />
            </ScalePressable>
          </View>
          <View style={s.divider} />
          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <Label text={t('dashboard.siteName')} />
            <TextInput
              value={siteName}
              onChangeText={setSiteName}
              style={s.input}
              placeholder={t('dashboard.enterSiteName')}
              placeholderTextColor="#98A0AD"
            />
            <Label text={t('dashboard.address')} />
            <TextInput
              value={address}
              onChangeText={setAddress}
              style={s.input}
              placeholder={t('dashboard.enterCompleteAddress')}
              placeholderTextColor="#98A0AD"
            />
            <Text style={s.hint}>{t('dashboard.offlineAddressHint')}</Text>
            <Label text={t('dashboard.locationGps')} />
            <View style={s.locationBox}>
              <Feather
                name="map-pin"
                size={scaleFont(22)}
                color={colors.textGray}
              />
              <Text style={s.locationText}>{t('dashboard.noGps')}</Text>
            </View>
            <ScalePressable
              style={s.outlineButton}
              onPress={() =>
                appAlert.alert(
                  t('dashboard.locationGps'),
                  t('dashboard.gpsSoon'),
                )
              }
              accessibilityRole="button"
            >
              <Feather
                name="map-pin"
                size={scaleFont(21)}
                color={colors.gold}
              />
              <Text style={s.outlineText}>
                {t('dashboard.useCurrentLocation')}
              </Text>
            </ScalePressable>
            <Label text={t('dashboard.coveragePlan')} />
            <View style={s.planRow}>
              {planChoices.map(([key, label]) => (
                <ScalePressable
                  key={key}
                  style={[s.plan, plan === key && s.activePlan]}
                  onPress={() => setPlan(key)}
                  accessibilityRole="button"
                >
                  <Text style={[s.planText, plan === key && s.activePlanText]}>
                    {label}
                  </Text>
                </ScalePressable>
              ))}
            </View>
            <View style={s.note}>
              <Text style={s.noteText}>
                {plan === '24x7'
                  ? t('dashboard.rotateCoverage')
                  : t('dashboard.selectedPlan')}
              </Text>
            </View>
            {error ? <Text style={s.error}>{error}</Text> : null}
            <ScalePressable
              style={s.outlineButton}
              onPress={() =>
                appAlert.alert(
                  t('dashboard.getDirections'),
                  t('dashboard.directionsUnavailable'),
                )
              }
              accessibilityRole="button"
            >
              <Feather
                name="map-pin"
                size={scaleFont(21)}
                color={colors.gold}
              />
              <Text style={s.outlineText}>{t('dashboard.getDirections')}</Text>
            </ScalePressable>
            <SiteCheckpointsSection siteId={site.id} />
            <ScalePressable
              style={s.save}
              onPress={save}
              disabled={saving}
              accessibilityRole="button"
            >
              {saving ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={s.saveText}>{t('dashboard.saveChanges')}</Text>
              )}
            </ScalePressable>
            <ScalePressable
              style={s.remove}
              onPress={confirmRemove}
              disabled={saving}
              accessibilityRole="button"
            >
              <Text style={s.removeText}>{t('dashboard.removeSite')}</Text>
            </ScalePressable>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const Label: React.FC<{ text: string }> = ({ text }) => (
  <Text style={s.label}>{text}</Text>
);
const s = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(11,31,58,0.68)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: scaleWidth(18),
  },
  sheet: {
    width: '100%',
    maxHeight: '88%',
    backgroundColor: colors.white,
    borderRadius: scaleWidth(8),
    padding: scaleWidth(19),
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  code: { color: colors.primary, fontSize: scaleFont(23), fontWeight: '700' },
  close: {
    width: scaleWidth(38),
    height: scaleWidth(38),
    borderRadius: scaleWidth(19),
    backgroundColor: '#F4F6F8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginVertical: scaleHeight(14),
  },
  label: {
    color: colors.primary,
    fontSize: scaleFont(18),
    fontWeight: '500',
    marginTop: scaleHeight(13),
    marginBottom: scaleHeight(8),
  },
  input: {
    minHeight: scaleHeight(50),
    backgroundColor: colors.white,
    borderWidth: 1,
    borderTopWidth: 1,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderLeftWidth: 1,
    borderColor: '#000',
    borderTopColor: '#000',
    borderRightColor: '#000',
    borderBottomColor: '#000',
    borderLeftColor: '#000',
    borderStyle: 'solid',
    borderRadius: scaleWidth(8),
    paddingHorizontal: scaleWidth(12),
    color: colors.primary,
    fontSize: scaleFont(17),
  },
  hint: { color: '#999', fontSize: scaleFont(11), marginTop: scaleHeight(4) },
  error: {
    color: colors.status.danger,
    fontSize: scaleFont(14),
    marginTop: scaleHeight(12),
    textAlign: 'center',
  },
  locationBox: {
    height: scaleHeight(50),
    borderWidth: 1,
    borderColor: '#000',
    borderRadius: scaleWidth(8),
    paddingHorizontal: scaleWidth(12),
    alignItems: 'center',
    flexDirection: 'row',
    gap: scaleWidth(9),
  },
  locationText: { color: colors.primary, fontSize: scaleFont(17) },
  outlineButton: {
    height: scaleHeight(50),
    borderWidth: 1,
    borderColor: colors.gold,
    borderRadius: scaleWidth(7),
    marginTop: scaleHeight(14),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: scaleWidth(7),
  },
  outlineText: {
    color: colors.gold,
    fontSize: scaleFont(18),
    fontWeight: '500',
  },
  planRow: { flexDirection: 'row', gap: scaleWidth(18) },
  plan: {
    minHeight: scaleHeight(50),
    flex: 1,
    borderWidth: 1,
    borderColor: '#000',
    borderRadius: scaleWidth(8),
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: scaleWidth(5),
  },
  activePlan: { borderColor: colors.primary, backgroundColor: colors.primary },
  planText: {
    color: colors.primary,
    textAlign: 'center',
    fontSize: scaleFont(16),
    fontWeight: '400',
  },
  activePlanText: { color: colors.white, fontWeight: '500' },
  note: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: scaleWidth(8),
    minHeight: scaleHeight(70),
    padding: scaleWidth(12),
    marginTop: scaleHeight(16),
    justifyContent: 'center',
  },
  noteText: {
    color: colors.textGray,
    fontSize: scaleFont(16),
    lineHeight: scaleFont(22),
  },
  save: {
    height: scaleHeight(50),
    borderRadius: scaleWidth(7),
    backgroundColor: colors.primary,
    marginTop: scaleHeight(26),
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveText: { color: colors.white, fontSize: scaleFont(24), fontWeight: '700' },
  remove: {
    height: scaleHeight(50),
    borderRadius: scaleWidth(7),
    borderWidth: 1,
    borderColor: colors.status.danger,
    marginTop: scaleHeight(14),
    marginBottom: scaleHeight(4),
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeText: {
    color: colors.status.danger,
    fontSize: scaleFont(20),
    fontWeight: '700',
  },
});

export default EditSiteModal;
