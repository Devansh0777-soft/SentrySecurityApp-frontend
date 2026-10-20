import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import Feather from 'react-native-vector-icons/Feather';
import { useTranslation } from 'react-i18next';

import ScalePressable from '../../../components/common/ScalePressable';
import {
  invoiceService,
  type ClientInvoice,
} from '../../../services/invoiceService';
import { colors } from '../../../styles/colors';
import { scaleFont } from '../../../styles/dimensions';
import { spacing } from '../../../styles/spacing';
import { typography } from '../../../styles/typography';
import { appAlert } from '../../../services/alertService';

/** Burnt-orange accent used for pending invoices (amount, chip, accent bar). */
const AMBER = '#B9640A';
const AMBER_TINT = '#FDF1E0';
const SUCCESS_TINT = '#E4F6EA';
const DANGER_TINT = '#FDECEC';

const ICON_TILE = 40;
const ICON_CIRCLE = 68;
const DAY_MS = 24 * 60 * 60 * 1000;

const formatINR = (value: number): string =>
  `₹${Math.round(value).toLocaleString('en-IN')}`;

/** Accepts `YYYY-MM-DD` or a full ISO timestamp and renders `dd/mm/yyyy`. */
const formatDate = (value: string | null): string => {
  if (!value) return '';
  const [year, month, day] = value.slice(0, 10).split('-');
  if (!year || !month || !day) return value;
  return `${day}/${month}/${year}`;
};

/** `2026-07-15` → `July 2026`, used for the coverage-period card title. */
const monthLabel = (value: string): string => {
  const [year, month] = value.slice(0, 10).split('-').map(Number);
  if (!year || !month) return value;
  return new Date(year, month - 1, 1).toLocaleDateString('en-IN', {
    month: 'long',
    year: 'numeric',
  });
};

/** Whole days past the due date; `0` while the invoice is still within terms. */
const daysOverdue = (dueDate: string): number => {
  const [year, month, day] = dueDate.slice(0, 10).split('-').map(Number);
  if (!year || !month || !day) return 0;
  const due = new Date(year, month - 1, day).getTime();
  const now = new Date();
  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  ).getTime();
  return Math.max(0, Math.round((startOfToday - due) / DAY_MS));
};

type StatusAppearance = {
  icon: 'clock' | 'check-circle' | 'alert-circle';
  color: string;
  tint: string;
  label: string;
};

/** One status language (icon + tint + label) shared by every invoice card. */
const statusAppearance = (
  status: ClientInvoice['status'],
  labels: { pending: string; paid: string; overdue: string },
): StatusAppearance => {
  if (status === 'paid') {
    return {
      icon: 'check-circle',
      color: colors.status.success,
      tint: SUCCESS_TINT,
      label: labels.paid,
    };
  }
  if (status === 'overdue') {
    return {
      icon: 'alert-circle',
      color: colors.status.danger,
      tint: DANGER_TINT,
      label: labels.overdue,
    };
  }
  return {
    icon: 'clock',
    color: AMBER,
    tint: AMBER_TINT,
    label: labels.pending,
  };
};

