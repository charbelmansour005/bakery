import { PICKUP } from './config';

/**
 * Pickup days, as plain YYYY-MM-DD strings.
 *
 * "Today" is the bakery's today (Beirut), not the server's (UTC) or the
 * customer's: at 1am in Beirut a UTC clock still says yesterday, and would
 * offer a day the bakery cannot bake for.
 *
 * Not marked `server-only` — the checkout form uses the same rules the server
 * enforces.
 */

const TIME_ZONE = 'Asia/Beirut';
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function todayInBeirut(now: Date = new Date()): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

/** Calendar arithmetic in UTC, so a daylight-saving change cannot skip or repeat a day. */
export function addDays(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export type PickupWindow = { min: string; max: string };

export function pickupWindow(now: Date = new Date()): PickupWindow {
  const min = addDays(todayInBeirut(now), PICKUP.leadDays);
  return { min, max: addDays(min, PICKUP.windowDays - 1) };
}

export function isValidPickupDate(value: string, now: Date = new Date()): boolean {
  if (!ISO_DATE.test(value)) return false;
  // Rejects impossible dates such as 2026-02-31, which the regex lets through.
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) return false;

  const { min, max } = pickupWindow(now);
  // ISO dates sort as strings.
  return value >= min && value <= max;
}

/** "Saturday 10 October" */
export function formatPickupDate(isoDate: string): string {
  if (!ISO_DATE.test(isoDate)) return isoDate;
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  }).format(new Date(`${isoDate}T00:00:00Z`));
}
