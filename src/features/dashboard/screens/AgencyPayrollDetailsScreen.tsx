import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import Feather from 'react-native-vector-icons/Feather';
import { useTranslation } from 'react-i18next';

import type { MainStackParamList } from '../../../navigation/types';
import { ApiError } from '../../../services/apiClient';
import {
  payrollService,
  formatINR,
  type PayrollDetails,
  type PayrollStatus,
  type SalaryAdvance,
} from '../../../services/payrollService';
import { colors } from '../../../styles/colors';
import { typography } from '../../../styles/typography';
import {
  scaleFont as f,
  scaleHeight as h,
  scaleWidth as w,
} from '../../../styles/dimensions';
import ScalePressable from '../../../components/common/ScalePressable';
import { appAlert } from '../../../services/alertService';

type Props = NativeStackScreenProps<MainStackParamList, 'AgencyPayrollDetails'>;

const AMBER = '#B9640A';
const SUCCESS = colors.status.success;
const PAID_GREEN = '#1E9E5A';
const MAX_AMOUNT = 99999999.99;

/** Accept only non-negative monetary input; blank stays empty for editing. */
const sanitizeMoney = (value: string): string =>
  value.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1');

const parseMoney = (value: string): number => {
  if (value.trim() === '') return 0;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : NaN;
};

const round2 = (n: number): number => Math.round(n * 100) / 100;

const monthLabel = (period: string, locale: string): string => {
  const [year, month] = period.split('-').map(Number);
  return new Date(year, (month || 1) - 1, 1).toLocaleDateString(locale, {
    month: 'long',
    year: 'numeric',
  });
};

const statusMeta = (status: PayrollStatus, labels: Record<string, string>) => {
  if (status === 'paid') return { color: PAID_GREEN, label: labels.paid };
  if (status === 'verified')
    return { color: colors.status.info, label: labels.verified };
  return { color: AMBER, label: labels.pending };
};

