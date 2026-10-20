import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Dimensions,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  PermissionsAndroid,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
  type HostInstance,
  type LayoutChangeEvent,
  type ViewStyle,
} from 'react-native';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import Feather from 'react-native-vector-icons/Feather';
import { useTranslation } from 'react-i18next';
import { launchCamera, launchImageLibrary } from 'react-native-image-picker';

import type { MainStackParamList } from '../../../navigation/types';
import {
  agencyApiService,
  type AgencySite,
} from '../../../services/agencyApiService';
import { colors } from '../../../styles/colors';
import {
  scaleFont as f,
  scaleHeight as h,
  scaleWidth as w,
} from '../../../styles/dimensions';
import ScalePressable from '../../../components/common/ScalePressable';
import { appAlert } from '../../../services/alertService';

type Props = NativeStackScreenProps<MainStackParamList, 'AgencyFileIncident'>;

const MAX_PHOTOS = 5;
const imageQuality = {
  maxWidth: 1600,
  maxHeight: 1600,
};
/** Gap between the input and its floating site menu. */
const SITE_MENU_GAP = h(6);
/** Cap for the floating menu; only the option list scrolls beyond it. */
const SITE_MENU_MAX = h(260);

type Photo = {
  uri: string;
  fileName: string;
  type: string;
};

const severityOptions: Array<{
  value: 'Low' | 'Medium' | 'High';
  labelKey: string;
}> = [
  { value: 'Low', labelKey: 'low' },
  { value: 'Medium', labelKey: 'medium' },
  { value: 'High', labelKey: 'high' },
];