const InvoiceCard: React.FC<{
  invoice: ClientInvoice;
  onPayNow: (invoice: ClientInvoice) => void;
}> = ({ invoice, onPayNow }) => {
  const { t } = useTranslation();
  const isPaid = invoice.status === 'paid';
  const appearance = statusAppearance(invoice.status, {
    pending: t('client.invoicePending'),
    paid: t('client.invoicePaid'),
    overdue: t('client.invoiceOverdue'),
  });
  const overdueDays = isPaid ? 0 : daysOverdue(invoice.due_date);
  const title = invoice.description?.trim()
    ? invoice.description
    : t('client.invoiceCoverageTitle', { month: monthLabel(invoice.due_date) });

  return (
    <View
      style={[
        s.card,
        isPaid
          ? s.cardPaid
          : invoice.status === 'overdue'
          ? s.cardOverdue
          : s.cardOpen,
      ]}
    >
      <View style={s.head}>
        <View style={[s.iconTile, { backgroundColor: appearance.tint }]}>
          <Feather
            name={appearance.icon}
            size={scaleFont(typography.sizes.lg)}
            color={appearance.color}
          />
        </View>
        <View style={s.headCopy}>
          <Text style={s.title} numberOfLines={2}>
            {title}
          </Text>
          <Text style={s.code}>
            {invoice.site_name
              ? `${invoice.invoice_code} · ${invoice.site_name}`
              : invoice.invoice_code}
          </Text>
        </View>
        <View style={[s.chip, { backgroundColor: appearance.tint }]}>
          <Text style={[s.chipText, { color: appearance.color }]}>
            {appearance.label}
          </Text>
        </View>
      </View>

      <View style={s.divider} />

      <View style={s.body}>
        <View style={s.dueBlock}>
          <View style={s.dueLine}>
            <Feather
              name="calendar"
              size={scaleFont(typography.sizes.xs)}
              color={colors.light.secondaryText}
            />
            <Text style={[s.dueText, overdueDays > 0 && s.dueTextOverdue]}>
              {t('client.invoiceDue', { date: formatDate(invoice.due_date) })}
            </Text>
          </View>
          {overdueDays > 0 ? (
            <Text style={s.overdueHint}>
              {t('client.invoiceOverdueBy', { count: overdueDays })}
            </Text>
          ) : null}
        </View>
        <Text style={s.amount}>{formatINR(invoice.amount)}</Text>
      </View>

      {isPaid ? (
        <View style={s.paidBand}>
          <Feather
            name="check-circle"
            size={scaleFont(typography.sizes.sm)}
            color={colors.status.success}
          />
          <Text style={s.paidBandText}>
            {invoice.paid_at
              ? t('client.invoicePaidOn', {
                  date: formatDate(invoice.paid_at),
                })
              : t('client.invoicePaid')}
          </Text>
        </View>
      ) : (
        <ScalePressable
          style={s.pay}
          onPress={() => onPayNow(invoice)}
          accessibilityRole="button"
          accessibilityLabel={t('client.invoicePayNow')}
        >
          <Feather
            name="credit-card"
            size={scaleFont(typography.sizes.md)}
            color={colors.white}
          />
          <Text style={s.payText}>{t('client.invoicePayNow')}</Text>
        </ScalePressable>
      )}

      {invoice.agency_name ? (
        <Text style={s.agency}>
          {t('client.invoiceIssuedBy', { agency: invoice.agency_name })}
        </Text>
      ) : null}
    </View>
  );
};

