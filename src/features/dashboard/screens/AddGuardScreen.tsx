import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Dimensions,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
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
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Feather from 'react-native-vector-icons/Feather';
import { useTranslation } from 'react-i18next';
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
import type { MainStackParamList } from '../../../navigation/types';

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

/** Gap between the input and its floating site picker overlay. */
const SITE_MENU_GAP = 8;
/**
 * Height reserved for the picker header + clear button so only the options
 * list is sized against the available screen space.
 */
const SITE_PICKER_CHROME = spacing.xxxl * 2;

type Props = {
  navigation: NativeStackNavigationProp<
    MainStackParamList,
    'AddGuardScreen'
  >;
};

export default function AddGuardScreen({ navigation }: Props) {
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
  const [saving, setSaving] = useState(false);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const today = new Date();
  const [dateParts, setDateParts] = useState({
    year: today.getFullYear(),
    month: today.getMonth() + 1,
    day: today.getDate(),
  });

  const YEAR_OPTIONS = Array.from(
    { length: 61 },
    (_, i) => today.getFullYear() - 50 + i,
  );
  const MONTH_OPTIONS = Array.from({ length: 12 }, (_, i) => i + 1);
  const daysInMonth = (year: number, month: number) =>
    new Date(year, month, 0).getDate();
  const shortMonthName = (month: number) =>
    new Date(today.getFullYear(), month - 1, 1).toLocaleDateString('en-US', {
      month: 'short',
    });
  const updateDatePart = (part: 'year' | 'month' | 'day', value: number) =>
    setDateParts(current => {
      const next = { ...current, [part]: value };
      const maxDay = daysInMonth(next.year, next.month);
      if (next.day > maxDay) next.day = maxDay;
      return next;
    });

  const submitting = useRef(false);
  const submit = async () => {
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
      await agencyApiService.createGuard(payload);
      navigation.navigate('AgencyGuards');
      Alert.alert(label('title'), label('success'));
    } catch (err) {
      setError(assignmentErrorMessage(err, t));
    } finally {
      submitting.current = false;
      setSaving(false);
    }
  };

  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [picker, setPicker] = useState<'site' | 'time' | null>(null);
  const [query, setQuery] = useState('');
  const [endTime, setEndTime] = useState(`${String(
    (Number(startTime.split(':')[0]) + hours) % 24,
  ).padStart(2, '0')}:${startTime.split(':')[1]}`);

  // Recalculate end time when start time or shift hours change
  useEffect(() => {
    setEndTime(`${String(
      (Number(startTime.split(':')[0]) + hours) % 24,
    ).padStart(2, '0')}:${startTime.split(':')[1]}`);
  }, [startTime, hours]);

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
        if (!value) return label('requiredError');
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
      const value = key === 'gender' ? gender : form[key as keyof typeof emptyForm];
      const err = validateField(key, value);
      if (err) {
        nextErrors[key] = err;
        hasError = true;
      } else {
        delete nextErrors[key];
      }
    }
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

  const selectSite = (siteIdValue: number | null) => {
    setSiteId(siteIdValue);
    setPicker(null);
  };

  /**
   * Toggles the Initial Site Assignment picker as a floating overlay anchored
   * to the input. The previous handler always forced `picker` to 'site', so
   * the arrow could never close the list and the inline expansion kept
   * reflowing the form under the user's finger.
   */
  const toggleSitePicker = () => {
    if (picker === 'site') {
      setPicker(null);
      return;
    }
    Keyboard.dismiss();
    requestAnimationFrame(() => {
      const node = siteAnchorRef.current;
      if (!node) {
        setSiteAnchor(null);
        setPicker('site');
        return;
      }
      node.measureInWindow((x, y, width, height) => {
        setSiteAnchor({ x, y, width, height });
        setPicker('site');
      });
    });
  };

  const handleSiteOverlayLayout = (event: LayoutChangeEvent) => {
    const next = event.nativeEvent.layout.height;
    setSiteOverlayH(current => (current === next ? current : next));
  };

  // Load sites on mount
  useEffect(() => {
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
    // Occupancy data powers the capacity display in the site picker.
    agencyApiService
      .getGuards()
      .then(data => {
        if (active) setGuards(data);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

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
      await agencyApiService.createGuard(payload);
      navigation.navigate('AgencyGuards');
      Alert.alert(label('title'), label('success'));
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
            setForm(current => ({
              ...current,
              [key]:
                numeric
                  ? value.replace(/\D/g, '')
                  : key === 'joiningDate'
                  ? value.replace(/[^0-9-]/g, '')
                  : ['basicSalary', 'allowances'].includes(key)
                  ? value.replace(/[^0-9.]/g, '')
                  : value,
            }));
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

  const siteOptions: PickerOption[] = [
    ...sites.map(site => {
      const assigned = occupancyBySite.get(site.id) ?? 0;
      const capacity = site.guard_capacity ?? null;
      const full = capacity != null && assigned >= capacity;
      return {
        id: String(site.id),
        name: site.site_name,
        note: full ? t('addGuardForm.siteFull') : undefined,
        disabled: full,
      };
    }),
  ];

  // Positioning: anchor the floating picker to the input, flipping it above
  // the input when there is not enough room below, and cap only the option
  // list so the form behind never moves.
  const siteDesiredCard = spacing.xxxl * 4 + SITE_PICKER_CHROME;
  const siteRoomBelow = siteAnchor
    ? siteOverlayH - (siteAnchor.y + siteAnchor.height) - insets.bottom - SITE_MENU_GAP
    : 0;
  const siteRoomAbove = siteAnchor
    ? siteAnchor.y - insets.top - SITE_MENU_GAP
    : 0;
  const sitePickerOpensUp =
    siteAnchor !== null &&
    siteRoomBelow < siteDesiredCard &&
    siteRoomAbove > siteRoomBelow;
  const siteRoom = sitePickerOpensUp ? siteRoomAbove : siteRoomBelow;
  const siteCardMax = siteAnchor
    ? Math.max(siteRoom, 0)
    : spacing.xxxl * 5;
  const siteListMax = siteAnchor
    ? Math.max(
        Math.min(spacing.xxxl * 4, siteRoom - SITE_PICKER_CHROME),
        spacing.xxxl,
      )
    : spacing.xxxl * 4;
  const siteCardStyle: ViewStyle = siteAnchor
    ? {
        position: 'absolute',
        left: siteAnchor.x,
        width: siteAnchor.width,
        maxHeight: siteCardMax,
        ...(sitePickerOpensUp
          ? { bottom: siteOverlayH - siteAnchor.y + SITE_MENU_GAP }
          : { top: siteAnchor.y + siteAnchor.height + SITE_MENU_GAP }),
      }
    : { width: '86%', maxHeight: spacing.xxxl * 5 };
  const siteListStyle: ViewStyle = { maxHeight: siteListMax };

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      <StatusBar barStyle="dark-content" />
      <View style={s.header}>
        <Pressable
          style={s.iconButton}
          onPress={() => navigation.goBack()}
          accessibilityLabel={t('dashboard.back')}
        >
          <Feather
            name="chevron-left"
            size={scaleFont(24)}
            color={colors.primary}
          />
        </Pressable>
        <Text style={s.title}>{label('title')}</Text>
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
            <Text style={s.label}>{label('fullName')} *</Text>
            <TextInput
              accessibilityLabel={label('fullName')}
              style={s.input}
              editable={!saving}
              value={form.fullName}
              onChangeText={value => {
                setForm(current => ({ ...current, fullName: value }));
                if (fieldErrors.fullName) clearFieldError('fullName');
              }}
              maxLength={255}
              autoCorrect={false}
            />
            {fieldErrors.fullName && (
              <Text style={s.error}>{fieldErrors.fullName}</Text>
            )}
          </View>
          <View style={s.field}>
            <Text style={s.label}>{label('mobileNumber')} *</Text>
            <TextInput
              accessibilityLabel={label('mobileNumber')}
              style={s.input}
              editable={!saving}
              value={form.mobileNumber}
              onChangeText={value => {
                setForm(current => ({
                  ...current,
                  mobileNumber: value.replace(/\D/g, ''),
                }));
                if (fieldErrors.mobileNumber)
                  clearFieldError('mobileNumber');
              }}
              maxLength={10}
              keyboardType="number-pad"
              autoCorrect={false}
              placeholder="+91 9876543210"
              placeholderTextColor={colors.textGray}
            />
            {fieldErrors.mobileNumber && (
              <Text style={s.error}>{fieldErrors.mobileNumber}</Text>
            )}
          </View>
          <View style={s.field}>
            <Text style={s.label}>{label('email')} *</Text>
            <TextInput
              accessibilityLabel={label('email')}
              style={s.input}
              editable={!saving}
              value={form.email}
              onChangeText={value => {
                setForm(current => ({ ...current, email: value }));
                if (fieldErrors.email) clearFieldError('email');
              }}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              maxLength={255}
            />
            {fieldErrors.email && (
              <Text style={s.error}>{fieldErrors.email}</Text>
            )}
          </View>
          <View style={s.field}>
            <Text style={s.label}>{label('password')} *</Text>
            <View style={s.inputWithAction}>
              <TextInput
                accessibilityLabel={label('password')}
                style={s.embeddedInput}
                editable={!saving}
                value={form.password}
                onChangeText={value => {
                  setForm(current => ({ ...current, password: value }));
                  if (fieldErrors.password) clearFieldError('password');
                }}
                maxLength={72}
                autoCapitalize="none"
                secureTextEntry={!passwordVisible}
                autoCorrect={false}
              />
              <Pressable
                style={s.trailingAction}
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
              </Pressable>
            </View>
            {fieldErrors.password && (
              <Text style={s.error}>{fieldErrors.password}</Text>
            )}
            <Text style={s.passwordHelper}>{label('passwordHelper')}</Text>
          </View>
          <View style={s.field}>
            <Text style={s.label}>{label('joiningDate')} *</Text>
            <ScalePressable
              style={s.select}
              disabled={saving}
              onPress={() => {
                const values = form.joiningDate.split('-').map(Number);
                const parsed =
                  values.length === 3 && values.every(Number.isFinite)
                    ? { year: values[0], month: values[1], day: values[2] }
                    : {
                        year: today.getFullYear(),
                        month: today.getMonth() + 1,
                        day: today.getDate(),
                      };
                setDateParts(parsed);
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
            {fieldErrors.joiningDate && (
              <Text style={s.error}>{fieldErrors.joiningDate}</Text>
            )}
          </View>
          <View style={s.field}>
            <Text style={s.label}>{label('address')} *</Text>
            <TextInput
              accessibilityLabel={label('address')}
              style={s.input}
              editable={!saving}
              value={form.address}
              onChangeText={value => {
                setForm(current => ({ ...current, address: value }));
                if (fieldErrors.address) clearFieldError('address');
              }}
              maxLength={255}
              autoCorrect={false}
            />
            {fieldErrors.address && (
              <Text style={s.error}>{fieldErrors.address}</Text>
            )}
          </View>
          <View style={s.field}>
            <Text style={s.label}>{label('age')}</Text>
            <TextInput
              accessibilityLabel={label('age')}
              style={s.input}
              editable={!saving}
              value={form.age}
              onChangeText={value => {
                setForm(current => ({
                  ...current,
                  age: value.replace(/\D/g, ''),
                }));
                if (fieldErrors.age) clearFieldError('age');
              }}
              maxLength={2}
              keyboardType="number-pad"
              autoCorrect={false}
            />
            {fieldErrors.age && <Text style={s.error}>{fieldErrors.age}</Text>}
          </View>
          <Text style={s.label}>{label('gender')} *</Text>
          {choices(['male', 'female', 'other'], gender, setGender, label)}
          {fieldErrors.gender && <Text style={s.error}>{fieldErrors.gender}</Text>}
          <Text style={s.label}>{label('site')}</Text>
          <View ref={siteAnchorRef}>
            <ScalePressable
              style={s.select}
              disabled={saving || sitesLoading || siteError || !sites.length}
              onPress={() => {
                setQuery('');
                toggleSitePicker();
              }}
              accessibilityRole="button"
              accessibilityState={{ expanded: picker === 'site' }}
              accessibilityLabel={label('site')}
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
          </View>
          {siteError ? (
            <Text style={s.error}>{label('requiredError')}</Text>
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
                  <View style={s.timeControl}>
                    <View style={s.timeLeft}>
                      <Feather
                        name="clock"
                        size={scaleFont(20)}
                        color={colors.primary}
                      />
                      <Text style={s.timeValue}>{displayTime(startTime)}</Text>
                    </View>
                    <View style={s.timeArrows}>
                      <ScalePressable
                        style={s.timeArrow}
                        disabled={saving}
                        hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
                        onPress={() => setStartTime(prevTime(startTime))}
                        accessibilityLabel="Decrease start time by 30 minutes"
                      >
                        <Text style={s.timeArrowText}>▲</Text>
                      </ScalePressable>
                      <ScalePressable
                        style={s.timeArrow}
                        disabled={saving}
                        hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
                        onPress={() => setStartTime(nextTime(startTime))}
                        accessibilityLabel="Increase start time by 30 minutes"
                      >
                        <Text style={s.timeArrowText}>▼</Text>
                      </ScalePressable>
                    </View>
                  </View>
                </View>
                <View style={s.column}>
                  <Text style={s.label}>{label('endTime')} *</Text>
                  <View style={s.timeControl}>
                    <View style={s.timeLeft}>
                      <Feather
                        name="clock"
                        size={scaleFont(20)}
                        color={colors.primary}
                      />
                      <Text style={s.timeValue}>{displayTime(endTime)}</Text>
                    </View>
                    <View style={s.timeArrows}>
                      <ScalePressable
                        style={s.timeArrow}
                        disabled={saving}
                        hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
                        onPress={() => setEndTime(prevTime(endTime))}
                        accessibilityLabel="Decrease end time by 30 minutes"
                      >
                        <Text style={s.timeArrowText}>▲</Text>
                      </ScalePressable>
                      <ScalePressable
                        style={s.timeArrow}
                        disabled={saving}
                        hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
                        onPress={() => setEndTime(nextTime(endTime))}
                        accessibilityLabel="Increase end time by 30 minutes"
                      >
                        <Text style={s.timeArrowText}>▼</Text>
                      </ScalePressable>
                    </View>
                  </View>
                </View>
              </View>
              <Text style={s.hint}>{label('endHint')}</Text>
            </>
          ) : (
            <Text style={s.hint}>{label('coverageHint')}</Text>
          )}
          <View style={s.field}>
            <Text style={s.label}>{label('basicSalary')} *</Text>
            <TextInput
              accessibilityLabel={label('basicSalary')}
              style={s.input}
              editable={!saving}
              value={form.basicSalary}
              onChangeText={value => {
                setForm(current => ({
                  ...current,
                  basicSalary: value.replace(/[^0-9.]/g, ''),
                }));
                if (fieldErrors.basicSalary)
                  clearFieldError('basicSalary');
              }}
              keyboardType="decimal-pad"
              maxLength={255}
            />
            {fieldErrors.basicSalary && (
              <Text style={s.error}>{fieldErrors.basicSalary}</Text>
            )}
          </View>
          <View style={s.field}>
            <Text style={s.label}>{label('allowances')}</Text>
            <TextInput
              accessibilityLabel={label('allowances')}
              style={s.input}
              editable={!saving}
              value={form.allowances}
              onChangeText={value => {
                setForm(current => ({
                  ...current,
                  allowances: value.replace(/[^0-9.]/g, ''),
                }));
                if (fieldErrors.allowances)
                  clearFieldError('allowances');
              }}
              keyboardType="decimal-pad"
              maxLength={255}
            />
            {fieldErrors.allowances && (
              <Text style={s.error}>{fieldErrors.allowances}</Text>
            )}
          </View>
          {error ? (
            <Text accessibilityRole="alert" style={s.error}>
              {error}
            </Text>
          ) : null}
          <ScalePressable
            style={[
              s.submit,
              saving && { opacity: 0.7 },
            ]}
            disabled={saving}
            onPress={save}
            accessibilityRole="button"
          >
            <Text style={s.submitText}>
              {saving ? t('dashboard.saving') : t('dashboard.addGuard')}
            </Text>
          </ScalePressable>
        </ScrollView>
      </KeyboardAvoidingView>
      {calendarOpen && (
        <Modal
          transparent
          visible={calendarOpen}
          onRequestClose={() => setCalendarOpen(false)}
        >
          <View style={s.modalOverlay}>
            <View style={s.modalSheet}>
              <View style={s.modalHeader}>
                <Text style={s.modalHeaderText}>{t('dashboard.selectJoiningDate')}</Text>
                <Pressable
                  style={s.modalClose}
                  onPress={() => setCalendarOpen(false)}
                  accessibilityLabel={t('dashboard.back')}
                >
                  <Feather name="chevron-left" size={scaleFont(20)} color={colors.primary} />
                </Pressable>
              </View>
              <View style={s.pickerBody}>
                <View style={s.dateColumn}>
                  <Text style={s.dateColumnLabel}>{t('dashboard.year')}</Text>
                  <ScrollView
                    showsVerticalScrollIndicator={false}
                    style={s.dateList}
                    contentContainerStyle={s.dateListContent}
                  >
                    {YEAR_OPTIONS.map(year => (
                      <ScalePressable
                        key={year}
                        style={[
                          s.dateOption,
                          dateParts.year === year && s.dateOptionSelected,
                        ]}
                        onPress={() => updateDatePart('year', year)}
                      >
                        <Text
                          style={[
                            s.dateOptionText,
                            dateParts.year === year &&
                              s.dateOptionTextSelected,
                          ]}
                        >
                          {year}
                        </Text>
                      </ScalePressable>
                    ))}
                  </ScrollView>
                </View>
                <View style={s.dateColumn}>
                  <Text style={s.dateColumnLabel}>{t('dashboard.month')}</Text>
                  <ScrollView
                    showsVerticalScrollIndicator={false}
                    style={s.dateList}
                    contentContainerStyle={s.dateListContent}
                  >
                    {MONTH_OPTIONS.map(month => (
                      <ScalePressable
                        key={month}
                        style={[
                          s.dateOption,
                          dateParts.month === month && s.dateOptionSelected,
                        ]}
                        onPress={() => updateDatePart('month', month)}
                      >
                        <Text
                          style={[
                            s.dateOptionText,
                            dateParts.month === month &&
                              s.dateOptionTextSelected,
                          ]}
                        >
                          {shortMonthName(month)}
                        </Text>
                      </ScalePressable>
                    ))}
                  </ScrollView>
                </View>
                <View style={s.dateColumn}>
                  <Text style={s.dateColumnLabel}>{t('dashboard.date')}</Text>
                  <ScrollView
                    showsVerticalScrollIndicator={false}
                    style={s.dateList}
                    contentContainerStyle={s.dateListContent}
                  >
                    {Array.from(
                      {
                        length: daysInMonth(dateParts.year, dateParts.month),
                      },
                      (_, i) => i + 1,
                    ).map(day => (
                      <ScalePressable
                        key={day}
                        style={[
                          s.dateOption,
                          dateParts.day === day && s.dateOptionSelected,
                        ]}
                        onPress={() => updateDatePart('day', day)}
                      >
                        <Text
                          style={[
                            s.dateOptionText,
                            dateParts.day === day && s.dateOptionTextSelected,
                          ]}
                        >
                          {day}
                        </Text>
                      </ScalePressable>
                    ))}
                  </ScrollView>
                </View>
              </View>
              <View style={s.modalActions}>
                <ScalePressable
                  style={s.modalActionCancel}
                  onPress={() => setCalendarOpen(false)}
                >
                  <Text style={s.modalActionText}>{t('dashboard.cancel')}</Text>
                </ScalePressable>
                <ScalePressable
                  style={s.modalActionSave}
                  onPress={() => {
                    const dateString = `${String(dateParts.year).padStart(4, '0')}-${String(
                      dateParts.month,
                    ).padStart(2, '0')}-${String(dateParts.day).padStart(2, '0')}`;
                    setForm(current => ({ ...current, joiningDate: dateString }));
                    setCalendarOpen(false);
                  }}
                >
                  <Text style={s.modalActionSaveText}>{t('dashboard.done')}</Text>
                </ScalePressable>
              </View>
            </View>
          </View>
        </Modal>
      )}
      {/* Initial Site Assignment floats above the form so it never shifts. */}
      <Modal
        transparent
        visible={picker === 'site'}
        animationType="fade"
        onRequestClose={() => setPicker(null)}
      >
        <View style={s.siteOverlay} onLayout={handleSiteOverlayLayout}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setPicker(null)}
            accessibilityLabel={t('dashboard.close')}
          />
          <View style={[s.sitePicker, siteCardStyle]}>
            <Text style={s.sitePickerHeader}>
              {t('dashboard.selectInitialSite')}
            </Text>
            <ScrollView
              style={siteListStyle}
              showsVerticalScrollIndicator={false}
              nestedScrollEnabled
              keyboardShouldPersistTaps="handled"
            >
              {siteOptions.map(option => (
                <ScalePressable
                  key={option.id}
                  style={[
                    s.sitePickerOption,
                    option.disabled && s.sitePickerOptionDisabled,
                    siteId === Number(option.id) && s.sitePickerOptionSelected,
                  ]}
                  disabled={option.disabled || saving}
                  onPress={() =>
                    selectSite(option.disabled ? null : Number(option.id))
                  }
                >
                  <Text style={s.sitePickerOptionText}>{option.name}</Text>
                  {option.note ? (
                    <Text style={s.sitePickerOptionNote}>{option.note}</Text>
                  ) : null}
                  {siteId === Number(option.id) ? (
                    <Feather
                      name="check"
                      size={scaleFont(18)}
                      color={colors.primary}
                    />
                  ) : null}
                </ScalePressable>
              ))}
              {!sites.length && !sitesLoading && !siteError ? (
                <Text style={s.sitePickerEmpty}>{t('dashboard.noSites')}</Text>
              ) : null}
            </ScrollView>
            <ScalePressable
              style={s.sitePickerClear}
              onPress={() => selectSite(null)}
            >
              <Text style={s.sitePickerClearText}>{t('dashboard.cancel')}</Text>
            </ScalePressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.white },
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
  keyboard: { flex: 1 },
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
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  timeControl: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: spacing.xxl,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: spacing.sm,
    paddingHorizontal: spacing.sm,
  },
  timeLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  timeArrows: {
    flexDirection: 'column',
    justifyContent: 'space-between',
    alignSelf: 'stretch',
  },
  timeArrow: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  timeArrowText: {
    fontSize: scaleFont(typography.sizes.md),
    color: colors.primary,
  },
  timeValue: {
    fontSize: scaleFont(typography.sizes.md),
    color: colors.primary,
    fontWeight: typography.weights.medium,
    flexShrink: 1,
  },
  submit: {
    width: '100%',
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
  siteOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(11,31,58,0.45)',
  },
  sitePicker: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: spacing.sm,
    overflow: 'hidden',
    elevation: 10,
  },
  sitePickerHeader: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    fontSize: scaleFont(typography.sizes.sm),
    fontWeight: typography.weights.medium,
    color: colors.textGray,
  },
  sitePickerOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  sitePickerOptionDisabled: {
    opacity: 0.5,
  },
  sitePickerOptionSelected: {
    backgroundColor: '#E2F5E9',
  },
  sitePickerOptionText: {
    color: colors.primary,
    fontSize: scaleFont(typography.sizes.sm),
    flex: 1,
  },
  sitePickerOptionNote: {
    color: colors.textGray,
    fontSize: scaleFont(typography.sizes.xs),
    marginTop: spacing.xs,
  },
  sitePickerEmpty: {
    padding: spacing.md,
    color: colors.textGray,
    fontSize: scaleFont(typography.sizes.sm),
    textAlign: 'center',
  },
  sitePickerClear: {
    padding: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  sitePickerClearText: {
    color: colors.status.danger,
    fontSize: scaleFont(typography.sizes.sm),
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalSheet: {
    backgroundColor: colors.white,
    borderRadius: spacing.sm,
    width: '85%',
    maxHeight: '75%',
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  modalHeaderText: {
    fontSize: scaleFont(typography.sizes.md),
    fontWeight: typography.weights.bold,
    color: colors.primary,
  },
  modalClose: {
    padding: spacing.xs,
  },
  pickerBody: {
    flexDirection: 'row',
    padding: spacing.md,
    maxHeight: spacing.xxxl * 7,
  },
  dateColumn: {
    flex: 1,
    alignItems: 'center',
  },
  dateColumnLabel: {
    fontSize: scaleFont(typography.sizes.sm),
    fontWeight: typography.weights.medium,
    color: colors.textGray,
    marginBottom: spacing.xs,
  },
  dateList: {
    height: spacing.xxxl * 5,
    width: '100%',
  },
  dateListContent: {
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  dateOption: {
    minWidth: spacing.xxxl,
    minHeight: spacing.xxl,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xs,
    borderRadius: spacing.sm,
  },
  dateOptionSelected: {
    backgroundColor: colors.primary,
  },
  dateOptionText: {
    color: colors.primary,
    fontSize: scaleFont(typography.sizes.sm),
  },
  dateOptionTextSelected: {
    color: colors.white,
    fontWeight: typography.weights.bold,
  },
  modalActions: {
    flexDirection: 'row',
    padding: spacing.md,
    gap: spacing.sm,
  },
  modalActionCancel: {
    flex: 1,
    minHeight: spacing.xxxl,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalActionSave: {
    flex: 1,
    minHeight: spacing.xxxl,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: spacing.sm,
  },
  modalActionText: {
    fontSize: scaleFont(typography.sizes.sm),
    color: colors.primary,
  },
  modalActionSaveText: {
    fontSize: scaleFont(typography.sizes.sm),
    fontWeight: typography.weights.bold,
    color: colors.white,
  },
});