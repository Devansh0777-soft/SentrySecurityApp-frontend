import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Feather from 'react-native-vector-icons/Feather';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import ScalePressable from '../../../components/common/ScalePressable';
import {
  agencyApiService,
  type AgencyGuard,
  type AgencySite,
} from '../../../services/agencyApiService';
import { assignmentErrorMessage } from '../../../utils/assignmentErrors';
import { colors } from '../../../styles/colors';
import { spacing } from '../../../styles/spacing';
import { typography } from '../../../styles/typography';
import { scaleFont } from '../../../styles/dimensions';

type Plan = 'day_shift' | 'night_watch' | '24x7';
const emptyForm = {
  fullName: '',
  mobileNumber: '',
  email: '',
  password: '',
  joiningDate: '',
  basicSalary: '',
  allowances: '',
  address: '',
  age: '',
};
const times = Array.from(
  { length: 48 },
  (_, i) =>
    `${String(Math.floor(i / 2)).padStart(2, '0')}:${i % 2 ? '30' : '00'}`,
);
const displayTime = (value: string) => {
  const [hour, minute] = value.split(':').map(Number);
  return `${hour % 12 || 12}:${String(minute).padStart(2, '0')} ${
    hour < 12 ? 'AM' : 'PM'
  }`;
};

// Time navigation: move up/down by exactly 30 minutes, wrapping at midnight
const timeIndex = (value: string) => times.indexOf(value);
const nextTime = (value: string) => {
  const idx = timeIndex(value);
  return times[(idx + 1) % times.length];
};
const prevTime = (value: string) => {
  const idx = timeIndex(value);
  return times[(idx - 1 + times.length) % times.length];
};

type PickerOption = {
  id: string;
  name: string;
  note?: string;
  disabled?: boolean;
};

