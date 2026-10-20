import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
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
import { useTranslation } from 'react-i18next';
import ScalePressable from '../../../components/common/ScalePressable';
import {
  clientService,
  type AvailableAgency,
  type CoverageRequest,
  type PublicAgencyDetails,
} from '../../../services/clientService';
import {
  indiaLocationService,
  type IndiaLocationOption,
} from '../../../services/indiaLocationService';
import { colors } from '../../../styles/colors';
import { spacing } from '../../../styles/spacing';
import { typography } from '../../../styles/typography';
import { scaleFont } from '../../../styles/dimensions';
import { appAlert } from '../../../services/alertService';

type Picker = 'state' | 'district' | 'city' | null;
type CheckpointResolution = { checkpoints: string[] } | { error: string };
/** Every field of the request form that carries its own validation state. */
type FieldKey =
  | 'eventName'
  | 'state'
  | 'district'
  | 'city'
  | 'siteLocation'
  | 'guardsNeeded'
  | 'agency';
type FieldErrors = Partial<Record<FieldKey, string>>;
/** Validation order so the first invalid field is the one focused/scrolled to. */
const FIELD_ORDER: FieldKey[] = [
  'eventName',
  'state',
  'district',
  'city',
  'agency',
  'siteLocation',
  'guardsNeeded',
];
const emptyForm = {
  eventName: '',
  state: '',
  district: '',
  city: '',
  siteLocation: '',
  notes: '',
};