const AgencyPayrollDetailsScreen: React.FC<Props> = ({ navigation, route }) => {
  const { t, i18n } = useTranslation();
  const { guardId, period } = route.params;

  const [details, setDetails] = useState<PayrollDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  // Editable salary components (strings so partial input is preserved).
  const [basic, setBasic] = useState('');
  const [overtime, setOvertime] = useState('');
  const [allowances, setAllowances] = useState('');
  const [deductions, setDeductions] = useState('');

  // Advances.
  const [advanceAmount, setAdvanceAmount] = useState('');
  const [advanceReason, setAdvanceReason] = useState('');
  const [advances, setAdvances] = useState<SalaryAdvance[]>([]);

  // Busy + feedback.
  const [saving, setSaving] = useState(false);
  const [paying, setPaying] = useState(false);
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const applyDetails = useCallback((data: PayrollDetails) => {
    setDetails(data);
    setAdvances(data.advances);
    const source = data.record ?? data.defaults;
    setBasic(source.basic_salary ? String(source.basic_salary) : '');
    setOvertime(source.overtime ? String(source.overtime) : '');
    setAllowances(source.allowances ? String(source.allowances) : '');
    setDeductions(source.deductions ? String(source.deductions) : '');
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setLoadError('');
      const data = await payrollService.getDetails(guardId, period);
      applyDetails(data);
    } catch (loadErr) {
      setLoadError(
        loadErr instanceof Error ? loadErr.message : t('payroll.loadFailed'),
      );
    } finally {
      setLoading(false);
    }
  }, [guardId, period, t, applyDetails]);

  useEffect(() => {
    load();
  }, [load]);

  const status: PayrollStatus = details?.record?.status ?? 'pending';
  const paid = status === 'paid';
  const statusLabels = {
    pending: t('payroll.statusPending'),
    verified: t('payroll.statusVerified'),
    paid: t('payroll.statusPaid'),
  };
  const meta = statusMeta(status, statusLabels);

  /** Live net-salary preview — mirrors the backend rule exactly. */
  const netPreview = useMemo(() => {
    const b = parseMoney(basic);
    const o = parseMoney(overtime);
    const a = parseMoney(allowances);
    const d = parseMoney(deductions);
    if ([b, o, a, d].some(v => Number.isNaN(v))) return NaN;
    const recovery = details?.outstanding_advance?.outstanding ?? 0;
    return Math.max(0, round2(b + o + a - d - recovery));
  }, [basic, overtime, allowances, deductions, details]);

  const advanceRecovery = details?.outstanding_advance?.outstanding ?? 0;
  const outstandingAdvances = useMemo(
    () => advances.filter(a => a.outstanding > 0),
    [advances],
  );

  const clearFeedback = () => {
    if (error) setError('');
    if (success) setSuccess('');
  };

  /** Save Salary — persists components; never marks paid. */
  const onSave = async () => {
    if (saving || paying) return;
    clearFeedback();

    const b = parseMoney(basic);
    const o = parseMoney(overtime);
    const a = parseMoney(allowances);
    const d = parseMoney(deductions);
    if ([b, o, a, d].some(v => Number.isNaN(v) || v > MAX_AMOUNT)) {
      setError(t('payroll.invalidAmount'));
      return;
    }
    if (details && !details.salary_configured && b <= 0) {
      setError(t('payroll.basicSalaryRequired'));
      return;
    }

    setSaving(true);
    try {
      await payrollService.saveSalary(guardId, {
        period,
        basic_salary: b,
        overtime: o,
        allowances: a,
        deductions: d,
      });
      // Refresh with the persisted, server-calculated record.
      const fresh = await payrollService.getDetails(guardId, period);
      applyDetails(fresh);
      setSuccess(t('payroll.saved'));
    } catch (saveErr) {
      setError(
        saveErr instanceof ApiError && saveErr.code === 'PAYROLL_ALREADY_PAID'
          ? t('payroll.alreadyPaid')
          : saveErr instanceof Error
          ? saveErr.message
          : t('payroll.saveFailed'),
      );
    } finally {
      setSaving(false);
    }
  };

  /** Mark as Paid — confirmation dialog, then a transaction-safe server call. */
  const onMarkPaid = () => {
    if (paying || saving || paid) return;
    clearFeedback();
    const name = details?.guard.full_name ?? '';
    const amount = Number.isNaN(netPreview) ? 0 : netPreview;
    const monthText = monthLabel(period, i18n.language);
    appAlert.alert(
      t('payroll.confirmPayTitle'),
      t('payroll.confirmPayMessage', {
        name,
        amount: formatINR(amount),
        period: monthText,
      }),
      [
        { text: t('payroll.cancel'), style: 'cancel' },
        { text: t('payroll.confirm'), onPress: confirmPay },
      ],
      { type: 'warning' },
    );
  };

  const confirmPay = async () => {
    setPaying(true);
    clearFeedback();
    try {
      await payrollService.markPaid(guardId, period);
      const fresh = await payrollService.getDetails(guardId, period);
      applyDetails(fresh);
      setSuccess(t('payroll.paid'));
    } catch (payErr) {
      if (
        payErr instanceof ApiError &&
        payErr.code === 'PAYROLL_ALREADY_PAID'
      ) {
        // Reconcile against the persisted state before reporting failure.
        const fresh = await payrollService.getDetails(guardId, period);
        applyDetails(fresh);
        setSuccess(t('payroll.alreadyPaid'));
      } else {
        setError(
          payErr instanceof Error ? payErr.message : t('payroll.payFailed'),
        );
      }
    } finally {
      setPaying(false);
    }
  };

  /** Record Advance — validates, submits, refreshes history + balance. */
  const onRecordAdvance = async () => {
    if (recording) return;
    clearFeedback();
    const value = parseMoney(advanceAmount);
    if (Number.isNaN(value) || value <= 0) {
      setError(t('payroll.advanceInvalid'));
      return;
    }
    setRecording(true);
    try {
      await payrollService.recordAdvance(guardId, {
        amount: value,
        reason: advanceReason.trim() || undefined,
      });
      setAdvanceAmount('');
      setAdvanceReason('');
      const fresh = await payrollService.getDetails(guardId, period);
      applyDetails(fresh);
      setSuccess(t('payroll.advanceRecorded'));
    } catch (advErr) {
      // Preserve the user's input on failure.
      setError(
        advErr instanceof Error ? advErr.message : t('payroll.advanceFailed'),
      );
    } finally {
      setRecording(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
        <StatusBar barStyle="dark-content" />
        <Header
          title={t('payroll.detailsTitle')}
          onBack={() => navigation.goBack()}
        />
        <View style={s.center}>
          <ActivityIndicator color={colors.primary} size="large" />
          <Text style={s.stateText}>{t('payroll.loading')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (loadError && !details) {
    return (
      <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
        <StatusBar barStyle="dark-content" />
        <Header
          title={t('payroll.detailsTitle')}
          onBack={() => navigation.goBack()}
        />
        <View style={s.center}>
          <View style={s.errorIcon}>
            <Feather
              name="alert-circle"
              size={f(28)}
              color={colors.status.danger}
            />
          </View>
          <Text style={s.errorText}>{loadError}</Text>
          <ScalePressable
            style={s.retry}
            onPress={load}
            accessibilityRole="button"
          >
            <Text style={s.retryText}>{t('payroll.retry')}</Text>
          </ScalePressable>
        </View>
      </SafeAreaView>
    );
  }

  const guardName = details?.guard.full_name ?? '';
  const netValue = Number.isNaN(netPreview) ? 0 : netPreview;

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      <StatusBar barStyle="dark-content" />
      <Header
        title={t('payroll.detailsTitle')}
        onBack={() => navigation.goBack()}
      />

      <KeyboardAvoidingView
        style={s.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={s.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={s.guardCard}>
            <View style={s.guardAvatar}>
              <Feather name="user" size={f(22)} color={colors.primary} />
            </View>
            <View style={s.guardCopy}>
              <Text style={s.guardName} numberOfLines={1}>
                {guardName}
              </Text>
              {details?.guard.site_name ? (
                <Text style={s.guardMeta} numberOfLines={1}>
                  {details.guard.site_name}
                </Text>
              ) : null}
              <Text style={s.guardMeta}>
                {monthLabel(period, i18n.language)}
              </Text>
            </View>
            <View
              style={[
                s.statusBadge,
                { borderColor: meta.color, backgroundColor: `${meta.color}14` },
              ]}
            >
              <Text style={[s.statusBadgeText, { color: meta.color }]}>
                {meta.label}
              </Text>
            </View>
          </View>

          {error ? (
            <View style={s.alertError}>
              <Feather
                name="alert-circle"
                size={f(16)}
                color={colors.status.danger}
              />
              <Text style={s.alertErrorText}>{error}</Text>
            </View>
          ) : null}
          {success ? (
            <View style={s.alertSuccess}>
              <Feather name="check-circle" size={f(16)} color={SUCCESS} />
              <Text style={s.alertSuccessText}>{success}</Text>
            </View>
          ) : null}

          <View style={s.formCard}>
            <MoneyField
              label={t('payroll.basicSalary')}
              value={basic}
              editable={!paid}
              placeholder={t('payroll.basicSalaryPlaceholder')}
              onChange={v => {
                clearFeedback();
                setBasic(sanitizeMoney(v));
              }}
            />
            <View style={s.overtimeHeader}>
              <Text style={s.label}>{t('payroll.overtime')}</Text>
              <View style={s.autoBadge}>
                <Feather name="trending-up" size={f(13)} color={SUCCESS} />
                <Text style={s.autoText}>{t('payroll.autoCalculate')}</Text>
              </View>
            </View>
            <MoneyField
              value={overtime}
              editable={!paid}
              placeholder={t('payroll.overtimePlaceholder')}
              onChange={v => {
                clearFeedback();
                setOvertime(sanitizeMoney(v));
              }}
            />
            <Text style={s.hint}>{t('payroll.overtimeHint')}</Text>

            <MoneyField
              label={t('payroll.allowances')}
              value={allowances}
              editable={!paid}
              placeholder={t('payroll.allowancesPlaceholder')}
              onChange={v => {
                clearFeedback();
                setAllowances(sanitizeMoney(v));
              }}
            />
            <MoneyField
              label={t('payroll.deductions')}
              value={deductions}
              editable={!paid}
              placeholder={t('payroll.deductionsPlaceholder')}
              onChange={v => {
                clearFeedback();
                setDeductions(sanitizeMoney(v));
              }}
            />
          </View>

          <Text style={s.section}>{t('payroll.salaryAdvances')}</Text>
          <View style={s.formCard}>
            {outstandingAdvances.length === 0 ? (
              <Text style={s.noAdvances}>{t('payroll.noAdvances')}</Text>
            ) : (
              <View style={s.advanceList}>
                {outstandingAdvances.map(a => (
                  <View key={a.id} style={s.advanceRow}>
                    <View style={s.advanceCopy}>
                      <Text style={s.advanceAmount}>
                        {formatINR(a.outstanding)}
                      </Text>
                      {a.reason ? (
                        <Text style={s.advanceReason} numberOfLines={1}>
                          {a.reason}
                        </Text>
                      ) : null}
                    </View>
                    <Text style={s.advanceMeta}>
                      {t('payroll.outstandingAdvance', {
                        amount: formatINR(a.outstanding),
                      })}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            {advanceRecovery > 0 ? (
              <Text style={s.hint}>
                {t('payroll.advanceRecoveryNote', {
                  amount: formatINR(advanceRecovery),
                })}
              </Text>
            ) : null}

            <View style={s.band} />

            <Text style={s.label}>{t('payroll.advanceAmount')}</Text>
            <TextInput
              style={s.input}
              value={advanceAmount}
              editable={!recording}
              onChangeText={v => {
                clearFeedback();
                setAdvanceAmount(sanitizeMoney(v));
              }}
              placeholder={t('payroll.advanceAmountPlaceholder')}
              placeholderTextColor={colors.textGray}
              keyboardType="decimal-pad"
            />
            <Text style={s.label}>{t('payroll.reasonOptional')}</Text>
            <TextInput
              style={s.input}
              value={advanceReason}
              editable={!recording}
              onChangeText={v => {
                clearFeedback();
                setAdvanceReason(v);
              }}
              placeholder={t('payroll.reasonPlaceholder')}
              placeholderTextColor={colors.textGray}
            />
            <ScalePressable
              style={[s.secondaryButton, recording && s.buttonDisabled]}
              onPress={onRecordAdvance}
              disabled={recording}
              accessibilityRole="button"
            >
              {recording ? (
                <ActivityIndicator color={colors.primary} />
              ) : (
                <Text style={s.secondaryButtonText}>
                  {t('payroll.recordAdvance')}
                </Text>
              )}
            </ScalePressable>
          </View>

          <View style={s.netCard}>
            <Text style={s.netLabel}>{t('payroll.netSalary')}</Text>
            <Text style={s.netValue} adjustsFontSizeToFit numberOfLines={1}>
              {formatINR(netValue)}
            </Text>
          </View>

          <ScalePressable
            style={[s.primaryButton, (saving || paid) && s.buttonDisabled]}
            onPress={onSave}
            disabled={saving || paid}
            accessibilityRole="button"
          >
            {saving ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={s.primaryButtonText}>{t('payroll.saveSalary')}</Text>
            )}
          </ScalePressable>

          <ScalePressable
            style={[s.payButton, (paying || paid) && s.buttonDisabled]}
            onPress={onMarkPaid}
            disabled={paying || paid}
            accessibilityRole="button"
          >
            {paying ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={s.payButtonText}>
                {paid ? t('payroll.alreadyPaidNote') : t('payroll.markAsPaid')}
              </Text>
            )}
          </ScalePressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const Header: React.FC<{ title: string; onBack: () => void }> = ({
  title,
  onBack,
}) => (
  <View style={s.header}>
    <ScalePressable
      style={s.iconButton}
      onPress={onBack}
      accessibilityRole="button"
    >
      <Feather name="arrow-left" size={f(22)} color={colors.primary} />
    </ScalePressable>
    <Text style={s.headerTitle} numberOfLines={1}>
      {title}
    </Text>
    <View style={s.iconButton} />
  </View>
);

const MoneyField: React.FC<{
  label?: string;
  value: string;
  editable: boolean;
  placeholder: string;
  onChange: (value: string) => void;
}> = ({ label, value, editable, placeholder, onChange }) => (
  <View>
    {label ? <Text style={s.label}>{label}</Text> : null}
    <TextInput
      style={[s.input, !editable && s.inputDisabled]}
      value={value}
      editable={editable}
      onChangeText={onChange}
      placeholder={placeholder}
      placeholderTextColor={colors.textGray}
      keyboardType="decimal-pad"
    />
  </View>
);

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.white },
  flex: { flex: 1 },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: h(12),
    padding: w(24),
  },
  content: { padding: w(16), paddingBottom: h(32) },

  header: {
    height: h(60),
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: w(12),
    backgroundColor: colors.white,
  },
  headerTitle: {
    color: colors.primary,
    fontSize: f(17),
    fontFamily: typography.fontFamily,
    fontWeight: typography.weights.bold,
    letterSpacing: 0.6,
    flex: 1,
    textAlign: 'center',
  },
  iconButton: {
    width: w(40),
    height: w(40),
    alignItems: 'center',
    justifyContent: 'center',
  },

  guardCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: w(12),
    padding: w(12),
    borderRadius: w(12),
    borderWidth: 1,
    borderColor: colors.light.border,
    backgroundColor: colors.white,
    marginBottom: h(12),
  },
  guardAvatar: {
    width: w(48),
    height: w(48),
    borderRadius: w(24),
    backgroundColor: colors.light.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  guardCopy: { flex: 1, minWidth: 0 },
  guardName: {
    color: colors.primary,
    fontSize: f(17),
    fontFamily: typography.fontFamily,
    fontWeight: typography.weights.semiBold,
  },
  guardMeta: {
    color: colors.light.secondaryText,
    fontSize: f(13),
    fontFamily: typography.fontFamily,
    marginTop: h(2),
  },
  statusBadge: {
    paddingHorizontal: w(10),
    paddingVertical: h(5),
    borderRadius: w(8),
    borderWidth: 1,
    maxWidth: w(96),
    alignItems: 'center',
  },
  statusBadgeText: {
    fontSize: f(11),
    fontFamily: typography.fontFamily,
    fontWeight: typography.weights.semiBold,
    letterSpacing: 0.4,
  },

  alertError: {
    borderWidth: 1,
    borderColor: colors.status.danger,
    backgroundColor: '#FDECEC',
    borderRadius: w(8),
    padding: w(12),
    flexDirection: 'row',
    alignItems: 'center',
    gap: w(8),
    marginBottom: h(12),
  },
  alertErrorText: { color: colors.status.danger, fontSize: f(13), flex: 1 },
  alertSuccess: {
    borderWidth: 1,
    borderColor: SUCCESS,
    backgroundColor: '#EAF8EF',
    borderRadius: w(8),
    padding: w(12),
    flexDirection: 'row',
    alignItems: 'center',
    gap: w(8),
    marginBottom: h(12),
  },
  alertSuccessText: { color: SUCCESS, fontSize: f(13), flex: 1 },

  formCard: {
    padding: w(14),
    borderRadius: w(12),
    borderWidth: 1,
    borderColor: colors.light.border,
    backgroundColor: colors.white,
    marginBottom: h(16),
  },
  label: {
    color: colors.primary,
    fontSize: f(15),
    fontFamily: typography.fontFamily,
    fontWeight: typography.weights.medium,
    marginBottom: h(6),
  },
  input: {
    minHeight: h(48),
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: w(8),
    paddingHorizontal: w(14),
    color: colors.primary,
    fontSize: f(16),
    fontFamily: typography.fontFamily,
    backgroundColor: colors.white,
    marginBottom: h(14),
  },
  inputDisabled: {
    backgroundColor: colors.light.background,
    color: colors.light.secondaryText,
  },
  hint: {
    color: colors.light.secondaryText,
    fontSize: f(12),
    fontFamily: typography.fontFamily,
    marginTop: -h(8),
    marginBottom: h(14),
    lineHeight: f(17),
  },
  overtimeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: h(6),
  },
  autoBadge: { flexDirection: 'row', alignItems: 'center', gap: w(4) },
  autoText: {
    color: SUCCESS,
    fontSize: f(13),
    fontFamily: typography.fontFamily,
    fontWeight: typography.weights.semiBold,
  },

  section: {
    color: colors.primary,
    fontSize: f(16),
    fontWeight: '700',
    borderLeftWidth: w(4),
    borderLeftColor: colors.gold,
    paddingLeft: w(9),
    marginBottom: h(12),
  },
  noAdvances: {
    color: colors.light.secondaryText,
    fontSize: f(14),
    fontFamily: typography.fontFamily,
  },
  advanceList: { gap: h(8), marginBottom: h(10) },
  advanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: w(10),
    paddingVertical: h(6),
  },
  advanceCopy: { flex: 1, minWidth: 0 },
  advanceAmount: {
    color: colors.primary,
    fontSize: f(16),
    fontFamily: typography.fontFamily,
    fontWeight: typography.weights.semiBold,
  },
  advanceReason: {
    color: colors.light.secondaryText,
    fontSize: f(12),
    fontFamily: typography.fontFamily,
    marginTop: h(2),
  },
  advanceMeta: {
    color: AMBER,
    fontSize: f(12),
    fontFamily: typography.fontFamily,
    fontWeight: typography.weights.medium,
    maxWidth: w(120),
    textAlign: 'right',
  },
  band: { height: 1, backgroundColor: '#DCDCDC', marginBottom: h(14) },

  netCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: w(10),
    paddingVertical: h(10),
    marginBottom: h(14),
    borderTopWidth: 1,
    borderTopColor: '#DCDCDC',
  },
  netLabel: {
    color: colors.primary,
    fontSize: f(17),
    fontFamily: typography.fontFamily,
    fontWeight: typography.weights.bold,
  },
  netValue: {
    color: PAID_GREEN,
    fontSize: f(22),
    fontFamily: typography.fontFamily,
    fontWeight: typography.weights.extraBold,
    flexShrink: 1,
  },

  primaryButton: {
    height: h(50),
    borderRadius: w(8),
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: h(10),
  },
  primaryButtonText: {
    color: colors.white,
    fontSize: f(16),
    fontFamily: typography.fontFamily,
    fontWeight: typography.weights.bold,
  },
  secondaryButton: {
    height: h(48),
    borderRadius: w(8),
    borderWidth: 1,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: h(2),
  },
  secondaryButtonText: {
    color: colors.primary,
    fontSize: f(15),
    fontFamily: typography.fontFamily,
    fontWeight: typography.weights.semiBold,
  },
  payButton: {
    height: h(50),
    borderRadius: w(8),
    backgroundColor: PAID_GREEN,
    alignItems: 'center',
    justifyContent: 'center',
  },
  payButtonText: {
    color: colors.white,
    fontSize: f(16),
    fontFamily: typography.fontFamily,
    fontWeight: typography.weights.bold,
  },
  buttonDisabled: { backgroundColor: '#C9CFD8', borderColor: '#C9CFD8' },

  stateText: { color: colors.light.secondaryText, fontSize: f(14) },
  errorIcon: {
    width: w(52),
    height: w(52),
    borderRadius: w(26),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FDECEC',
  },
  errorText: {
    color: colors.status.danger,
    fontSize: f(14),
    textAlign: 'center',
  },
  retry: {
    marginTop: h(6),
    paddingHorizontal: w(20),
    height: h(44),
    borderRadius: w(8),
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryText: { color: colors.white, fontSize: f(15), fontWeight: '700' },
});

export default AgencyPayrollDetailsScreen;
