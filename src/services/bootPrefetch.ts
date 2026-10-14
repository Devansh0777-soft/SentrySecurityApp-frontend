import { guardService } from './guardService';
import { clientService } from './clientService';
import { agencyApiService } from './agencyApiService';
import { payrollService } from './payrollService';
import { invoiceService } from './invoiceService';
import { superAdminService } from './superAdminService';
import { notificationService } from './notificationService';
import { session } from './session';

/**
 * Boot-time dashboard prefetch.
 *
 * While the splash progress bar animates, parallel-fetch the role's
 * essential dashboard data using the exact same service calls the screens
 * make on mount. Results land in a one-shot in-memory cache so dashboards
 * hydrate from the cache instead of refetching — no duplicate requests,
 * no business-logic changes, and the dashboard mounts with data present.
 *
 * Single-flight: ONE shared promise per session. Concurrent callers (splash
 * boot + any early-mounting dashboard) await the same promise, so duplicate
 * network calls can never start.
 *
 * Scoping: entries are keyed by (account_type, token) so a logged-out /
 * re-login session can never read another user's stale data.
 */

export type BootAccountType = 'guard' | 'client' | 'agency' | 'superAdmin';

type Slots = {
  guardDetails?: unknown;
  guardStatus?: unknown;
  guardLogs?: unknown;
  clientDetails?: unknown;
  clientCoverage?: unknown;
  sites?: unknown;
  guards?: unknown;
  incidents?: unknown;
  payroll?: unknown;
  invoices?: unknown;
  ratings?: unknown;
  agencies?: unknown;
  unreadCount?: unknown;
};

type Entry = {
  key: string;
  promise: Promise<Slots>;
  slots: Slots;
  settled: boolean;
};

let active: Entry | null = null;

const keyFor = (accountType: BootAccountType, token: string | null): string =>
  `${accountType}:${token ?? 'none'}`;

const withTimeout = <T>(work: Promise<T>, ms: number): Promise<T> =>
  Promise.race([
    work,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error('Boot prefetch timed out')), ms),
    ),
  ]);

/** Transport failure on one call must not fail the whole batch. */
const swallow = async <T>(work: Promise<T>): Promise<T | undefined> => {
  try {
    return await work;
  } catch {
    return undefined;
  }
};

const periodOf = (): string => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
};

const fetchRole = (accountType: BootAccountType): Promise<Slots> => {
  switch (accountType) {
    case 'guard':
      return Promise.all([
        swallow(guardService.getDutyDetails()),
        swallow(guardService.getDutyStatus()),
        swallow(guardService.getDutyHistory()),
      ]).then(([guardDetails, guardStatus, guardLogs]) => ({
        guardDetails,
        guardStatus,
        guardLogs,
      }));
    case 'client':
      return Promise.all([
        swallow(clientService.getDetails()),
        swallow(clientService.getCoverageRequests()),
      ]).then(([clientDetails, clientCoverage]) => ({
        clientDetails,
        clientCoverage,
      }));
    case 'superAdmin':
      return swallow(superAdminService.getAgencies()).then(agencies => ({
        agencies,
      }));
    case 'agency':
    default:
      return Promise.all([
        swallow(agencyApiService.getSites()),
        swallow(agencyApiService.getGuards()),
        swallow(agencyApiService.getIncidents()),
        swallow(payrollService.getOverview(periodOf())),
        swallow(invoiceService.getAgencyInvoices()),
        swallow(agencyApiService.getRatings()),
      ]).then(([sites, guards, incidents, payroll, invoices, ratings]) => ({
        sites,
        guards,
        incidents,
        payroll,
        invoices,
        ratings,
      }));
  }
};

/**
 * Start one prefetch flight for this session (single-flight: concurrent
 * calls reuse the running entry — no races, no duplicate network calls).
 */
export const primeBootPrefetch = async (
  accountType: BootAccountType,
  timeoutMs = 15000,
): Promise<void> => {
  const token = await session.getToken();
  const key = keyFor(accountType, token);
  if (active && active.key === key) return;
  const entry: Entry = {
    key,
    promise: Promise.resolve({}),
    slots: {},
    settled: false,
  };
  entry.promise = withTimeout(
    (async () => {
      const [roleSlots, unread] = await Promise.all([
        fetchRole(accountType),
        swallow(notificationService.getUnreadCount()),
      ]);
      Object.assign(entry.slots, roleSlots, { unreadCount: unread });
      entry.settled = true;
      return entry.slots;
    })(),
    timeoutMs,
  ).catch(() => {
    // Timeout or transport failure: keep whatever slots arrived and mark
    // settled so dashboards fall back to their own fetch and error UI.
    entry.settled = true;
    return entry.slots;
  });
  active = entry;
  // Kick off immediately so the splash animation window does the fetching.
  entry.promise.then(
    () => undefined,
    () => undefined,
  );
};

/** Await the shared flight started by `primeBootPrefetch`. */
export const awaitBootPrefetch = (): Promise<Slots> =>
  active ? active.promise : Promise.resolve({});

/**
 * One-shot slot read: returns the prefetched value if this session's flight
 * delivered it, else `undefined`. A consumed slot is removed so a later
 * remount refetches fresh data rather than replaying stale cache.
 */
export const takeSlot = <T>(name: keyof Slots): T | undefined => {
  if (!active || !(name in active.slots)) return undefined;
  const value = (active.slots as Record<string, unknown>)[name] as
    | T
    | undefined;
  delete (active.slots as Record<string, unknown>)[name];
  return value === undefined ? undefined : value;
};

/** Resolve a slot from the shared flight without consuming it. */
export const awaitSlot = async <T>(
  name: keyof Slots,
): Promise<T | undefined> => {
  if (!active) return undefined;
  try {
    const slots = await active.promise;
    return (slots as Record<string, unknown>)[name] as T | undefined;
  } catch {
    return undefined;
  }
};

/** Drop the cache (called on logout so another user never sees stale data). */
export const clearBootPrefetch = (): void => {
  active = null;
};
