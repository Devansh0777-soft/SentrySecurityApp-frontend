import React, { useEffect, useState } from 'react';
import {
  Alert,
  Image,
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Feather from 'react-native-vector-icons/Feather';
import { useTranslation } from 'react-i18next';

import { colors } from '../../../styles/colors';
import { scaleFont, scaleHeight, scaleWidth } from '../../../styles/dimensions';
import {
  agencyApiService,
  type AgencySite,
} from '../../../services/agencyApiService';
import ScalePressable from '../../../components/common/ScalePressable';

type Props = {
  visible: boolean;
  onClose: () => void;
  onCreated?: () => void | Promise<void>;
};

const FileIncidentModal: React.FC<Props> = ({
  visible,
  onClose,
  onCreated,
}) => {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  // Usable height below the notch/status bar and above the home indicator.
  // Sized from window height minus live insets so it adapts to Dynamic
  // Island, Android edge-to-edge status bars, and rotation — no fixed margin.
  const maxSheetHeight = Math.max(
    320,
    windowHeight - insets.top - insets.bottom - scaleHeight(48),
  );
  const [sites, setSites] = useState<AgencySite[]>([]);
  const [site, setSite] = useState<AgencySite | null>(null);
  const [siteOpen, setSiteOpen] = useState(false);
  const [severity, setSeverity] = useState('Low');
  const [notes, setNotes] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  useEffect(() => {
    if (visible)
      agencyApiService
        .getSites()
        .then(setSites)
        .catch(error =>
          Alert.alert(t('dashboard.couldNotLoadSites'), error.message),
        );
  }, [visible, t]);
  const resetForm = () => {
    setSite(null);
    setSiteOpen(false);
    setSeverity('Low');
    setNotes('');
  };
  const close = () => {
    resetForm();
    setSubmitted(false);
    onClose();
  };
  const submit = async () => {
    if (!site || !notes.trim()) {
      Alert.alert(
        t('dashboard.missingDetails'),
        t('dashboard.selectSiteAndDescribe'),
      );
      return;
    }
    try {
      setSubmitting(true);
      const body = new FormData();
      body.append('siteId', String(site.id));
      body.append('severity', severity.toLowerCase());
      body.append('notes', notes.trim());
      await agencyApiService.createIncident(body);
      await onCreated?.();
      setSubmitted(true);
    } catch (error) {
      Alert.alert(
        t('dashboard.couldNotFile'),
        error instanceof Error ? error.message : t('dashboard.tryAgain'),
      );
    } finally {
      setSubmitting(false);
    }
  };
  if (submitted)
    return (
      <Modal
        transparent
        visible={visible}
        animationType="fade"
        onRequestClose={close}
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
          <View style={s.successSheet}>
            <TouchableOpacity style={s.successClose} onPress={close}>
              <Feather name="x" size={scaleFont(29)} color="#000" />
            </TouchableOpacity>
            <View style={s.successArt}>
              <Image
                source={require('../../../assets/images/login-shield-logo.png')}
                style={s.successLogo}
                resizeMode="contain"
              />
              <View style={s.successCheck}>
                <Feather
                  name="check"
                  size={scaleFont(28)}
                  color={colors.white}
                />
              </View>
            </View>
            <Text style={s.successTitle}>{t('dashboard.incidentFiled')}</Text>
            <Text style={s.successMessage}>
              {t('dashboard.incidentRecorded')}
            </Text>
            <TouchableOpacity style={s.successButton} onPress={close}>
              <Text style={s.successButtonText}>
                {t('dashboard.fileIncident')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={close}
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
              <Text style={s.title}>{t('dashboard.fileIncident')}</Text>
              <TouchableOpacity style={s.close} onPress={close}>
                <Feather name="x" size={scaleFont(29)} color="#000" />
              </TouchableOpacity>
            </View>
            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={s.scrollContent}
            >
              <Text style={s.label}>{t('dashboard.site')}</Text>
          <View style={s.siteSelector}>
            <ScalePressable
              style={s.select}
              onPress={() => setSiteOpen(open => !open)}
              accessibilityRole="button"
              accessibilityState={{ expanded: siteOpen }}
              accessibilityLabel={t('dashboard.selectSite')}
            >
              <Text style={[s.selectText, !site && s.placeholder]}>
                {site?.site_name || t('dashboard.selectSite')}
              </Text>
              <Feather
                name={siteOpen ? 'chevron-up' : 'chevron-down'}
                size={scaleFont(23)}
                color={colors.primary}
              />
            </ScalePressable>
            {siteOpen ? (
              <View style={s.siteMenu}>
                <ScrollView
                  nestedScrollEnabled
                  showsVerticalScrollIndicator={false}
                >
                  {sites.map(item => (
                    <ScalePressable
                      key={item.id}
                      style={s.siteOption}
                      onPress={() => {
                        setSite(item);
                        setSiteOpen(false);
                      }}
                      accessibilityRole="menuitem"
                    >
                      <Text style={s.siteOptionText}>{item.site_name}</Text>
                    </ScalePressable>
                  ))}
                </ScrollView>
              </View>
            ) : null}
          </View>
          <Text style={s.label}>{t('dashboard.severity')}</Text>
          <View style={s.severityRow}>
            {(['Low', 'Medium', 'High'] as const).map(item => (
              <TouchableOpacity
                key={item}
                style={[s.severity, item === severity && s.activeSeverity]}
                onPress={() => setSeverity(item)}
              >
                <Text
                  style={[
                    s.severityText,
                    item === severity && s.activeSeverityText,
                  ]}
                >
                  {t(`dashboard.${item.toLowerCase()}`)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={s.label}>{t('dashboard.notes')}</Text>
          <TextInput
            value={notes}
            onChangeText={value => setNotes(value.slice(0, 500))}
            style={s.notes}
            placeholder={t('dashboard.describeIncident')}
            placeholderTextColor="#A3A3A3"
            multiline
            textAlignVertical="top"
            maxLength={500}
          />
          <Text style={s.counter}>{notes.length}/500</Text>
          <Text style={s.label}>
            {t('dashboard.uploadPhotos')}{' '}
            <Text style={s.optional}>{t('dashboard.optional')}</Text>
          </Text>
          <TouchableOpacity
            style={s.photos}
            onPress={() =>
              Alert.alert(
                t('dashboard.addPhotos'),
                t('dashboard.photoUploadSoon'),
              )
            }
          >
            <Feather name="image" size={scaleFont(46)} color="#000" />
            <Feather
              name="plus"
              size={scaleFont(24)}
              color="#000"
              style={s.plus}
            />
            <Text style={s.photosText}>{t('dashboard.addPhotos')}</Text>
          </TouchableOpacity>
          <Text style={s.help}>{t('dashboard.maxPhotos')}</Text>
          <ScalePressable
            style={s.submit}
            onPress={submit}
            disabled={submitting}
            accessibilityRole="button"
          >
            <Text style={s.submitText}>
              {submitting ? t('dashboard.filing') : t('dashboard.fileIncident')}
            </Text>
          </ScalePressable>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
};
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
    marginBottom: scaleHeight(24),
  },
  title: { fontSize: scaleFont(23), fontWeight: '700', color: colors.primary },
  close: { backgroundColor: '#F7F7F7', borderRadius: 4 },
  label: {
    fontSize: scaleFont(18),
    fontWeight: '500',
    color: colors.primary,
    marginBottom: scaleHeight(8),
    marginTop: scaleHeight(13),
  },
  siteSelector: { position: 'relative', zIndex: 20 },
  select: {
    height: scaleHeight(50),
    borderWidth: 1,
    borderRadius: 8,
    borderColor: '#000',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: scaleWidth(12),
  },
  selectText: { fontSize: scaleFont(17), color: colors.primary },
  placeholder: { color: '#A3A3A3' },
  siteMenu: {
    position: 'absolute',
    top: scaleHeight(54),
    left: 0,
    right: 0,
    maxHeight: scaleHeight(155),
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 6,
    elevation: 12,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  siteOption: {
    minHeight: scaleHeight(42),
    justifyContent: 'center',
    paddingHorizontal: scaleWidth(12),
  },
  siteOptionText: { color: colors.primary, fontSize: scaleFont(14) },
  severityRow: { flexDirection: 'row', gap: scaleWidth(18) },
  severity: {
    height: scaleHeight(40),
    flex: 1,
    borderWidth: 1,
    borderColor: '#000',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeSeverity: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  severityText: { fontSize: scaleFont(18), color: colors.primary },
  activeSeverityText: { color: colors.white },
  notes: {
    height: scaleHeight(150),
    borderWidth: 1,
    borderColor: '#000',
    borderRadius: 8,
    padding: scaleWidth(12),
    fontSize: scaleFont(17),
    color: colors.primary,
  },
  counter: {
    alignSelf: 'flex-end',
    color: '#999',
    fontSize: scaleFont(11),
    marginTop: 3,
  },
  optional: { color: '#777' },
  photos: {
    height: scaleHeight(150),
    borderWidth: 1,
    borderColor: '#000',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  plus: {
    position: 'absolute',
    marginLeft: scaleWidth(47),
    marginTop: scaleHeight(25),
  },
  photosText: {
    fontSize: scaleFont(19),
    fontWeight: '500',
    color: colors.primary,
    marginTop: 4,
  },
  help: { color: '#999', fontSize: scaleFont(11), marginTop: 4 },
  submit: {
    height: scaleHeight(50),
    borderRadius: 7,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: scaleHeight(63),
  },
  submitText: {
    color: colors.white,
    fontSize: scaleFont(24),
    fontWeight: '700',
  },
  successSheet: {
    width: '100%',
    backgroundColor: colors.white,
    borderRadius: scaleWidth(8),
    padding: scaleWidth(13),
    alignItems: 'center',
  },
  successClose: {
    alignSelf: 'flex-end',
    backgroundColor: '#F7F7F7',
    borderRadius: 4,
  },
  successArt: {
    width: scaleWidth(180),
    height: scaleHeight(215),
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  successLogo: { width: scaleWidth(155), height: scaleHeight(180) },
  successCheck: {
    position: 'absolute',
    right: scaleWidth(10),
    top: scaleHeight(36),
    width: scaleWidth(52),
    height: scaleWidth(52),
    borderRadius: scaleWidth(26),
    backgroundColor: '#35C45A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  successTitle: {
    fontSize: scaleFont(31),
    lineHeight: scaleFont(38),
    fontWeight: '800',
    color: colors.primary,
    textAlign: 'center',
  },
  successMessage: {
    fontSize: scaleFont(19),
    lineHeight: scaleFont(25),
    color: colors.primary,
    textAlign: 'center',
    marginTop: scaleHeight(13),
  },
  successButton: {
    alignSelf: 'stretch',
    height: scaleHeight(50),
    backgroundColor: colors.primary,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: scaleHeight(25),
  },
  successButtonText: {
    color: colors.white,
    fontSize: scaleFont(24),
    fontWeight: '700',
  },
});
export default FileIncidentModal;
