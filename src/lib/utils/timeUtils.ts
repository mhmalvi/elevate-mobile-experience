/**
 * Pure utility functions for time calculations used by timesheets.
 */

/**
 * Calculate worked hours from start/end time strings and break duration.
 *
 * @param startTime - "HH:mm" format (e.g. "07:30")
 * @param endTime   - "HH:mm" format (e.g. "16:00")
 * @param breakMinutes - minutes of break to subtract
 * @returns hours worked, rounded to 2 decimal places, or 0 if inputs are invalid
 */
export function calculateHoursFromTimes(
  startTime: string,
  endTime: string,
  breakMinutes: number,
): number {
  if (!startTime || !endTime) return 0;

  const startParts = startTime.split(':');
  const endParts = endTime.split(':');

  if (startParts.length < 2 || endParts.length < 2) return 0;

  const sh = Number(startParts[0]);
  const sm = Number(startParts[1]);
  const eh = Number(endParts[0]);
  const em = Number(endParts[1]);

  if (isNaN(sh) || isNaN(sm) || isNaN(eh) || isNaN(em)) return 0;

  const startMins = sh * 60 + sm;
  const endMins = eh * 60 + em;
  const breakMins = Number(breakMinutes) || 0;

  if (endMins <= startMins) return 0;

  const hours = Math.max(0, (endMins - startMins - breakMins) / 60);
  return Math.round(hours * 100) / 100;
}