export default function ClientInvoices() {
  const { t } = useTranslation();
  const [invoices, setInvoices] = useState<ClientInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      setInvoices(await invoiceService.getClientInvoices());
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : t('client.invoiceLoadFailed'),
      );
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  /** No payment gateway is wired up yet — the agency records the payment. */
  const payNow = (invoice: ClientInvoice) =>
    appAlert.alert(
      t('client.invoicePaymentUnavailableTitle'),
      `${invoice.invoice_code} · ${formatINR(invoice.amount)}\n\n${t(
        'client.invoicePaymentUnavailable',
      )}`,
    );

  if (loading)
    return (
      <View style={s.state}>
        <ActivityIndicator color={colors.primary} />
        <Text style={s.muted}>{t('client.invoiceLoading')}</Text>
      </View>
    );

  if (error)
    return (
      <View style={s.state}>
        <View style={[s.iconCircle, { backgroundColor: DANGER_TINT }]}>
          <Feather
            name="alert-circle"
            size={scaleFont(typography.sizes.xxl)}
            color={colors.status.danger}
          />
        </View>
        <Text style={s.error}>{error}</Text>
        <ScalePressable
          style={s.retry}
          onPress={() => {
            setLoading(true);
            load();
          }}
          accessibilityRole="button"
          accessibilityLabel={t('client.invoiceRetry')}
        >
          <Feather
            name="refresh-cw"
            size={scaleFont(typography.sizes.sm)}
            color={colors.white}
          />
          <Text style={s.retryText}>{t('client.invoiceRetry')}</Text>
        </ScalePressable>
      </View>
    );

  if (!invoices.length)
    return (
      <View style={s.state}>
        <View style={s.iconCircle}>
          <Feather
            name="file-text"
            size={scaleFont(typography.sizes.xxl)}
            color={colors.primary}
          />
        </View>
        <Text style={s.emptyTitle}>{t('client.noInvoices')}</Text>
        <Text style={s.muted}>{t('client.noInvoicesHint')}</Text>
      </View>
    );

  // Inset list that respects the screen padding.
  return (
    <View style={s.list}>
      {invoices.map(invoice => (
        <InvoiceCard key={invoice.id} invoice={invoice} onPayNow={payNow} />
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  list: { gap: spacing.sm },
  card: {
    paddingVertical: spacing.md,
    paddingLeft: spacing.md - spacing.xs,
    paddingRight: spacing.md,
    gap: spacing.sm,
    backgroundColor: colors.light.background,
    borderLeftWidth: spacing.xs,
  },
  cardOpen: { borderLeftColor: AMBER },
  cardOverdue: { borderLeftColor: colors.status.danger },
  cardPaid: { borderLeftColor: colors.status.success },
  head: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  iconTile: {
    width: ICON_TILE,
    height: ICON_TILE,
    borderRadius: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headCopy: { flex: 1, gap: spacing.xs / 2 },
  title: {
    color: colors.primary,
    fontSize: scaleFont(typography.sizes.md),
    fontWeight: typography.weights.bold,
    lineHeight: scaleFont(typography.sizes.lg),
  },
  code: {
    color: colors.light.secondaryText,
    fontSize: scaleFont(typography.sizes.xs),
    fontWeight: typography.weights.medium,
    letterSpacing: 0.3,
  },
  chip: {
    borderRadius: spacing.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  chipText: {
    fontSize: scaleFont(typography.sizes.xs),
    fontWeight: typography.weights.bold,
    letterSpacing: 0.6,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.light.border,
  },
  body: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  dueBlock: { flex: 1, gap: spacing.xs / 2 },
  dueLine: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  dueText: {
    color: colors.light.secondaryText,
    fontSize: scaleFont(typography.sizes.sm),
  },
  dueTextOverdue: {
    color: colors.status.danger,
    fontWeight: typography.weights.semiBold,
  },
  overdueHint: {
    color: colors.status.danger,
    fontSize: scaleFont(typography.sizes.xs),
    fontWeight: typography.weights.semiBold,
  },
  amount: {
    color: AMBER,
    fontSize: scaleFont(typography.sizes.xxl),
    fontWeight: typography.weights.bold,
  },
  pay: {
    minHeight: 48,
    borderRadius: spacing.sm,
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  payText: {
    color: colors.white,
    fontSize: scaleFont(typography.sizes.md),
    fontWeight: typography.weights.semiBold,
  },
  paidBand: {
    minHeight: 48,
    borderRadius: spacing.sm,
    backgroundColor: SUCCESS_TINT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  paidBandText: {
    color: colors.status.success,
    fontSize: scaleFont(typography.sizes.sm),
    fontWeight: typography.weights.semiBold,
  },
  agency: {
    color: colors.textGray,
    fontSize: scaleFont(typography.sizes.xs),
  },
  state: {
    minHeight: 220,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    padding: spacing.lg,
  },
  iconCircle: {
    width: ICON_CIRCLE,
    height: ICON_CIRCLE,
    borderRadius: ICON_CIRCLE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.light.background,
  },
  emptyTitle: {
    color: colors.primary,
    fontSize: scaleFont(typography.sizes.md),
    fontWeight: typography.weights.semiBold,
  },
  muted: {
    color: colors.textGray,
    fontSize: scaleFont(typography.sizes.sm),
    textAlign: 'center',
  },
  error: {
    color: colors.status.danger,
    fontSize: scaleFont(typography.sizes.sm),
    textAlign: 'center',
  },
  retry: {
    minHeight: 48,
    borderRadius: spacing.sm,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  retryText: {
    color: colors.white,
    fontSize: scaleFont(typography.sizes.sm),
    fontWeight: typography.weights.semiBold,
  },
});