const AgencyFileIncidentScreen: React.FC<Props> = ({ navigation }) => {
  const { t } = useTranslation();
  const [sites, setSites] = useState<AgencySite[]>([]);
  const [sitesLoading, setSitesLoading] = useState(false);
  const [site, setSite] = useState<AgencySite | null>(null);
  const [siteOpen, setSiteOpen] = useState(false);
  const siteAnchorRef = useRef<HostInstance>(null);
  const [siteAnchor, setSiteAnchor] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const [siteOverlayH, setSiteOverlayH] = useState(
    Dimensions.get('window').height,
  );
  const insets = useSafeAreaInsets();
  const [severity, setSeverity] = useState<'Low' | 'Medium' | 'High'>('Low');
  const [notes, setNotes] = useState('');
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const loadSites = useCallback(async () => {
    setSitesLoading(true);
    try {
      setSites(await agencyApiService.getSites());
    } catch (error) {
      appAlert.alert(
        t('dashboard.couldNotLoadSites'),
        error instanceof Error ? error.message : t('dashboard.tryAgain'),
        { type: 'error' },
      );
    } finally {
      setSitesLoading(false);
    }
  }, [t]);

  useEffect(() => {
    loadSites();
  }, [loadSites]);

  /**
   * Toggles the site menu as a floating overlay: the input is measured in
   * window coordinates so the options list can be anchored to it without ever
   * entering the form's layout flow (which used to push content down).
   */
  const toggleSiteMenu = () => {
    if (siteOpen) {
      setSiteOpen(false);
      return;
    }
    Keyboard.dismiss();
    requestAnimationFrame(() => {
      const node = siteAnchorRef.current;
      if (!node) {
        setSiteAnchor(null);
        setSiteOpen(true);
        return;
      }
      node.measureInWindow((x, y, width, height) => {
        setSiteAnchor({ x, y, width, height });
        setSiteOpen(true);
      });
    });
  };

  const handleSiteOverlayLayout = (event: LayoutChangeEvent) => {
    const next = event.nativeEvent.layout.height;
    setSiteOverlayH(current => (current === next ? current : next));
  };

  // Positioning: open below the input when there is room, otherwise flip the
  // menu above it, and always clamp it inside the visible screen area.
  const siteRoomBelow = siteAnchor
    ? siteOverlayH -
      (siteAnchor.y + siteAnchor.height) -
      insets.bottom -
      SITE_MENU_GAP
    : 0;
  const siteRoomAbove = siteAnchor
    ? siteAnchor.y - insets.top - SITE_MENU_GAP
    : 0;
  const siteMenuOpensUp =
    siteAnchor !== null &&
    siteRoomBelow < SITE_MENU_MAX &&
    siteRoomAbove > siteRoomBelow;
  const siteMenuRoom = siteMenuOpensUp ? siteRoomAbove : siteRoomBelow;
  const siteMenuHeight = siteAnchor
    ? Math.max(Math.min(SITE_MENU_MAX, siteMenuRoom), 0)
    : SITE_MENU_MAX;
  const siteMenuStyle: ViewStyle = siteAnchor
    ? {
        position: 'absolute',
        left: siteAnchor.x,
        width: siteAnchor.width,
        maxHeight: siteMenuHeight,
        ...(siteMenuOpensUp
          ? { bottom: siteOverlayH - siteAnchor.y + SITE_MENU_GAP }
          : { top: siteAnchor.y + siteAnchor.height + SITE_MENU_GAP }),
      }
    : { width: '86%', maxHeight: SITE_MENU_MAX };
  const siteListStyle: ViewStyle = {
    maxHeight: Math.max(siteMenuHeight - 2, h(80)),
  };

  const remainingSlots = MAX_PHOTOS - photos.length;

  const addPhotosFromGallery = useCallback(async () => {
    if (remainingSlots <= 0) return;
    try {
      const response = await launchImageLibrary({
        mediaType: 'photo',
        selectionLimit: remainingSlots,
        ...imageQuality,
      });
      if (response.didCancel) return;
      if (response.errorCode) {
        const message = (response.errorMessage || '').toLowerCase();
        if (
          response.errorCode === 'permission' ||
          message.includes('permission')
        ) {
          appAlert.alert(
            t('dashboard.photoPermissionTitle'),
            t('dashboard.photoPermissionBody'),
            { type: 'warning' },
          );
          return;
        }
        appAlert.error(
          t('dashboard.couldNotFile'),
          response.errorMessage || t('dashboard.tryAgain'),
        );
        return;
      }
      const assets = (response.assets ?? []).filter(
        (a): a is { uri: string; fileName?: string; type?: string } =>
          Boolean(a?.uri),
      );
      const incoming: Photo[] = assets.map(asset => ({
        uri: asset.uri,
        fileName: asset.fileName || 'image.jpg',
        type: asset.type || 'image/jpeg',
      }));
      setPhotos(prev => [...prev, ...incoming]);
    } catch {
      appAlert.alert(t('dashboard.couldNotFile'), t('dashboard.tryAgain'), {
        type: 'error',
      });
    }
  }, [remainingSlots, t]);

  const takePhoto = useCallback(async () => {
    if (remainingSlots <= 0) return;
    try {
      if (Platform.OS === 'android') {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.CAMERA,
          {
            title: t('dashboard.cameraPermissionTitle') ?? 'Camera access',
            message:
              t('dashboard.cameraPermissionBody') ??
              'Camera access is required to take a photo.',
            buttonPositive: t('dashboard.ok') ?? 'OK',
            buttonNegative: t('dashboard.cancel') ?? 'Cancel',
          },
        );
        if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
          appAlert.alert(
            t('dashboard.cameraPermissionTitle'),
            t('dashboard.cameraPermissionBody'),
            { type: 'warning' },
          );
          return;
        }
      }
      const response = await launchCamera({
        mediaType: 'photo',
        cameraType: 'back',
        saveToPhotos: false,
        ...imageQuality,
      });
      if (response.didCancel) return;
      if (response.errorCode) {
        appAlert.alert(
          t('dashboard.couldNotFile'),
          response.errorMessage || t('dashboard.tryAgain'),
          { type: 'error' },
        );
        return;
      }
      const asset = response.assets?.[0];
      if (!asset?.uri) return;
      setPhotos(prev => [
        ...prev,
        {
          uri: asset.uri!,
          fileName: asset.fileName || 'image.jpg',
          type: asset.type || 'image/jpeg',
        },
      ]);
    } catch {
      appAlert.alert(t('dashboard.couldNotFile'), t('dashboard.tryAgain'), {
        type: 'error',
      });
    }
  }, [remainingSlots, t]);

  const removePhoto = (index: number) => {
    setPhotos(prev => prev.filter((_, i) => i !== index));
  };

  const submit = async () => {
    if (!site || !notes.trim()) {
      appAlert.alert(
        t('dashboard.missingDetails'),
        t('dashboard.selectSiteAndDescribe'),
        { type: 'error' },
      );
      return;
    }
    try {
      setSubmitting(true);
      const body = new FormData();
      body.append('siteId', String(site.id));
      body.append('severity', severity.toLowerCase());
      body.append('notes', notes.trim());
      for (const photo of photos) {
        body.append('images', {
          uri: photo.uri,
          name: photo.fileName,
          type: photo.type,
        });
      }
      await agencyApiService.createIncident(body);
      navigation.navigate('AgencyIncidents');
      appAlert.success(
        t('dashboard.incidentFiled'),
        t('dashboard.incidentRecorded'),
      );
    } catch (error) {
      appAlert.alert(
        t('dashboard.couldNotFile'),
        error instanceof Error ? error.message : t('dashboard.tryAgain'),
        { type: 'error' },
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      <StatusBar barStyle="dark-content" />
      <View style={s.header}>
        <ScalePressable
          style={s.iconButton}
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel={t('dashboard.back')}
        >
          <Feather name="chevron-left" size={f(24)} color={colors.primary} />
        </ScalePressable>
        <Text style={s.title}>{t('dashboard.fileIncident')}</Text>
        <View style={s.iconButton} />
      </View>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={s.keyboard}
      >
        <ScrollView
          contentContainerStyle={s.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={s.field}>
            <Text style={s.label}>{t('dashboard.site')}</Text>
            <View ref={siteAnchorRef}>
              <ScalePressable
                style={[s.select, siteOpen && s.selectOpen]}
                disabled={sitesLoading}
                onPress={toggleSiteMenu}
                accessibilityRole="button"
                accessibilityState={{ expanded: siteOpen }}
                accessibilityLabel={t('dashboard.selectSite')}
              >
                <Text style={[s.selectText, !site && s.placeholder]}>
                  {site?.site_name || t('dashboard.selectSite')}
                </Text>
                <Feather
                  name={siteOpen ? 'chevron-up' : 'chevron-down'}
                  size={f(20)}
                  color={colors.primary}
                />
              </ScalePressable>
            </View>
          </View>

          <View style={s.field}>
            <Text style={s.label}>{t('dashboard.severity')}</Text>
            <View style={s.severityRow}>
              {severityOptions.map(item => (
                <ScalePressable
                  key={item.value}
                  style={[
                    s.severityChoice,
                    severity === item.value && s.activeSeverity,
                  ]}
                  onPress={() => setSeverity(item.value)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: severity === item.value }}
                  accessibilityLabel={`Severity ${item.value}`}
                >
                  <Text
                    style={[
                      s.severityText,
                      severity === item.value && s.activeSeverityText,
                    ]}
                  >
                    {t(`dashboard.${item.labelKey}`)}
                  </Text>
                </ScalePressable>
              ))}
            </View>
          </View>

          <View style={s.field}>
            <Text style={s.label}>{t('dashboard.notes')}</Text>
            <TextInput
              value={notes}
              onChangeText={value => setNotes(value.slice(0, 500))}
              style={s.notesInput}
              placeholder={t('dashboard.describeIncident')}
              placeholderTextColor="#A3A3A3"
              multiline
              textAlignVertical="top"
              maxLength={500}
            />
            <Text style={s.counter}>{notes.length}/500</Text>
          </View>

          <View style={s.field}>
            <Text style={s.label}>
              {t('dashboard.uploadPhotos')}{' '}
              <Text style={s.optional}>{t('dashboard.optional')}</Text>
            </Text>
            <View style={s.photoActions}>
              <ScalePressable
                style={s.photoButton}
                onPress={addPhotosFromGallery}
                disabled={submitting || remainingSlots <= 0}
                accessibilityRole="button"
                accessibilityLabel={t('dashboard.chooseFromGallery')}
              >
                <Feather name="image" size={f(20)} color={colors.primary} />
                <Text style={s.photoButtonText}>
                  {t('dashboard.addPhotos')}
                </Text>
              </ScalePressable>
              <ScalePressable
                style={s.photoButton}
                onPress={takePhoto}
                disabled={submitting || remainingSlots <= 0}
                accessibilityRole="button"
                accessibilityLabel={t('dashboard.takePhoto')}
              >
                <Feather name="camera" size={f(20)} color={colors.primary} />
                <Text style={s.photoButtonText}>
                  {t('dashboard.takePhoto')}
                </Text>
              </ScalePressable>
            </View>
            {photos.length > 0 && (
              <View style={s.photoPreview}>
                {photos.map((photo, index) => (
                  <View key={index} style={s.photoItem}>
                    <Image
                      source={{ uri: photo.uri }}
                      style={s.photoImage}
                      resizeMode="cover"
                    />
                    <ScalePressable
                      style={s.photoRemove}
                      onPress={() => removePhoto(index)}
                      accessibilityRole="button"
                      accessibilityLabel={`${t('dashboard.removePhoto')} ${
                        index + 1
                      }`}
                    >
                      <Text style={s.photoRemoveText}>×</Text>
                    </ScalePressable>
                  </View>
                ))}
                <Text style={s.photoCount}>
                  {photos.length}/{MAX_PHOTOS}
                </Text>
              </View>
            )}
            <Text style={s.help}>{t('dashboard.maxPhotos')}</Text>
          </View>

          <ScalePressable
            style={[s.submit, submitting && s.submitDisabled]}
            disabled={submitting}
            onPress={submit}
            accessibilityRole="button"
          >
            <Text style={s.submitText}>
              {submitting ? t('dashboard.filing') : t('dashboard.fileIncident')}
            </Text>
          </ScalePressable>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Site options float above the form so opening them never shifts layout. */}
      <Modal
        transparent
        visible={siteOpen}
        animationType="fade"
        onRequestClose={() => setSiteOpen(false)}
      >
        <View style={s.siteOverlay} onLayout={handleSiteOverlayLayout}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setSiteOpen(false)}
            accessibilityLabel={t('dashboard.close')}
          />
          <View style={[s.siteMenu, siteMenuStyle]}>
            <ScrollView
              style={siteListStyle}
              showsVerticalScrollIndicator={false}
              nestedScrollEnabled
              keyboardShouldPersistTaps="handled"
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
              {!sites.length && (
                <View style={s.emptySite}>
                  <Text style={s.emptyText}>{t('dashboard.noSites')}</Text>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.white, position: 'relative' },
  header: {
    height: h(60),
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: w(14),
    backgroundColor: colors.white,
  },
  iconButton: {
    minWidth: w(44),
    minHeight: w(44),
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    color: colors.primary,
    fontSize: f(20),
    fontWeight: '800',
    flex: 1,
    textAlign: 'center',
  },
  keyboard: { flex: 1 },
  content: { paddingHorizontal: w(18), paddingBottom: h(28) },
  field: { marginBottom: h(16) },
  label: {
    color: colors.primary,
    fontSize: f(14),
    fontWeight: '600',
    marginBottom: h(8),
  },
  optional: { color: '#777', fontWeight: '400', marginLeft: w(4) },
  select: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: h(50),
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: w(8),
    paddingHorizontal: w(12),
    backgroundColor: colors.white,
  },
  selectOpen: { borderColor: colors.primary },
  selectText: { color: colors.primary, fontSize: f(15), flex: 1 },
  placeholder: { color: colors.textGray },
  siteOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(11,31,58,0.45)',
  },
  siteMenu: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: w(8),
    backgroundColor: colors.white,
    overflow: 'hidden',
    // Subtle float so the menu reads as an overlay, not part of the form.
    shadowColor: '#0B1F3A',
    shadowOpacity: 0.16,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  emptySite: { padding: w(12), alignItems: 'center' },
  emptyText: { color: colors.textGray, fontSize: f(14) },
  siteOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: h(10),
    paddingHorizontal: w(12),
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },
  siteOptionText: { color: colors.primary, fontSize: f(14), flex: 1 },
  severityRow: { flexDirection: 'row', gap: w(10) },
  severityChoice: {
    flex: 1,
    minHeight: h(48),
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: w(8),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
  },
  activeSeverity: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  severityText: { fontSize: f(15), color: colors.primary, fontWeight: '600' },
  activeSeverityText: { color: colors.white },
  notesInput: {
    minHeight: h(150),
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: w(8),
    padding: w(12),
    fontSize: f(17),
    color: colors.primary,
    textAlignVertical: 'top',
  },
  counter: {
    alignSelf: 'flex-end',
    color: '#999',
    fontSize: f(11),
    marginTop: h(3),
  },
  photoActions: { flexDirection: 'row', gap: w(10), marginBottom: h(10) },
  photoButton: {
    flex: 1,
    minHeight: h(48),
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: w(8),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
  },
  photoButtonText: {
    color: colors.primary,
    fontSize: f(13),
    fontWeight: '600',
    marginTop: h(4),
  },
  photoPreview: {
    flexDirection: 'row',
    gap: w(8),
    flexWrap: 'wrap',
    marginBottom: h(8),
  },
  photoItem: {
    position: 'relative',
    width: w(72),
    height: w(72),
    borderRadius: w(8),
    overflow: 'hidden',
  },
  photoImage: { width: '100%', height: '100%' },
  photoRemove: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: w(20),
    height: w(20),
    borderRadius: w(10),
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoRemoveText: { color: colors.white, fontSize: f(14), fontWeight: '700' },
  photoCount: {
    color: colors.textGray,
    fontSize: f(11),
    alignSelf: 'center',
    marginTop: h(4),
  },
  help: { color: '#999', fontSize: f(11), marginTop: h(4) },
  submit: {
    minHeight: h(50),
    borderRadius: w(8),
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: h(10),
  },
  submitDisabled: { backgroundColor: '#C9CFD8' },
  submitText: { color: colors.white, fontSize: f(16), fontWeight: '700' },
});

export default AgencyFileIncidentScreen;
