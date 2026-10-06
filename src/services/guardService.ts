import { apiRequest } from './apiClient';

/**
 * Photo selected by the guard. Image Picker already returns a ready-to-upload
 * `file://` URI together with the original file name and MIME type.
 */
export type DutyPhoto = {
  uri: string;
  fileName?: string | null;
  type?: string | null;
};

/** Guard photos accepted by the API: JPG, PNG, or WEBP, max 10 MB each. */
const toFormDataFile = (photo: DutyPhoto, fallbackName: string) => {
  const uri = /^(file|content|ph):\/\//i.test(photo.uri)
    ? photo.uri
    : `file://${photo.uri.startsWith('/') ? '' : '/'}${photo.uri}`;

  let name = photo.fileName?.trim() || fallbackName;
  if (!/\.(jpg|jpeg|png|webp)$/i.test(name)) {
    name = `${name}.jpg`;
  }

  return {
    uri,
    name,
    type:
      photo.type && photo.type.startsWith('image/') ? photo.type : 'image/jpeg',
  } as unknown as Blob;
};

/** Builds the multipart body the duty API expects (`photo` field). */
const buildDutyPhotoBody = (photo: DutyPhoto) => {
  const body = new FormData();
  body.append('photo', toFormDataFile(photo, `duty-photo-${Date.now()}.jpg`));
  return body;
};

/** Incidents accept up to five evidence photos per report. */
export const MAX_REPORT_PHOTOS = 5;

export type GuardDutyDetails = {
  id: number;
  guard_code?: string;
  full_name: string;
  status: 'on_duty' | 'off_duty';
  site_id?: number | null;
  site_name?: string | null;
  site_address?: string | null;
  coverage_plan?: 'day_shift' | 'night_watch' | '24x7';
  start_time?: string | null;
  end_time?: string | null;
};

export type GuardProfile = GuardDutyDetails & {
  mobile_number?: string | null;
  email?: string | null;
  address?: string | null;
  age?: number | null;
  gender?: 'male' | 'female' | 'other' | null;
  joining_date?: string | null;
  shift_hours?: number | null;
  basic_salary?: number | null;
  allowances?: number | null;
};

export type GuardProfileUpdate = {
  fullName: string;
  mobileNumber: string;
  email: string;
  address?: string | null;
  age?: number | null;
  gender?: 'male' | 'female' | 'other' | null;
};

export type GuardReport = {
  id: number;
  incident_code?: string;
  severity: 'low' | 'medium' | 'high';
  notes: string;
  created_at: string;
};

export type GuardDutyLog = {
  id: number;
  site_id?: number | null;
  site_name?: string | null;
  status: 'on_duty' | 'off_duty';
  clock_in_at: string;
  clock_in_photo?: string | null;
  clock_out_at?: string | null;
  clock_out_photo?: string | null;
  duration_minutes?: number | string | null;
};

export type GuardDutyStatus = {
  status: GuardDutyLog['status'];
  active_log: GuardDutyLog | null;
  assignment: { site_id: number; site_name: string | null } | null;
  /**
   * Backend-authoritative 24-hour duty-cycle eligibility (clock-in side).
   * Optional so an older API payload still renders; missing is treated as
   * "off duty = eligible".
   */
  can_start?: boolean;
  /** ISO timestamp of the next allowed clock-in while `can_start` is false. */
  next_start_at?: string | null;
  /** True while the current session may be ended (one is active). */
  can_end?: boolean;
};

export type DutyPhotoMode = 'clock_in' | 'clock_out';

/**
 * Payroll summary for a date range, calculated by the API from the guard's
 * logged duty hours (basic salary ÷ (26 × shift hours) = hourly rate).
 */
export type GuardSalarySummary = {
  from: string;
  to: string;
  total_shifts: number;
  total_minutes: number;
  total_hours: number;
  hourly_rate: number;
  calculated_pay: number;
};

/**
 * Reports with attachments use the same multipart contract as the duty photo
 * endpoints (`photos` field, appended per file). Reports without attachments
 * keep the plain JSON body.
 */
