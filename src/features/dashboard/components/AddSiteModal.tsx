import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import Feather from 'react-native-vector-icons/Feather';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  agencyApiService,
  type AgencySite,
} from '../../../services/agencyApiService';
import { ApiError } from '../../../services/apiClient';
import { colors } from '../../../styles/colors';
import { scaleFont, scaleHeight, scaleWidth } from '../../../styles/dimensions';
import { appAlert } from '../../../services/alertService';

type Props = {
  visible: boolean;
  onClose: () => void;
  onCreated: (site: AgencySite) => void;
};

const AddSiteModal: React.FC<Props> = ({ visible, onClose, onCreated }) => {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  // Keep the whole sheet below the notch/status bar and above the home
  // indicator on both platforms; derives from live insets + window height so
  // small phones, large phones, and rotation are all handled.
  const maxSheetHeight = Math.max(
    320,
    windowHeight - insets.top - insets.bottom - scaleHeight(48),
  );
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [plan, setPlan] = useState('day_shift');
  const [startTime, setStartTime] = useState('08:00 PM');
  const [endTime, setEndTime] = useState('08:00 AM');
  const [saving, setSaving] = useState(false);
  const save = async () => {
    if (!name.trim() || !address.trim()) {
      appAlert.alert(
        t('dashboard.missingDetails'),
        t('dashboard.siteAndAddressRequired'),
        { type: 'error' },
      );
      return;
    }
    try {
      setSaving(true);
      const response = (await agencyApiService.createSite({
        siteName: name.trim(),
        siteAddress: address.trim(),
        coveragePlan: plan,
        startTime,
        endTime,
      })) as { data: AgencySite };
      onCreated(response.data);
      onClose();
    } catch (error) {
      const limitReached = error instanceof ApiError && error.status === 403;
      appAlert.alert(
        limitReached ? t('dashboard.planLimitTitle') : t('dashboard.saveSite'),
        error instanceof Error ? error.message : t('dashboard.tryAgain'),
        { type: 'error' },
      );
    } finally {
      setSaving(false);
    }
  };
  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View
        style={[
          s.overlay,
          {
            paddingTop: insets.top + scaleHeight(12),
            paddingBottom: insets.bottom + scaleHeight(12),
          },
        ]}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={s.keyboard}
        >
          <View style={[s.sheet, { maxHeight: maxSheetHeight }]}>
            <View style={s.titleRow}>
              <Text style={s.title}>{t('dashboard.addSite')}</Text>
              <TouchableOpacity style={s.close} onPress={onClose}>
                <Feather name="x" size={scaleFont(29)} color="#000" />
              </TouchableOpacity>
            </View>
            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={s.scrollContent}
            >
              <Label text={t('dashboard.siteName')} required />
              <Input
                value={name}
                onChangeText={setName}
                placeholder={t('dashboard.enterSiteName')}
              />
              <Label text={t('dashboard.address')} required />
              <Input
                value={address}
                onChangeText={setAddress}
                placeholder={t('dashboard.enterCompleteAddress')}
              />
              <Text style={s.hint}>{t('dashboard.startTyping')}</Text>
              <Label text={t('dashboard.locationGps')} />
              <View style={s.gps}>
                <Text style={s.gpsText}>{t('dashboard.noGps')}</Text>
                <TouchableOpacity
                  style={s.gpsButton}
                  onPress={() =>
                    appAlert.alert(
                      t('dashboard.locationGps'),
                      t('dashboard.gpsSoon'),
                    )
                  }
                >
                  <Feather
                    name="map-pin"
                    size={scaleFont(20)}
                    color="#FFB800"
                  />
                  <Text style={s.gpsButtonText}>
                    {t('dashboard.useCurrentLocation')}
                  </Text>
                </TouchableOpacity>
              </View>
              <Label text={t('dashboard.coveragePlan')} />
              <View style={s.planRow}>
                {[
                  ['day_shift', 'dayShift'],
                  ['night_watch', 'nightWatch'],
                  ['24x7', 'coverage24x7'],
                ].map(([key, labelKey]) => (
                  <TouchableOpacity
                    key={key}
                    style={[s.plan, plan === key && s.activePlan]}
                    onPress={() => setPlan(key)}
                  >
                    <Text
                      style={[s.planText, plan === key && s.activePlanText]}
                    >
                      {t(`dashboard.${labelKey}`)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={s.timeLabels}>
                <Text style={s.label}>{t('dashboard.startTime')}</Text>
                <Text style={s.label}>{t('dashboard.endTime')}</Text>
              </View>
              <View style={s.timeRow}>
                <Time value={startTime} onChange={setStartTime} />
                <Time value={endTime} onChange={setEndTime} />
              </View>
              <TouchableOpacity style={s.save} onPress={save} disabled={saving}>
                <Text style={s.saveText}>
                  {saving ? t('dashboard.saving') : t('dashboard.saveSite')}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
};
const Label = ({ text, required }: { text: string; required?: boolean }) => (
  <Text style={s.label}>
    {text}
    {required ? <Text style={s.required}>*</Text> : null}
  </Text>
);
const Input = ({
  value,
  onChangeText,
  placeholder,
}: {
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
}) => (
  <TextInput
    value={value}
    onChangeText={onChangeText}
    placeholder={placeholder}
    placeholderTextColor="#A3A3A3"
    style={s.input}
  />
);
const Time = ({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) => (
  <View style={s.time}>
    <TextInput value={value} onChangeText={onChange} style={s.timeInput} />
    <Feather name="clock" size={scaleFont(23)} color="#000" />
  </View>
);
const s = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.64)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: scaleWidth(18),
  },
  keyboard: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheet: {
    width: '100%',
    backgroundColor: colors.white,
    borderRadius: scaleWidth(8),
    padding: scaleWidth(19),
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: scaleHeight(4),
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: scaleHeight(20),
  },
  title: { fontSize: scaleFont(23), fontWeight: '700', color: colors.primary },
  close: { backgroundColor: '#F7F7F7', borderRadius: 4 },
  label: {
    fontSize: scaleFont(18),
    fontWeight: '500',
    color: colors.primary,
    marginTop: scaleHeight(13),
    marginBottom: scaleHeight(8),
  },
  required: { color: '#F22121' },
  input: {
    height: scaleHeight(50),
    borderWidth: 1,
    borderColor: '#000',
    borderRadius: 8,
    paddingHorizontal: scaleWidth(12),
    fontSize: scaleFont(17),
    color: colors.primary,
  },
  hint: { fontSize: scaleFont(11), color: '#999', marginTop: 4 },
  gps: {
    height: scaleHeight(128),
    backgroundColor: '#F7F7F7',
    borderWidth: 1,
    borderColor: '#DADADA',
    borderRadius: 8,
    alignItems: 'center',
    paddingTop: scaleHeight(18),
  },
  gpsText: { fontSize: scaleFont(17), color: colors.primary },
  gpsButton: {
    marginTop: scaleHeight(18),
    height: scaleHeight(50),
    alignSelf: 'stretch',
    marginHorizontal: scaleWidth(12),
    borderWidth: 1,
    borderColor: '#FFB800',
    borderRadius: 7,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: scaleWidth(6),
  },
  gpsButtonText: {
    color: '#FFB800',
    fontSize: scaleFont(18),
    fontWeight: '500',
  },
  planRow: { flexDirection: 'row', gap: scaleWidth(18) },
  plan: {
    height: scaleHeight(50),
    flex: 1,
    borderWidth: 1,
    borderColor: '#000',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activePlan: { backgroundColor: colors.primary, borderColor: colors.primary },
  planText: {
    fontSize: scaleFont(16),
    color: colors.primary,
    textAlign: 'center',
  },
  activePlanText: { color: colors.white },
  timeLabels: { flexDirection: 'row', justifyContent: 'space-between' },
  timeRow: { flexDirection: 'row', gap: scaleWidth(12) },
  time: {
    height: scaleHeight(50),
    flex: 1,
    borderWidth: 1,
    borderColor: '#000',
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: scaleWidth(12),
  },
  timeInput: { fontSize: scaleFont(17), color: colors.primary, flex: 1 },
  save: {
    height: scaleHeight(50),
    backgroundColor: colors.primary,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: scaleHeight(82),
  },
  saveText: { fontSize: scaleFont(24), color: colors.white, fontWeight: '700' },
});
export default AddSiteModal;