export default function AddGuardModal({
  visible,
  onClose,
  onCreated,
  guard = null,
}: {
  visible: boolean;
  onClose: () => void;
  onCreated: () => void;
  guard?: AgencyGuard | null;
}) {
  const { t, i18n } = useTranslation();
  const label = (key: string) => {
    const value = t(`addGuardForm.${key}`);
    return ['address', 'gender', 'basicSalary'].includes(key)
      ? value.replace(/\s*\([^)]*\)$/, '')
      : value;
  };
  const [form, setForm] = useState(emptyForm);
  const [plan, setPlan] = useState<Plan>('day_shift');
  const [hours, setHours] = useState<8 | 12>(8);
  const [startTime, setStartTime] = useState('08:00');
  const [gender, setGender] = useState('');
  const [siteId, setSiteId] = useState<number | null>(null);
  const [sites, setSites] = useState<AgencySite[]>([]);
  const [guards, setGuards] = useState<AgencyGuard[]>([]);
  const [siteError, setSiteError] = useState(false);
  const [sitesLoading, setSitesLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const today = new Date();
  const [dateParts, setDateParts] = useState({
    year: today.getFullYear(),
    month: today.getMonth() + 1,
    day: today.getDate(),
  });
  const submitting = useRef(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [picker, setPicker] = useState<'site' | 'time' | null>(null);
  const [query, setQuery] = useState('');
  const endTime = `${String(
    (Number(startTime.split(':')[0]) + hours) % 24,
  ).padStart(2, '0')}:${startTime.split(':')[1]}`;

  // ---- Field-level validation ----
  const validateField = (key: string, value: string): string => {
    switch (key) {
      case 'fullName':
        if (!value.trim()) return label('requiredError');
        return '';
      case 'mobileNumber':
        if (!value) return label('requiredError');
        if (!/^[6-9]\d{9}$/.test(value))
          return 'Enter a valid 10-digit Indian mobile number.';
        return '';
      case 'email':
        if (!value.trim()) return label('requiredError');
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()))
          return 'Enter a valid email address.';
        return '';
      case 'password':
        if (!guard && !value) return label('requiredError');
        if (value && !/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/.test(value)) {
          return label('passwordError');
        }
        return '';
      case 'joiningDate':
        if (!value) return label('requiredError');
        if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return label('dateError');
        const date = new Date(`${value}T00:00:00Z`);
        if (
          Number.isNaN(date.getTime()) ||
          date.toISOString().slice(0, 10) !== value
        ) {
          return label('dateError');
        }
        return '';
      case 'address':
        if (!value.trim()) return label('requiredError');
        return '';
      case 'gender':
        if (!value) return label('requiredError');
        return '';
      case 'basicSalary':
        if (!value) return label('requiredError');
        if (
          !/^\d+(\.\d{1,2})?$/.test(value) ||
          Number(value) <= 0 ||
          Number(value) > 99999999.99
        ) {
          return label('salaryError');
        }
        return '';
      case 'allowances':
        if (value && !/^\d+(\.\d{1,2})?$/.test(value)) {
          return label('salaryError');
        }
        return '';
      case 'age':
        if (
          value &&
          (!/^\d+$/.test(value) ||
            Number(value) < 18 ||
            Number(value) > 65)
        ) {
          return label('ageError');
        }
        return '';
      default:
        return '';
    }
  };

  const validateAllFields = (): boolean => {
    const nextErrors: Record<string, string> = {};
    const requiredFields: string[] = [
      'fullName',
      'mobileNumber',
      'email',
      'password',
      'joiningDate',
      'address',
      'gender',
      'basicSalary',
    ];
    let hasError = false;
    for (const key of requiredFields) {
      // gender is not in emptyForm, handle it separately
      const value = key === 'gender' ? gender : form[key as keyof typeof emptyForm];
      const err = validateField(key, value);
      if (err) {
        nextErrors[key] = err;
        hasError = true;
      }
    }
    // Site is now optional - no validation error for missing siteId
    setFieldErrors(nextErrors);
    return !hasError;
  };

  const clearFieldError = (key: string) => {
    setFieldErrors(prev => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  useEffect(() => {
    if (!visible) return;
    setForm(
      guard
        ? {
            fullName: guard.full_name || '',
            mobileNumber: (guard.mobile_number || '')
              .replace(/\D/g, '')
              .slice(-10),
            email: guard.email || '',
            password: '',
            joiningDate: guard.joining_date?.slice(0, 10) || '',
            basicSalary:
              guard.basic_salary == null ? '' : String(guard.basic_salary),
            allowances:
              guard.allowances == null ? '' : String(guard.allowances),
            address: guard.address || '',
            age: guard.age == null ? '' : String(guard.age),
          }
        : emptyForm,
    );
    setPlan(guard?.coverage_plan || 'day_shift');
    setHours(guard?.shift_hours === 12 ? 12 : 8);
    setStartTime(
      guard?.start_time?.slice(0, 5) ||
        (guard?.coverage_plan === 'night_watch' ? '20:00' : '08:00'),
    );
    setGender(guard?.gender || '');
    setSiteId(guard?.site_id || null);
    setPicker(null);
    setQuery('');
    setError('');
    setPasswordVisible(false);
    setCalendarOpen(false);
    let active = true;
    setSitesLoading(true);
    setSiteError(false);
    setSites([]);
    agencyApiService
      .getSites()
      .then(data => {
        if (active) setSites(data);
      })
      .catch(() => {
        if (active) setSiteError(true);
      })
      .finally(() => {
        if (active) setSitesLoading(false);
      });
    // Occupancy data powers the capacity display in the site picker. A
    // failure here only hides the counts - the backend still enforces limits.
    agencyApiService
      .getGuards()
      .then(data => {
        if (active) setGuards(data);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [guard, visible]);
  const close = () => {
    if (!submitting.current) onClose();
  };
  const change = (key: keyof typeof emptyForm, value: string) =>
    setForm(current => ({ ...current, [key]: value }));
  const save = async () => {
    if (submitting.current) return;
    if (!validateAllFields()) {
      setError(label('requiredError'));
      return;
    }
    setError('');
    submitting.current = true;
    setSaving(true);
    try {
      const payload = {
        fullName: form.fullName.trim(),
        mobileNumber: `+91${form.mobileNumber}`,
        email: form.email.trim().toLowerCase(),
        password: form.password,
        joiningDate: form.joiningDate,
        siteId,
        coveragePlan: plan,
        shiftHours: plan === '24x7' ? null : hours,
        startTime: plan === '24x7' ? null : startTime,
        endTime: plan === '24x7' ? null : endTime,
        basicSalary: form.basicSalary ? Number(form.basicSalary) : null,
        allowances: form.allowances ? Number(form.allowances) : 0,
        address: form.address.trim(),
        age: form.age ? Number(form.age) : null,
        gender,
      };
      if (guard) await agencyApiService.updateGuard(guard.id, payload);
      else await agencyApiService.createGuard(payload);
      onCreated();
      onClose();
      Alert.alert(
        guard ? t('dashboard.editGuard') : label('title'),
        guard ? t('dashboard.guardUpdated') : label('success'),
      );
    } catch (err) {
      setError(assignmentErrorMessage(err, t));
    } finally {
      submitting.current = false;
      setSaving(false);
    }
  };
  const field = (
    key: keyof typeof emptyForm,
    required = false,
    numeric = false,
  ) => {
    const fieldError = fieldErrors[key];
    const handleBlur = () => {
      const err = validateField(key, form[key]);
      if (err) {
        setFieldErrors(prev => ({ ...prev, [key]: err }));
      } else {
        clearFieldError(key);
      }
    };
    return (
      <View style={s.field}>
        <Text style={s.label}>
          {label(key)}
          {required ? ' *' : ''}
        </Text>
        <TextInput
          accessibilityLabel={label(key)}
          style={s.input}
          editable={!saving}
          value={form[key]}
          onChangeText={value => {
            change(
              key,
              numeric
                ? value.replace(/\D/g, '')
                : key === 'joiningDate'
                ? value.replace(/[^0-9-]/g, '')
                : ['basicSalary', 'allowances'].includes(key)
                ? value.replace(/[^0-9.]/g, '')
                : value,
            );
            // Clear error as user types
            if (fieldErrors[key]) clearFieldError(key);
          }}
          onBlur={handleBlur}
          maxLength={
            key === 'mobileNumber'
              ? 10
              : key === 'age'
              ? 2
              : key === 'joiningDate'
              ? 10
              : key === 'password'
              ? 72
              : 255
          }
          keyboardType={
            numeric
              ? 'number-pad'
              : key === 'email'
              ? 'email-address'
              : ['basicSalary', 'allowances'].includes(key)
              ? 'decimal-pad'
              : 'default'
          }
          autoCapitalize={
            key === 'email' || key === 'password' ? 'none' : 'sentences'
          }
          secureTextEntry={key === 'password'}
          autoCorrect={false}
          placeholder={
            key === 'joiningDate'
              ? 'YYYY-MM-DD'
              : key === 'mobileNumber'
              ? '+91 9876543210'
              : undefined
          }
          placeholderTextColor={colors.textGray}
        />
        {fieldError && <Text style={s.error}>{fieldError}</Text>}
      </View>
    );
  };
  const choices = <T extends string | number>(
    values: readonly T[],
    selected: T,
    choose: (value: T) => void,
    text: (value: T) => string,
  ) => (
    <View style={s.row}>
      {values.map(value => (
        <ScalePressable
          key={value}
          disabled={saving}
          style={[s.choice, selected === value && s.selected]}
          onPress={() => choose(value)}
          accessibilityRole="radio"
          accessibilityState={{ checked: selected === value }}
        >
          <Text style={[s.choiceText, selected === value && s.white]}>
            {text(value)}
          </Text>
        </ScalePressable>
      ))}
    </View>
  );
  const occupancyBySite = new Map<number, number>();
  for (const item of guards) {
    if (item.site_id != null) {
      occupancyBySite.set(
        item.site_id,
        (occupancyBySite.get(item.site_id) ?? 0) + 1,
      );
    }
  }
  // Site picker rules: an assigned guard can only leave through the explicit
  // "Unassigned" option first (no silent moves), and full sites are disabled
  // with their x/y usage shown. Capacity comes from the linked coverage
  // request (guard_capacity); null means unlimited.
  const siteOptions: PickerOption[] = [
    ...(guard?.site_id
      ? [{ id: '', name: t('addGuardForm.unassigned') }]
      : []),
    ...sites.map(site => {
      const isCurrent = guard?.site_id === site.id;
      const assignedElsewhere = guard?.site_id != null && !isCurrent;
      const assigned = occupancyBySite.get(site.id) ?? 0;
      const capacity = site.guard_capacity ?? null;
      const full = capacity != null && assigned >= capacity && !isCurrent;
      const usage =
        capacity != null
          ? t('addGuardForm.siteUsage', { assigned, total: capacity })
          : undefined;
      return {
        id: String(site.id),
        name: site.site_name,
        note: assignedElsewhere
          ? t('addGuardForm.endAssignmentFirst')
          : full
            ? `${usage} · ${t('addGuardForm.siteFull')}`
            : usage,
        disabled: assignedElsewhere || full,
      };
    }),
  ];
  const options: PickerOption[] =
    picker === 'site'
      ? siteOptions
      : times.map(time => ({ id: time, name: displayTime(time) }));
  const visibleOptions = options.filter(option =>
    option.name.toLowerCase().includes(query.trim().toLowerCase()),
  );
  const years = Array.from(
    { length: 52 },
    (_, index) => today.getFullYear() + 1 - index,
  );
  const months = Array.from({ length: 12 }, (_, index) => index + 1);
  const days = Array.from(
    { length: new Date(dateParts.year, dateParts.month, 0).getDate() },
    (_, index) => index + 1,
  );
  const updateDatePart = (part: 'year' | 'month' | 'day', value: number) =>
    setDateParts(current => {
      const next = { ...current, [part]: value };
      return {
        ...next,
        day: Math.min(next.day, new Date(next.year, next.month, 0).getDate()),
      };
    });
  const confirmDate = () => {
    change(
      'joiningDate',
      `${dateParts.year}-${String(dateParts.month).padStart(2, '0')}-${String(
        dateParts.day,
      ).padStart(2, '0')}`,
    );
    setCalendarOpen(false);
  };
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={close}
    >
      <SafeAreaView style={s.overlay}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={s.keyboard}
        >
          <View style={s.sheet}>
            <View style={s.header}>
              <Text style={s.title}>
                {guard ? t('dashboard.editGuard') : label('title')}
              </Text>
              <ScalePressable
                style={s.iconButton}
                disabled={saving}
                onPress={close}
                accessibilityLabel={label('close')}
              >
                <Feather name="x" size={scaleFont(24)} color={colors.primary} />
              </ScalePressable>
            </View>
            <ScrollView
              contentContainerStyle={s.content}
              keyboardShouldPersistTaps="handled"
            >
              <Text style={s.hint}>{label('requiredHint')}</Text>
              {field('fullName', true)}
              {field('mobileNumber', true, true)}
              {field('email', true)}
              <View style={s.field}>
                <Text style={s.label}>
                  {guard ? t('dashboard.newGuardPassword') : label('password')}
                  {guard ? '' : ' *'}
                </Text>
                <View style={s.inputWithAction}>
                  <TextInput
                    accessibilityLabel={label('password')}
                    style={s.embeddedInput}
                    editable={!saving}
                    value={form.password}
                    onChangeText={value => change('password', value)}
                    maxLength={72}
                    autoCapitalize="none"
                    secureTextEntry={!passwordVisible}
                    autoCorrect={false}
                    placeholder={
                      guard ? t('dashboard.leavePasswordBlank') : undefined
                    }
                    placeholderTextColor={colors.textGray}
                  />
                  <ScalePressable
                    style={s.trailingAction}
                    disabled={saving}
                    onPress={() => setPasswordVisible(current => !current)}
                    accessibilityLabel={
                      passwordVisible
                        ? t('dashboard.hidePassword')
                        : t('dashboard.showPassword')
                    }
                  >
                    <Feather
                      name={passwordVisible ? 'eye-off' : 'eye'}
                      size={scaleFont(20)}
                      color={colors.primary}
                    />
                  </ScalePressable>
                </View>
              </View>
              {!guard && (
                <Text style={s.passwordHelper}>{label('passwordHelper')}</Text>
              )}
              <View style={s.field}>
                <Text style={s.label}>{label('joiningDate')} *</Text>
                <ScalePressable
                  style={s.select}
                  disabled={saving}
                  onPress={() => {
                    const values = form.joiningDate.split('-').map(Number);
                    const selected =
                      values.length === 3 && values.every(Number.isFinite)
                        ? { year: values[0], month: values[1], day: values[2] }
                        : {
                            year: today.getFullYear(),
                            month: today.getMonth() + 1,
                            day: today.getDate(),
                          };
                    setDateParts(selected);
                    setCalendarOpen(true);
                  }}
                  accessibilityLabel={t('dashboard.selectJoiningDate')}
                >
                  <Text style={[s.body, !form.joiningDate && s.placeholder]}>
                    {form.joiningDate || t('dashboard.selectJoiningDate')}
                  </Text>
                  <Feather
                    name="calendar"
                    size={scaleFont(20)}
                    color={colors.primary}
                  />
                </ScalePressable>
              </View>
              {field('address', true)}
              {field('age', false, true)}
              <Text style={s.label}>{label('gender')} *</Text>
              {choices(['male', 'female', 'other'], gender, setGender, label)}
              <Text style={s.label}>{label('site')}</Text>
              <ScalePressable
                style={s.select}
                disabled={saving || sitesLoading || siteError || !sites.length}
                onPress={() => {
                  setPicker('site');
                  setQuery('');
                }}
              >
                <Text style={[s.body, !siteId && s.placeholder]}>
                  {sitesLoading
                    ? label('loadingSites')
                    : sites.find(site => site.id === siteId)?.site_name ||
                      t('dashboard.selectInitialSite')}
                </Text>
                <Feather
                  name={picker === 'site' ? 'chevron-up' : 'chevron-down'}
                  size={scaleFont(20)}
                  color={colors.primary}
                />
              </ScalePressable>
              {siteError ? (
                <Text style={s.error}>{label('requiredError')}</Text>
              ) : null}
              {guard?.site_id != null ? (
                <Text style={s.hint}>
                  {t('addGuardForm.assignedElsewhereHint')}
                </Text>
              ) : null}
              <Text style={s.label}>{label('coveragePlan')} *</Text>
              {choices<Plan>(
                ['day_shift', 'night_watch', '24x7'],
                plan,
                value => {
                  setPlan(value);
                  setStartTime(value === 'night_watch' ? '20:00' : '08:00');
                },
                label,
              )}
              {plan !== '24x7' ? (
                <>
                  <Text style={s.label}>{label('shiftHours')} *</Text>
                  {choices<8 | 12>(
                    [8, 12],
                    hours,
                    setHours,
                    value => `${value} ${label('hours')}`,
                  )}
                  <View style={s.row}>
                    <View style={s.column}>
                      <Text style={s.label}>{label('startTime')} *</Text>
                      <ScalePressable
                        style={s.select}
                        disabled={saving}
                        onPress={() => {
                          setPicker('time');
                          setQuery('');
                        }}
                      >
                        <Text style={s.body}>{displayTime(startTime)}</Text>
                        <Feather
                          name="clock"
                          size={scaleFont(20)}
                          color={colors.primary}
                        />
                      </ScalePressable>
                    </View>
                    <View style={s.column}>
                      <Text style={s.label}>{label('endTime')} *</Text>
                      <View style={s.select}>
                        <Text style={s.body}>{displayTime(endTime)}</Text>
                      </View>
                    </View>
                  </View>
                  <Text style={s.hint}>{label('endHint')}</Text>
                </>
              ) : (
                <Text style={s.hint}>{label('coverageHint')}</Text>
              )}
              {field('basicSalary', true)}
              {field('allowances')}
              {error ? (
                <Text accessibilityRole="alert" style={s.error}>
                  {error}
                </Text>
              ) : null}
              {guard ? (
                <ScalePressable
                  style={s.remove}
                  disabled={saving}
                  onPress={() =>
                    Alert.alert(
                      t('dashboard.removeGuard'),
                      t('dashboard.removeGuardConfirmation'),
                      [
                        { text: t('dashboard.cancel'), style: 'cancel' },
                        {
                          text: t('dashboard.removeGuard'),
                          style: 'destructive',
                          onPress: async () => {
                            setSaving(true);
                            try {
                              await agencyApiService.removeGuard(guard.id);
                              onCreated();
                              onClose();
                            } catch (err) {
                              setError(
                                err instanceof Error
                                  ? err.message
                                  : label('failure'),
                              );
                            } finally {
                              setSaving(false);
                            }
                          },
                        },
                      ],
                    )
                  }
                  accessibilityRole="button"
                >
                  <Text style={s.removeText}>{t('dashboard.removeGuard')}</Text>
                </ScalePressable>
              ) : null}
              <ScalePressable
                style={s.submit}
                disabled={saving}
                onPress={() => {
                  save();
                }}
                accessibilityRole="button"
              >
                <Text style={s.submitText}>
                  {saving
                    ? label('saving')
                    : guard
                    ? t('dashboard.saveChanges')
                    : label('title')}
                </Text>
              </ScalePressable>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
      <Modal
        visible={picker !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setPicker(null)}
      >
        <SafeAreaView style={s.overlay}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setPicker(null)}
            accessibilityLabel={label('close')}
          />
          <View style={s.picker}>
            <TextInput
              accessibilityLabel={label('search')}
              style={s.input}
              value={query}
              onChangeText={setQuery}
              placeholder={label('search')}
              placeholderTextColor={colors.textGray}
            />
            {picker === 'time' ? (
              <View style={s.timePicker}>
                <ScalePressable
                  style={s.timeArrow}
                  disabled={saving}
                  hitSlop={{ top: 2, bottom: 2, left: 2, right: 2 }}
                  onPress={() => setStartTime(nextTime(startTime))}
                  accessibilityLabel="Increase time by 30 minutes"
                >
                  <Text style={s.timeArrowText}>▲</Text>
                </ScalePressable>
                <Text style={s.timeValue}>{displayTime(startTime)}</Text>
                <ScalePressable
                  style={s.timeArrow}
                  disabled={saving}
                  hitSlop={{ top: 2, bottom: 2, left: 2, right: 2 }}
                  onPress={() => setStartTime(prevTime(startTime))}
                  accessibilityLabel="Decrease time by 30 minutes"
                >
                  <Text style={s.timeArrowText}>▼</Text>
                </ScalePressable>
              </View>
            ) : (
              <ScrollView style={s.options} keyboardShouldPersistTaps="handled">
                {visibleOptions.map(option => (
                  <ScalePressable
                    key={option.id}
                    style={[s.option, option.disabled && s.optionDisabled]}
                    disabled={option.disabled}
                    onPress={() => {
                      if (picker === 'site')
                        setSiteId(option.id ? Number(option.id) : null);
                      else setStartTime(option.id);
                      setPicker(null);
                    }}
                  >
                    <Text style={s.body}>{option.name}</Text>
                    {option.note ? (
                      <Text style={s.optionNote}>{option.note}</Text>
                    ) : null}
                  </ScalePressable>
                ))}
                {!visibleOptions.length ? (
                  <Text style={s.hint}>{label('noResults')}</Text>
                ) : null}
              </ScrollView>
            )}
          </View>
        </SafeAreaView>
      </Modal>
      <Modal
        visible={calendarOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setCalendarOpen(false)}
      >
        <SafeAreaView style={s.overlay}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setCalendarOpen(false)}
            accessibilityLabel={label('close')}
          />
          <View style={s.calendar}>
            <Text style={s.calendarTitle}>
              {t('dashboard.selectJoiningDate')}
            </Text>
            <Text style={s.datePreview}>{`${dateParts.year}-${String(
              dateParts.month,
            ).padStart(2, '0')}-${String(dateParts.day).padStart(
              2,
              '0',
            )}`}</Text>
            <View style={s.dateColumns}>
              {[
                {
                  key: 'year' as const,
                  label: t('dashboard.year'),
                  values: years,
                  text: (value: number) => String(value),
                },
                {
                  key: 'month' as const,
                  label: t('dashboard.month'),
                  values: months,
                  text: (value: number) =>
                    new Date(2000, value - 1, 1).toLocaleDateString(
                      i18n.language,
                      { month: 'short' },
                    ),
                },
                {
                  key: 'day' as const,
                  label: t('dashboard.date'),
                  values: days,
                  text: (value: number) => String(value),
                },
              ].map(column => (
                <View key={column.key} style={s.dateColumn}>
                  <Text style={s.dateColumnLabel}>{column.label}</Text>
                  <ScrollView
                    style={s.dateList}
                    nestedScrollEnabled
                    showsVerticalScrollIndicator
                    keyboardShouldPersistTaps="handled"
                  >
                    {column.values.map(value => (
                      <ScalePressable
                        key={value}
                        style={[
                          s.dateOption,
                          dateParts[column.key] === value && s.selected,
                        ]}
                        onPress={() => updateDatePart(column.key, value)}
                        accessibilityRole="radio"
                        accessibilityState={{
                          checked: dateParts[column.key] === value,
                        }}
                      >
                        <Text
                          style={[
                            s.dateOptionText,
                            dateParts[column.key] === value && s.white,
                          ]}
                        >
                          {column.text(value)}
                        </Text>
                      </ScalePressable>
                    ))}
                  </ScrollView>
                </View>
              ))}
            </View>
            <ScalePressable
              style={s.submit}
              onPress={confirmDate}
              accessibilityRole="button"
            >
              <Text style={s.submitText}>{t('dashboard.done')}</Text>
            </ScalePressable>
          </View>
        </SafeAreaView>
      </Modal>
    </Modal>
  );
}
const s = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing.md,
    backgroundColor: 'rgba(11,31,58,0.56)',
  },
  keyboard: { maxHeight: '100%' },
  sheet: {
    maxHeight: '100%',
    borderRadius: spacing.md,
    backgroundColor: colors.white,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  title: {
    color: colors.primary,
    fontSize: scaleFont(typography.sizes.xl),
    fontWeight: typography.weights.bold,
  },
  iconButton: {
    minWidth: spacing.xxxl,
    minHeight: spacing.xxxl,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: { padding: spacing.md, gap: spacing.md },
  field: { gap: spacing.sm },
  label: {
    color: colors.primary,
    fontSize: scaleFont(typography.sizes.sm),
    fontWeight: typography.weights.medium,
  },
  input: {
    minHeight: spacing.xxxl,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: spacing.sm,
    paddingHorizontal: spacing.md,
    color: colors.primary,
    fontSize: scaleFont(typography.sizes.md),
  },
  inputWithAction: {
    minHeight: spacing.xxxl,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: spacing.sm,
    paddingLeft: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
  },
  embeddedInput: {
    flex: 1,
    minHeight: spacing.xxxl,
    paddingVertical: 0,
    color: colors.primary,
    fontSize: scaleFont(typography.sizes.md),
  },
  trailingAction: {
    width: spacing.xxxl,
    height: spacing.xxxl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    color: colors.primary,
    fontSize: scaleFont(typography.sizes.sm),
    flexShrink: 1,
  },
  select: {
    minHeight: spacing.xxxl,
    paddingHorizontal: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  row: { flexDirection: 'row', gap: spacing.sm },
  column: { flex: 1, gap: spacing.sm },
  choice: {
    flex: 1,
    minHeight: spacing.xxxl,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: spacing.sm,
    justifyContent: 'center',
    padding: spacing.sm,
  },
  selected: { backgroundColor: colors.primary, borderColor: colors.primary },
  choiceText: {
    color: colors.primary,
    fontSize: scaleFont(typography.sizes.sm),
    textAlign: 'center',
    fontWeight: typography.weights.medium,
  },
  white: { color: colors.white },
  placeholder: { color: colors.textGray },
  hint: { color: colors.textGray, fontSize: scaleFont(typography.sizes.sm) },
  passwordHelper: {
    color: colors.textGray,
    fontSize: scaleFont(typography.sizes.sm),
    marginTop: spacing.xs,
  },
  error: {
    color: colors.status.danger,
    fontSize: scaleFont(typography.sizes.sm),
  },
  submit: {
    minHeight: spacing.xxxl,
    borderRadius: spacing.sm,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  submitText: {
    color: colors.white,
    fontSize: scaleFont(typography.sizes.lg),
    fontWeight: typography.weights.bold,
  },
  remove: {
    minHeight: spacing.xxxl,
    borderRadius: spacing.sm,
    borderWidth: 1,
    borderColor: colors.status.danger,
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeText: {
    color: colors.status.danger,
    fontSize: scaleFont(typography.sizes.md),
    fontWeight: typography.weights.semiBold,
  },
  picker: {
    backgroundColor: colors.white,
    borderRadius: spacing.md,
    padding: spacing.md,
    gap: spacing.sm,
  },
  options: { maxHeight: spacing.xxxl * 4 },
  option: {
    minHeight: spacing.xxxl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
  },
  optionDisabled: { opacity: 0.5 },
  optionNote: {
    color: colors.textGray,
    fontSize: scaleFont(typography.sizes.xs),
    flexShrink: 1,
    textAlign: 'right',
  },
  calendar: {
    backgroundColor: colors.white,
    borderRadius: spacing.md,
    padding: spacing.md,
    gap: spacing.sm,
  },
  calendarTitle: {
    color: colors.primary,
    fontSize: scaleFont(typography.sizes.lg),
    fontWeight: typography.weights.bold,
  },
  datePreview: {
    color: colors.textGray,
    fontSize: scaleFont(typography.sizes.sm),
    textAlign: 'center',
  },
  dateColumns: { flexDirection: 'row', gap: spacing.sm },
  dateColumn: { flex: 1, gap: spacing.xs },
  dateColumnLabel: {
    color: colors.primary,
    fontSize: scaleFont(typography.sizes.sm),
    fontWeight: typography.weights.semiBold,
    textAlign: 'center',
  },
  dateList: {
    height: spacing.xxxl * 4,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: spacing.sm,
  },
  dateOption: {
    height: spacing.xxxl,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xs,
  },
  dateOptionText: {
    color: colors.primary,
    fontSize: scaleFont(typography.sizes.sm),
    fontWeight: typography.weights.medium,
    textAlign: 'center',
  },
  timePicker: {
    flexDirection: 'column',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
  timeArrow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: spacing.xxl,
    height: spacing.xxl,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: spacing.sm / 2,
    backgroundColor: colors.white,
  },
  timeArrowText: {
    fontSize: scaleFont(typography.sizes.md),
    color: colors.primary,
  },
  timeValue: {
    fontSize: scaleFont(typography.sizes.md),
    fontWeight: typography.weights.medium,
    color: colors.primary,
    flexShrink: 1,
  },
});