const buildReportBody = (
  report: { severity: GuardReport['severity']; notes: string },
  photos: DutyPhoto[],
) => {
  const attached = photos.slice(0, MAX_REPORT_PHOTOS);
  if (!attached.length) return report;

  const body = new FormData();
  body.append('severity', report.severity);
  body.append('notes', report.notes);
  attached.forEach((photo, index) => {
    body.append(
      'photos',
      toFormDataFile(photo, `report-photo-${Date.now()}-${index}.jpg`),
    );
  });
  return body;
};

export type PatrolCheckpoint = {
  id: number;
  name: string;
  sequence_order: number;
  /** Persisted by the backend; the only source of truth for the row state. */
  visited: boolean;
  visited_at?: string | null;
};

export type PatrolScanLog = {
  id: number;
  checkpoint_id: number;
  checkpoint_name: string;
  scanned_at: string;
};

export type PatrolCheckpointData = {
  site_id: number;
  site_name: string | null;
  checkpoints: PatrolCheckpoint[];
  recent_scans: PatrolScanLog[];
};

export const guardService = {
  getDutyDetails: async () =>
    (
      await apiRequest<{ success: boolean; data: GuardDutyDetails }>(
        '/guard/me',
        {
          authenticated: true,
        },
      )
    ).data,
  getProfile: async () =>
    (
      await apiRequest<{ success: boolean; data: GuardProfile }>('/guard/me', {
        authenticated: true,
      })
    ).data,
  updateProfile: async (body: GuardProfileUpdate) =>
    (
      await apiRequest<{ success: boolean; data: GuardProfile }>(
        '/guard/profile',
        {
          method: 'PUT',
          body,
          authenticated: true,
        },
      )
    ).data,
  getDutyStatus: async () =>
    (
      await apiRequest<{ success: boolean; data: GuardDutyStatus }>(
        '/guard/duty/status',
        { authenticated: true },
      )
    ).data,
  getDutyHistory: async () =>
    (
      await apiRequest<{ success: boolean; data: GuardDutyLog[] }>(
        '/guard/duty/history',
        { authenticated: true },
      )
    ).data,
  getDutySalary: async (from: string, to: string) =>
    (
      await apiRequest<{ success: boolean; data: GuardSalarySummary }>(
        `/guard/duty/salary?from=${from}&to=${to}`,
        { authenticated: true },
      )
    ).data,
  clockIn: async (photo: DutyPhoto) =>
    (
      await apiRequest<{ success: boolean; data: GuardDutyLog }>(
        '/guard/duty/clock-in',
        {
          method: 'POST',
          body: buildDutyPhotoBody(photo),
          authenticated: true,
        },
      )
    ).data,
  clockOut: async (photo: DutyPhoto) =>
    (
      await apiRequest<{ success: boolean; data: GuardDutyLog }>(
        '/guard/duty/clock-out',
        {
          method: 'POST',
          body: buildDutyPhotoBody(photo),
          authenticated: true,
        },
      )
    ).data,
  submitReport: async (report: {
    severity: GuardReport['severity'];
    notes: string;
    /** Optional evidence photos captured or picked by the guard. */
    photos?: DutyPhoto[];
  }) =>
    (
      await apiRequest<{ success: boolean; data: GuardReport }>(
        '/guard/reports',
        {
          method: 'POST',
          body: buildReportBody(
            { severity: report.severity, notes: report.notes },
            report.photos ?? [],
          ),
          authenticated: true,
        },
      )
    ).data,
  getReports: async () =>
    (
      await apiRequest<{ success: boolean; data: GuardReport[] }>(
        '/guard/reports',
        {
          authenticated: true,
        },
      )
    ).data,
  getPatrolCheckpoints: async () =>
    (
      await apiRequest<{
        success: boolean;
        data: PatrolCheckpointData;
      }>('/guard/patrol/checkpoints', { authenticated: true })
    ).data,
  scanPatrolCheckpoint: async (id: number) =>
    (
      await apiRequest<{
        success: boolean;
        data: {
          scan: {
            id: number;
            checkpoint_id: number;
            scanned_at: string;
          };
          progress: { scanned: number; total: number; percent: number };
          round_completed: boolean;
        };
      }>(`/guard/patrol/checkpoints/${id}/scan`, {
        method: 'POST',
        authenticated: true,
      })
    ).data,
};
