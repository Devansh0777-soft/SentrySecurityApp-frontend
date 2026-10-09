import { apiRequest } from './apiClient';

/**
 * Agency Payroll Management.
 *
 * The backend is the single source of truth for payroll math. The frontend only
 * sends the editable salary components; the server validates them, computes the
 * net salary and returns the persisted record. Net salary rule:
 *   gross = basic + overtime + allowances
 *   net   = gross - deductions - advance_recovery
 */

export type PayrollStatus = 'pending' | 'verified' | 'paid';

/** One guard's row on the payroll overview list. */
export type PayrollOverviewRow = {
  guard_id: number;
  full_name: string;
  payroll_id: number | null;
  status: PayrollStatus;
  amount: number;
  paid_at: string | null;
};

export type PayrollSummary = {
  total: number;
  verified: number;
  pending: number;
};

export type PayrollOverview = {
  period: string;
  summary: PayrollSummary;
  rows: PayrollOverviewRow[];
};

export type SalaryAdvance = {
  id: number;
  amount: number;
  recovered_amount: number;
  outstanding: number;
  reason: string | null;
  status: 'outstanding' | 'recovered';
  recorded_at: string;
  recovered_at: string | null;
};

export type PayrollRecord = {
  id: number;
  guard_id: number;
  period: string;
  basic_salary: number;
  overtime: number;
  allowances: number;
  deductions: number;
  advance_recovery: number;
  net_salary: number;
  status: PayrollStatus;
  paid_at: string | null;
};

export type PayrollGuardContext = {
  id: number;
  full_name: string;
  mobile_number: string | null;
  site_name: string | null;
  basic_salary: number;
  allowances: number;
  shift_hours: number | null;
};

export type PayrollDetails = {
  period: string;
  guard: PayrollGuardContext;
  record: PayrollRecord | null;
  defaults: {
    basic_salary: number;
    overtime: number;
    allowances: number;
    deductions: number;
  };
  salary_configured: boolean;
  advances: SalaryAdvance[];
  outstanding_advance: { outstanding: number; open_count: number };
};

/** Salary components submitted to the server (net salary is computed there). */
export type PayrollComponents = {
  period: string;
  basic_salary: number;
  overtime: number;
  allowances: number;
  deductions: number;
};

export const payrollService = {
  getOverview: async (period: string) =>
    (
      await apiRequest<{ success: boolean; data: PayrollOverview }>(
        `/agency/payroll?period=${period}`,
        { authenticated: true },
      )
    ).data,

  getDetails: async (guardId: number, period: string) =>
    (
      await apiRequest<{ success: boolean; data: PayrollDetails }>(
        `/agency/payroll/${guardId}?period=${period}`,
        { authenticated: true },
      )
    ).data,

  saveSalary: async (guardId: number, components: PayrollComponents) =>
    (
      await apiRequest<{ success: boolean; data: { record: PayrollRecord } }>(
        `/agency/payroll/${guardId}`,
        { method: 'POST', body: components, authenticated: true },
      )
    ).data.record,

  markPaid: async (guardId: number, period: string) =>
    (
      await apiRequest<{ success: boolean; data: { record: PayrollRecord } }>(
        `/agency/payroll/${guardId}/pay`,
        { method: 'POST', body: { period }, authenticated: true },
      )
    ).data.record,

  recordAdvance: async (
    guardId: number,
    input: { amount: number; reason?: string },
  ) =>
    (
      await apiRequest<{ success: boolean; data: { advance: SalaryAdvance } }>(
        `/agency/payroll/${guardId}/advances`,
        { method: 'POST', body: input, authenticated: true },
      )
    ).data.advance,
};

/** Indian Rupees with Indian digit grouping, up to 2 decimals. */
export const formatINR = (value: number | string | null | undefined): string => {
  const amount = Number(value ?? 0);
  const safe = Number.isFinite(amount) ? amount : 0;
  return `₹${safe.toLocaleString('en-IN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
};
