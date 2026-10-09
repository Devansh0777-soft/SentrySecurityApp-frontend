import type { NavigatorScreenParams } from '@react-navigation/native';

export type OnboardingStackParamList = {
  Splash: undefined;
  Onboarding01: undefined;
  Onboarding02: undefined;
  Onboarding03: undefined;
};

export type AuthStackParamList = {
  Login: undefined;
  CreateAccount: { forceAccountType?: 'agency' } | undefined;
  AgencyDetails: undefined;
  ClientDetails: undefined;
  VerifyMobile: undefined;
  AccountCreated:
    | { returnToSuperAdmin?: boolean; approvalPending?: boolean }
    | undefined;
  ForgotPassword: undefined;
  VerifyOTP: undefined;
  CreateNewPassword: undefined;
  PasswordUpdated: undefined;
};

export type MainStackParamList = {
  AgencyOverview: undefined;
  AgencyIncidents: { openFileIncident?: boolean } | undefined;
  AgencySites: { openAddSite?: boolean; openRequestId?: number } | undefined;
  AgencyProfile: undefined;
  AgencyGuards: { openAddGuard?: boolean } | undefined;
  AgencyPlan: undefined;
  AgencyInvoices: undefined;
  AgencyPayroll: undefined;
  AgencyPayrollDetails: { guardId: number; period: string };
  AgencyEventDetails: { siteId: number };
};

export type GuardSectionKey =
  | 'personalInfo'
  | 'documents'
  | 'bankDetails'
  | 'emergencyContact'
  | 'settings';

export type GuardStackParamList = {
  GuardDuty: undefined;
  GuardSchedule: undefined;
  GuardDutyCapture: { mode: 'clock_in' | 'clock_out' };
  GuardReport: undefined;
  GuardPatrol: undefined;
  GuardProfile: undefined;
  GuardPersonalInfo: undefined;
  GuardDocuments: undefined;
  GuardBankDetails: undefined;
  GuardSalary: undefined;
  GuardEmergencyContact: undefined;
  GuardSection: { section: GuardSectionKey };
};

// NEW — root navigator that nests the three feature navigators
export type RootStackParamList = {
  SuperAdminFlow: undefined;
  OnboardingFlow: undefined;
  AuthFlow: NavigatorScreenParams<AuthStackParamList> | undefined;
  MainFlow: undefined;
  ClientFlow: undefined;
  GuardFlow: undefined;
};