export default function ClientCoverageRequests() {
  const { t, i18n } = useTranslation();
  const [form, setFormState] = useState(emptyForm);
  const [guardsNeeded, setGuardsNeeded] = useState(1);
  const [requests, setRequests] = useState<CoverageRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [picker, setPicker] = useState<Picker>(null);
  const [query, setQuery] = useState('');
  const [states, setStates] = useState<IndiaLocationOption[]>([]);
  const [districts, setDistricts] = useState<IndiaLocationOption[]>([]);
  const [cities, setCities] = useState<IndiaLocationOption[]>([]);
  const [locationsLoading, setLocationsLoading] = useState(false);
  const [agencies, setAgencies] = useState<AvailableAgency[]>([]);
  const [agenciesLoading, setAgenciesLoading] = useState(false);
  const [agenciesError, setAgenciesError] = useState('');
  const [selectedAgencyId, setSelectedAgencyId] = useState<number | null>(null);
  const [agencyDetails, setAgencyDetails] =
    useState<PublicAgencyDetails | null>(null);
  const [agencyDetailsOpen, setAgencyDetailsOpen] = useState(false);
  const [agencyDetailsLoading, setAgencyDetailsLoading] = useState(false);
  const [checkpoints, setCheckpoints] = useState<string[]>([]);
  const [checkpointDraft, setCheckpointDraft] = useState('');
  const [checkpointError, setCheckpointError] = useState('');
  const [expandedRequestId, setExpandedRequestId] = useState<number | null>(
    null,
  );
  // Per-field validation messages shown directly beneath each control.
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const eventNameRef = useRef<React.ComponentRef<typeof TextInput>>(null);
  const siteLocationRef = useRef<React.ComponentRef<typeof TextInput>>(null);
  // Synchronous duplicate-submission guard (state updates are async).
  const submittingRef = useRef(false);
  // Mirrors of the form/guards state so validation always reads the latest
  // values, even when it runs in the same tick as a change (e.g. on blur).
  const formRef = useRef(form);
  const guardsNeededRef = useRef(guardsNeeded);
  formRef.current = form;
  guardsNeededRef.current = guardsNeeded;

  const loadRequests = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setRequests(await clientService.getCoverageRequests());
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : t('coverageRequest.loadFailed'),
      );
    } finally {
      setLoading(false);
    }
  }, [t]);
  useEffect(() => {
    loadRequests();
    indiaLocationService
      .getStates()
      .then(setStates)
      .catch(() => setError(t('coverageRequest.locationFailed')));
  }, [loadRequests, t]);

  useEffect(() => {
    let active = true;
    if (!form.district) {
      setAgencies([]);
      setSelectedAgencyId(null);
      setAgenciesError('');
      return () => {
        active = false;
      };
    }
    setAgenciesLoading(true);
    setAgenciesError('');
    clientService
      .getAvailableAgencies(form.district)
      .then(data => {
        if (active) setAgencies(data);
      })
      .catch(() => {
        if (active) {
          setAgencies([]);
          setAgenciesError(t('coverageRequest.agenciesFailed'));
        }
      })
      .finally(() => {
        if (active) setAgenciesLoading(false);
      });
    return () => {
      active = false;
    };
  }, [form.district, t]);

  const clearFieldError = (key: FieldKey) =>
    setFieldErrors(current => {
      if (!current[key]) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });

  const update = (key: keyof typeof emptyForm, value: string) => {
    const next = { ...formRef.current, [key]: value };
    // Keep the ref in sync synchronously so a blur that fires right after the
    // change validates against the updated value, not a stale closure.
    formRef.current = next;
    setFormState(next);
    // The user is correcting this field — clear its stale error immediately.
    clearFieldError(key as FieldKey);
  };

  /** Single source of truth for each field's validation rule. */
  const validateField = (key: FieldKey): string => {
    const current = formRef.current;
    switch (key) {
      case 'eventName':
        return current.eventName.trim()
          ? ''
          : t('coverageRequest.eventNameRequired');
      case 'state':
        return current.state ? '' : t('coverageRequest.stateRequired');
      case 'district':
        return current.district ? '' : t('coverageRequest.districtRequired');
      case 'city':
        return current.city ? '' : t('coverageRequest.cityRequired');
      case 'siteLocation':
        return current.siteLocation.trim()
          ? ''
          : t('coverageRequest.siteLocationRequired');
      case 'guardsNeeded':
        return Number.isInteger(guardsNeededRef.current) &&
          guardsNeededRef.current >= 1 &&
          guardsNeededRef.current <= 99
          ? ''
          : t('coverageRequest.guardsNeededInvalid');
      case 'agency':
        return selectedAgencyId !== null
          ? ''
          : t('coverageRequest.agencyRequired');
    }
  };

  /** Re-validates one field and stores (or clears) its message. */
  const validateAndSet = (key: FieldKey): string => {
    const message = validateField(key);
    setFieldErrors(current => {
      if ((current[key] ?? '') === message) return current;
      const next = { ...current };
      if (message) next[key] = message;
      else delete next[key];
      return next;
    });
    return message;
  };

  const validateAll = (): FieldErrors => {
    const errors: FieldErrors = {};
    for (const key of FIELD_ORDER) {
      const message = validateField(key);
      if (message) errors[key] = message;
    }
    return errors;
  };

  /**
   * Brings the first invalid field into view. Text inputs are focused, which
   * makes the platform scroll them into view inside the parent ScrollView;
   * dropdown-style fields rely on their inline error being visible.
   */
  const focusInvalidField = (errors: FieldErrors) => {
    const first = FIELD_ORDER.find(key => errors[key]);
    if (first === 'eventName') eventNameRef.current?.focus();
    if (first === 'siteLocation') siteLocationRef.current?.focus();
  };
  const find = (options: IndiaLocationOption[], name: string) =>
    options.find(option => option.name.toLowerCase() === name.toLowerCase());
  const openPicker = async (type: Exclude<Picker, null>) => {
    setPicker(type);
    setQuery('');
    setLocationsLoading(true);
    try {
      if (type === 'district') {
        const state = find(states, form.state);
        if (!state) throw new Error(t('coverageRequest.selectStateFirst'));
        setDistricts(await indiaLocationService.getDistricts(state.slug));
      }
      if (type === 'city') {
        const state = find(states, form.state);
        const district = find(districts, form.district);
        if (!state || !district)
          throw new Error(t('coverageRequest.selectDistrictFirst'));
        setCities(
          await indiaLocationService.getCities(state.slug, district.slug),
        );
      }
    } catch (locationError) {
      setPicker(null);
      appAlert.alert(
        t('coverageRequest.location'),
        locationError instanceof Error
          ? locationError.message
          : t('coverageRequest.locationFailed'),
        { type: 'error' },
      );
    } finally {
      setLocationsLoading(false);
    }
  };
  const options =
    picker === 'state' ? states : picker === 'district' ? districts : cities;
  const filteredOptions = useMemo(
    () =>
      options.filter(option =>
        option.name.toLowerCase().includes(query.trim().toLowerCase()),
      ),
    [options, query],
  );
  const select = (option: IndiaLocationOption) => {
    if (picker === 'state') {
      setSelectedAgencyId(null);
      const next = {
        ...formRef.current,
        state: option.name,
        district: '',
        city: '',
      };
      formRef.current = next;
      setFormState(next);
      setDistricts([]);
      setCities([]);
      // The old district/city/agency no longer match the new state.
      clearFieldError('state');
      clearFieldError('district');
      clearFieldError('city');
      clearFieldError('agency');
    }
    if (picker === 'district') {
      setSelectedAgencyId(null);
      const next = { ...formRef.current, district: option.name, city: '' };
      formRef.current = next;
      setFormState(next);
      setCities([]);
      clearFieldError('district');
      clearFieldError('city');
      clearFieldError('agency');
    }
    if (picker === 'city') update('city', option.name);
    setPicker(null);
  };

  /** Closing the picker without choosing validates the field it belongs to. */
  const closePicker = () => {
    const dismissed = picker;
    setPicker(null);
    if (dismissed) validateAndSet(dismissed);
  };
  const openAgencyDetails = async (agency: AvailableAgency) => {
    if (selectedAgencyId === agency.id) {
      setSelectedAgencyId(null);
      return;
    }
    setAgencyDetails(null);
    setAgencyDetailsOpen(true);
    setAgencyDetailsLoading(true);
    try {
      setAgencyDetails(await clientService.getAgencyDetails(agency.id));
    } catch (detailsError) {
      setAgencyDetailsOpen(false);
      appAlert.alert(
        t('coverageRequest.agencyDetails'),
        detailsError instanceof Error
          ? detailsError.message
          : t('coverageRequest.agencyDetailsFailed'),
        { type: 'error' },
      );
    } finally {
      setAgencyDetailsLoading(false);
    }
  };
  const submit = async () => {
    // Synchronous guard against double taps creating duplicate requests.
    if (submittingRef.current || saving) return;
    const errors = validateAll();
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      focusInvalidField(errors);
      return;
    }
    setFieldErrors({});
    // A checkpoint typed but not yet added is still the client's intent, so
    // resolve it here instead of blocking the send.
    const resolved = resolveCheckpointDraft();
    if ('error' in resolved) {
      setCheckpointError(resolved.error);
      return;
    }
    const requestedCheckpoints = resolved.checkpoints;
    // validateAll() guarantees an agency; keep the narrowing explicit so the
    // agency's real ID is always part of the payload (never a name-only or
    // hardcoded agency).
    const agencyId = selectedAgencyId;
    if (agencyId === null) return;
    submittingRef.current = true;
    setSaving(true);
    setError('');
    try {
      await clientService.createCoverageRequest({
        ...form,
        eventName: form.eventName.trim(),
        siteLocation: form.siteLocation.trim(),
        notes: form.notes.trim(),
        guardsNeeded,
        agencyId,
        ...(requestedCheckpoints.length
          ? { checkpoints: requestedCheckpoints.map(name => ({ name })) }
          : {}),
      });
      setFormState(emptyForm);
      formRef.current = emptyForm;
      setGuardsNeeded(1);
      guardsNeededRef.current = 1;
      setSelectedAgencyId(null);
      setCheckpoints([]);
      setCheckpointDraft('');
      setCheckpointError('');
      setFieldErrors({});
      await loadRequests();
      appAlert.alert(
        t('coverageRequest.sentTitle'),
        t('coverageRequest.sentMessage'),
        { type: 'success' },
      );
    } catch (saveError) {
      // Entered values are preserved — only the failure message is surfaced.
      setError(
        saveError instanceof Error
          ? saveError.message
          : t('coverageRequest.sendFailed'),
      );
    } finally {
      submittingRef.current = false;
      setSaving(false);
    }
  };

  const resolveCheckpointDraft = (): CheckpointResolution => {
    const name = checkpointDraft.trim();
    if (!name) return { checkpoints };
    if (checkpoints.some(item => item.toLowerCase() === name.toLowerCase())) {
      return { error: t('coverageRequest.checkpointDuplicate') };
    }
    if (checkpoints.length >= 20) {
      return { error: t('coverageRequest.checkpointLimit') };
    }
    return { checkpoints: [...checkpoints, name] };
  };

  const addCheckpoint = () => {
    if (!checkpointDraft.trim()) {
      setCheckpointError(t('coverageRequest.checkpointNameRequired'));
      return;
    }
    const resolved = resolveCheckpointDraft();
    if ('error' in resolved) {
      setCheckpointError(resolved.error);
      return;
    }
    setCheckpoints(resolved.checkpoints);
    setCheckpointDraft('');
    setCheckpointError('');
  };

  const removeCheckpoint = (index: number) => {
    setCheckpoints(current => current.filter((_, item) => item !== index));
    setCheckpointError('');
  };

  return (
    <View style={s.container}>
      <View style={s.card}>
        <Text style={s.sectionTitle}>{t('coverageRequest.location')}</Text>
        <Field
          label={t('coverageRequest.eventName')}
          value={form.eventName}
          onChangeText={value => update('eventName', value)}
          placeholder={t('coverageRequest.eventPlaceholder')}
          required
          error={fieldErrors.eventName}
          inputRef={eventNameRef}
          onBlur={() => validateAndSet('eventName')}
        />
        <Dropdown
          label={t('dashboard.state')}
          value={form.state}
          open={picker === 'state'}
          required
          error={fieldErrors.state}
          onPress={() => openPicker('state')}
        />
        <Dropdown
          label={t('dashboard.district')}
          value={form.district}
          open={picker === 'district'}
          required
          error={fieldErrors.district}
          disabled={!form.state}
          onPress={() => openPicker('district')}
        />
        <Dropdown
          label={t('dashboard.city')}
          value={form.city}
          open={picker === 'city'}
          required
          error={fieldErrors.city}
          disabled={!form.district}
          onPress={() => openPicker('city')}
        />
        {form.district ? (
          <View style={s.agenciesSection}>
            <Text style={s.sectionTitle}>
              {t('coverageRequest.agenciesInArea')}
              <Text style={s.required}> *</Text>
            </Text>
            {agenciesLoading ? (
              <ActivityIndicator color={colors.primary} />
            ) : agenciesError ? (
              <Text style={s.error}>{agenciesError}</Text>
            ) : agencies.length ? (
              agencies
                .filter(
                  agency =>
                    selectedAgencyId === null || agency.id === selectedAgencyId,
                )
                .map(agency => (
                  <ScalePressable
                    key={agency.id}
                    style={[
                      s.agencyCard,
                      agency.id === selectedAgencyId && s.selectedAgencyCard,
                    ]}
                    onPress={() => openAgencyDetails(agency)}
                    accessibilityRole="radio"
                    accessibilityState={{
                      selected: agency.id === selectedAgencyId,
                    }}
                  >
                    <View style={s.agencyIcon}>
                      <Feather
                        name="briefcase"
                        size={scaleFont(20)}
                        color={colors.gold}
                      />
                    </View>
                    <View style={s.agencyDetails}>
                      <Text style={s.agencyName}>{agency.agency_name}</Text>
                      <Text style={s.muted}>
                        {[agency.city, agency.district, agency.state]
                          .filter(Boolean)
                          .join(', ')}
                      </Text>
                    </View>
                    <View style={s.availableBadge}>
                      <Text style={s.availableText}>
                        {agency.id === selectedAgencyId
                          ? t('coverageRequest.changeAgency')
                          : t('coverageRequest.selectAgency')}
                      </Text>
                    </View>
                  </ScalePressable>
                ))
            ) : (
              <Text style={s.muted}>
                {t('coverageRequest.noAgenciesInArea')}
              </Text>
            )}
            {fieldErrors.agency ? (
              <Text accessibilityRole="alert" style={s.error}>
                {fieldErrors.agency}
              </Text>
            ) : null}
          </View>
        ) : null}
        <Field
          label={t('coverageRequest.siteLocation')}
          value={form.siteLocation}
          onChangeText={value => update('siteLocation', value)}
          placeholder={t('coverageRequest.sitePlaceholder')}
          required
          error={fieldErrors.siteLocation}
          inputRef={siteLocationRef}
          onBlur={() => validateAndSet('siteLocation')}
        />
        <View style={s.field}>
          <Text style={s.label}>
            {t('coverageRequest.guardsNeeded')}
            <Text style={s.required}> *</Text>
          </Text>
          <View style={s.counter}>
            <ScalePressable
              style={s.counterButton}
              disabled={guardsNeeded === 1 || saving}
              onPress={() => {
                const next = Math.max(1, guardsNeededRef.current - 1);
                guardsNeededRef.current = next;
                setGuardsNeeded(next);
              }}
            >
              <Feather
                name="minus"
                size={scaleFont(20)}
                color={colors.primary}
              />
            </ScalePressable>
            <Text style={s.count}>{guardsNeeded}</Text>
            <ScalePressable
              style={s.counterButton}
              disabled={saving}
              onPress={() => {
                const next = Math.min(99, guardsNeededRef.current + 1);
                guardsNeededRef.current = next;
                setGuardsNeeded(next);
              }}
            >
              <Feather
                name="plus"
                size={scaleFont(20)}
                color={colors.primary}
              />
            </ScalePressable>
          </View>
          {fieldErrors.guardsNeeded ? (
            <Text accessibilityRole="alert" style={s.error}>
              {fieldErrors.guardsNeeded}
            </Text>
          ) : null}
        </View>
        <Field
          label={t('coverageRequest.notes')}
          value={form.notes}
          onChangeText={value => update('notes', value)}
          placeholder={t('coverageRequest.notesPlaceholder')}
          multiline
        />
        <View style={s.field}>
          <Text style={s.label}>{t('coverageRequest.checkpointsTitle')}</Text>
          <Text style={s.muted}>{t('coverageRequest.checkpointsHint')}</Text>
          {checkpoints.map((name, index) => (
            <View key={`${name}-${index}`} style={s.checkpointRow}>
              <View style={s.checkpointSeq}>
                <Text style={s.checkpointSeqText}>{index + 1}</Text>
              </View>
              <Text style={s.checkpointName} numberOfLines={1}>
                {name}
              </Text>
              <ScalePressable
                style={s.checkpointRemove}
                onPress={() => removeCheckpoint(index)}
                accessibilityRole="button"
                accessibilityLabel={t('coverageRequest.removeCheckpoint')}
              >
                <Feather
                  name="trash-2"
                  size={scaleFont(18)}
                  color={colors.status.danger}
                />
              </ScalePressable>
            </View>
          ))}
          <View style={s.checkpointAddRow}>
            <TextInput
              style={[s.input, s.checkpointInput]}
              value={checkpointDraft}
              onChangeText={value => {
                setCheckpointDraft(value);
                if (checkpointError) setCheckpointError('');
              }}
              placeholder={t('coverageRequest.checkpointPlaceholder')}
              placeholderTextColor={colors.textGray}
              maxLength={80}
              editable={!saving}
              onSubmitEditing={addCheckpoint}
              returnKeyType="done"
            />
            <ScalePressable
              style={s.checkpointAdd}
              onPress={addCheckpoint}
              disabled={saving}
              accessibilityRole="button"
              accessibilityLabel={t('coverageRequest.addCheckpoint')}
            >
              <Feather name="plus" size={scaleFont(20)} color={colors.white} />
            </ScalePressable>
          </View>
          {checkpointError ? (
            <Text style={s.error}>{checkpointError}</Text>
          ) : null}
          {checkpoints.length >= 20 ? (
            <Text style={s.muted}>{t('coverageRequest.checkpointLimit')}</Text>
          ) : null}
        </View>
        {error ? <Text style={s.error}>{error}</Text> : null}
        <ScalePressable
          style={s.submit}
          disabled={saving}
          onPress={submit}
          accessibilityState={{ disabled: saving, busy: saving }}
        >
          <Text style={s.submitText}>
            {saving ? t('coverageRequest.sending') : t('coverageRequest.send')}
          </Text>
        </ScalePressable>
      </View>
      <View style={s.card}>
        <Text style={s.sectionTitle}>{t('coverageRequest.myRequests')}</Text>
        {loading ? (
          <ActivityIndicator color={colors.primary} />
        ) : !requests.length ? (
          <Text style={s.muted}>{t('coverageRequest.none')}</Text>
        ) : (
          requests.map(request => (
            <View key={request.id} style={s.request}>
              <View style={s.requestRow}>
                <Text style={s.requestTitle}>{request.event_name}</Text>
                <Text style={s.badge}>
                  {t(`coverageRequest.status.${request.status}`, {
                    defaultValue: request.status,
                  })}
                </Text>
              </View>
              <Text style={s.muted}>{request.site_location}</Text>
              <Text style={s.muted}>
                {new Date(request.created_at).toLocaleDateString(i18n.language)}
              </Text>
              {(request.checkpoints?.length ?? 0) > 0 ? (
                <View style={s.requestCheckpoints}>
                  <ScalePressable
                    style={s.requestCheckpointToggle}
                    onPress={() =>
                      setExpandedRequestId(current =>
                        current === request.id ? null : request.id,
                      )
                    }
                    accessibilityRole="button"
                  >
                    <Feather
                      name="map-pin"
                      size={scaleFont(16)}
                      color={colors.primary}
                    />
                    <Text style={s.requestCheckpointTitle}>
                      {t('coverageRequest.checkpointsCount', {
                        count: request.checkpoints?.length ?? 0,
                      })}
                    </Text>
                    <Feather
                      name={
                        expandedRequestId === request.id
                          ? 'chevron-up'
                          : 'chevron-down'
                      }
                      size={scaleFont(18)}
                      color={colors.primary}
                    />
                  </ScalePressable>
                  {expandedRequestId === request.id ? (
                    <View style={s.requestCheckpointList}>
                      {(request.checkpoints ?? []).map((point, index) => (
                        <View
                          key={point.id ?? `${point.name}-${index}`}
                          style={s.requestCheckpointRow}
                        >
                          <Text style={s.requestCheckpointSeq}>
                            {point.sequence_order ?? index + 1}
                          </Text>
                          <Text style={s.requestCheckpointName}>
                            {point.name}
                          </Text>
                        </View>
                      ))}
                    </View>
                  ) : null}
                </View>
              ) : null}
            </View>
          ))
        )}
      </View>
      <Modal
        visible={agencyDetailsOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setAgencyDetailsOpen(false)}
      >
        <View style={s.overlay}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setAgencyDetailsOpen(false)}
          />
          <View style={s.agencyModal}>
            <View style={s.modalHeader}>
              <Text style={s.pickerTitle}>
                {t('coverageRequest.agencyDetails')}
              </Text>
              <ScalePressable
                style={s.closeButton}
                onPress={() => setAgencyDetailsOpen(false)}
                accessibilityLabel={t('dashboard.close')}
              >
                <Feather name="x" size={scaleFont(21)} color={colors.primary} />
              </ScalePressable>
            </View>
            {agencyDetailsLoading ? (
              <View style={s.detailsLoading}>
                <ActivityIndicator color={colors.primary} />
                <Text style={s.muted}>
                  {t('coverageRequest.loadingAgencyDetails')}
                </Text>
              </View>
            ) : agencyDetails ? (
              <>
                <View style={s.detailsHero}>
                  <View style={s.agencyIcon}>
                    <Feather
                      name="shield"
                      size={scaleFont(21)}
                      color={colors.gold}
                    />
                  </View>
                  <View style={s.agencyDetails}>
                    <Text style={s.detailsName}>
                      {agencyDetails.agency_name}
                    </Text>
                    <Text style={s.muted}>{agencyDetails.business_type}</Text>
                  </View>
                </View>
                <DetailRow
                  icon="map-pin"
                  label={t('dashboard.address')}
                  value={agencyDetails.office_address}
                />
                <DetailRow
                  icon="navigation"
                  label={t('coverageRequest.serviceArea')}
                  value={[
                    agencyDetails.city,
                    agencyDetails.district,
                    agencyDetails.state,
                    agencyDetails.pincode,
                  ]
                    .filter(Boolean)
                    .join(', ')}
                />
                {agencyDetails.gst_number ? (
                  <DetailRow
                    icon="file-text"
                    label={t('dashboard.gstNumber')}
                    value={agencyDetails.gst_number}
                  />
                ) : null}
                <View style={s.modalActions}>
                  <ScalePressable
                    style={s.cancelButton}
                    onPress={() => setAgencyDetailsOpen(false)}
                  >
                    <Text style={s.cancelText}>{t('superAdmin.cancel')}</Text>
                  </ScalePressable>
                  <ScalePressable
                    style={s.confirmButton}
                    onPress={() => {
                      setSelectedAgencyId(agencyDetails.id);
                      clearFieldError('agency');
                      setAgencyDetailsOpen(false);
                    }}
                  >
                    <Text style={s.confirmText}>
                      {t('coverageRequest.selectThisAgency')}
                    </Text>
                  </ScalePressable>
                </View>
              </>
            ) : null}
          </View>
        </View>
      </Modal>
      <Modal
        visible={picker !== null}
        transparent
        animationType="fade"
        onRequestClose={closePicker}
      >
        <View style={s.overlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={closePicker} />
          <View style={s.picker}>
            <Text style={s.pickerTitle}>
              {picker ? t(`dashboard.${picker}`) : ''}
            </Text>
            <View style={s.search}>
              <Feather
                name="search"
                size={scaleFont(19)}
                color={colors.textGray}
              />
              <TextInput
                style={s.searchInput}
                value={query}
                onChangeText={setQuery}
                placeholder={t('addGuardForm.search')}
                placeholderTextColor={colors.textGray}
              />
            </View>
            <ScrollView
              style={s.options}
              keyboardShouldPersistTaps="handled"
              nestedScrollEnabled
            >
              {locationsLoading ? (
                <ActivityIndicator color={colors.primary} />
              ) : (
                filteredOptions.map(option => (
                  <ScalePressable
                    key={option.slug}
                    style={s.option}
                    onPress={() => select(option)}
                  >
                    <Text style={s.optionText}>{option.name}</Text>
                  </ScalePressable>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function DetailRow({
  icon,
  label,
  value,
}: {
  icon: React.ComponentProps<typeof Feather>['name'];
  label: string;
  value: string;
}) {
  return (
    <View style={s.detailRow}>
      <Feather name={icon} size={scaleFont(19)} color={colors.textGray} />
      <View style={s.agencyDetails}>
        <Text style={s.detailLabel}>{label}</Text>
        <Text style={s.detailValue}>{value}</Text>
      </View>
    </View>
  );
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  multiline,
  required,
  error,
  inputRef,
  onBlur,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  multiline?: boolean;
  required?: boolean;
  error?: string;
  inputRef?: React.Ref<React.ComponentRef<typeof TextInput>>;
  onBlur?: () => void;
}) {
  return (
    <View style={s.field}>
      <Text style={s.label}>
        {label}
        {required ? <Text style={s.required}> *</Text> : null}
      </Text>
      <TextInput
        ref={inputRef}
        style={[s.input, multiline && s.notes, error ? s.inputError : null]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textGray}
        multiline={multiline}
        textAlignVertical={multiline ? 'top' : 'center'}
        maxLength={multiline ? 500 : 160}
        onBlur={onBlur}
      />
      {error ? (
        <Text accessibilityRole="alert" style={s.error}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}
function Dropdown({
  label,
  value,
  open,
  disabled,
  onPress,
  required,
  error,
}: {
  label: string;
  value: string;
  open: boolean;
  disabled?: boolean;
  onPress: () => void;
  required?: boolean;
  error?: string;
}) {
  return (
    <View style={s.field}>
      <Text style={s.label}>
        {label}
        {required ? <Text style={s.required}> *</Text> : null}
      </Text>
      <ScalePressable
        style={[
          s.input,
          s.dropdown,
          disabled && s.disabled,
          error ? s.inputError : null,
        ]}
        disabled={disabled}
        onPress={onPress}
        accessibilityState={{ disabled, expanded: open }}
      >
        <Text style={[s.inputText, !value && s.placeholder]}>
          {value || '—'}
        </Text>
        <Feather
          name={open ? 'chevron-up' : 'chevron-down'}
          size={scaleFont(20)}
          color={colors.primary}
        />
      </ScalePressable>
      {error ? (
        <Text accessibilityRole="alert" style={s.error}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  container: { gap: spacing.md },
  card: {
    paddingVertical: spacing.sm,
    gap: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  sectionTitle: {
    color: colors.primary,
    fontSize: scaleFont(typography.sizes.lg),
    fontWeight: typography.weights.bold,
    borderLeftWidth: spacing.xs,
    borderLeftColor: colors.gold,
    paddingLeft: spacing.sm,
  },
  field: { gap: spacing.sm },
  label: {
    color: colors.primary,
    fontSize: scaleFont(typography.sizes.md),
    fontWeight: typography.weights.medium,
  },
  input: {
    minHeight: 50,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: spacing.sm,
    paddingHorizontal: spacing.md,
    color: colors.primary,
    fontSize: scaleFont(typography.sizes.md),
  },
  dropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  inputText: {
    color: colors.primary,
    fontSize: scaleFont(typography.sizes.md),
  },
  placeholder: { color: colors.textGray },
  disabled: {
    backgroundColor: colors.light.background,
    borderColor: colors.border,
  },
  notes: { minHeight: 130, paddingTop: spacing.md },
  checkpointRow: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: spacing.sm,
    backgroundColor: colors.white,
  },
  checkpointSeq: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.light.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  checkpointSeqText: {
    color: colors.primary,
    fontSize: scaleFont(typography.sizes.xs),
    fontWeight: typography.weights.semiBold,
  },
  checkpointName: {
    flex: 1,
    color: colors.primary,
    fontSize: scaleFont(typography.sizes.md),
  },
  checkpointRemove: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkpointAddRow: { flexDirection: 'row', gap: spacing.sm },
  checkpointInput: { flex: 1 },
  checkpointAdd: {
    width: 50,
    minHeight: 50,
    borderRadius: spacing.sm,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  requestCheckpoints: { marginTop: spacing.xs, gap: spacing.xs },
  requestCheckpointToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  requestCheckpointTitle: {
    flex: 1,
    color: colors.primary,
    fontSize: scaleFont(typography.sizes.sm),
    fontWeight: typography.weights.semiBold,
  },
  requestCheckpointList: { gap: spacing.xs, paddingLeft: spacing.sm },
  requestCheckpointRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  requestCheckpointSeq: {
    width: 22,
    height: 22,
    borderRadius: 11,
    textAlign: 'center',
    textAlignVertical: 'center',
    backgroundColor: colors.light.background,
    color: colors.primary,
    fontSize: scaleFont(typography.sizes.xs),
    fontWeight: typography.weights.semiBold,
    overflow: 'hidden',
  },
  requestCheckpointName: {
    flex: 1,
    color: colors.primary,
    fontSize: scaleFont(typography.sizes.sm),
  },
  agenciesSection: { gap: spacing.sm },
  agencyCard: {
    minHeight: 64,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: spacing.sm,
    padding: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  selectedAgencyCard: {
    borderColor: colors.status.success,
  },
  agencyIcon: {
    width: 42,
    height: 42,
    borderRadius: spacing.sm,
    backgroundColor: colors.light.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  agencyDetails: { flex: 1, gap: spacing.xs },
  agencyName: {
    color: colors.primary,
    fontSize: scaleFont(typography.sizes.md),
    fontWeight: typography.weights.semiBold,
  },
  availableBadge: {
    borderWidth: 1,
    borderColor: colors.status.success,
    borderRadius: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  availableText: {
    color: colors.status.success,
    fontSize: scaleFont(typography.sizes.xs),
    fontWeight: typography.weights.semiBold,
  },
  counter: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  counterButton: {
    width: 48,
    height: 48,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  count: {
    minWidth: 32,
    textAlign: 'center',
    color: colors.primary,
    fontSize: scaleFont(typography.sizes.lg),
    fontWeight: typography.weights.semiBold,
  },
  error: {
    color: colors.status.danger,
    fontSize: scaleFont(typography.sizes.sm),
  },
  required: {
    color: colors.status.danger,
  },
  inputError: {
    borderColor: colors.status.danger,
  },
  submit: {
    minHeight: 50,
    borderRadius: spacing.sm,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitText: {
    color: colors.white,
    fontSize: scaleFont(typography.sizes.lg),
    fontWeight: typography.weights.bold,
  },
  muted: { color: colors.textGray, fontSize: scaleFont(typography.sizes.sm) },
  request: {
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  requestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  requestTitle: {
    flex: 1,
    color: colors.primary,
    fontSize: scaleFont(typography.sizes.md),
    fontWeight: typography.weights.semiBold,
  },
  badge: {
    color: colors.status.review,
    borderWidth: 1,
    borderColor: colors.status.review,
    borderRadius: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    fontSize: scaleFont(typography.sizes.xs),
    fontWeight: typography.weights.semiBold,
    textTransform: 'uppercase',
  },
  overlay: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing.lg,
    backgroundColor: 'rgba(11,31,58,0.56)',
  },
  picker: {
    backgroundColor: colors.white,
    borderRadius: spacing.md,
    padding: spacing.md,
    gap: spacing.sm,
  },
  agencyModal: {
    backgroundColor: colors.white,
    borderRadius: spacing.md,
    padding: spacing.md,
    gap: spacing.md,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: spacing.lg,
    backgroundColor: colors.light.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailsLoading: {
    minHeight: 160,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  detailsHero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingBottom: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  detailsName: {
    color: colors.primary,
    fontSize: scaleFont(typography.sizes.lg),
    fontWeight: typography.weights.bold,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  detailLabel: {
    color: colors.textGray,
    fontSize: scaleFont(typography.sizes.xs),
  },
  detailValue: {
    color: colors.primary,
    fontSize: scaleFont(typography.sizes.sm),
    fontWeight: typography.weights.medium,
  },
  modalActions: { flexDirection: 'row', gap: spacing.sm },
  cancelButton: {
    flex: 1,
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: {
    color: colors.primary,
    fontSize: scaleFont(typography.sizes.sm),
    fontWeight: typography.weights.semiBold,
  },
  confirmButton: {
    flex: 2,
    minHeight: 48,
    borderRadius: spacing.sm,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  confirmText: {
    color: colors.white,
    fontSize: scaleFont(typography.sizes.sm),
    fontWeight: typography.weights.bold,
  },
  pickerTitle: {
    color: colors.primary,
    fontSize: scaleFont(typography.sizes.lg),
    fontWeight: typography.weights.bold,
  },
  search: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: spacing.sm,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  searchInput: {
    flex: 1,
    color: colors.primary,
    fontSize: scaleFont(typography.sizes.md),
  },
  options: { height: 48 * 4 },
  option: {
    height: 48,
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  optionText: {
    color: colors.primary,
    fontSize: scaleFont(typography.sizes.md),
  },
});
