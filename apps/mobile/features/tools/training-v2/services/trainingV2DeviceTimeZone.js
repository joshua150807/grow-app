// Reads the device's current IANA time zone directly from the JS runtime. No manual
// UTC offset math happens on the client — the server computes the UTC instant from
// the local date + this IANA zone (see trainingPlanService.ts scheduleInstant).
export function getTrainingV2DeviceTimeZone() {
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  if (typeof timeZone !== 'string' || timeZone.trim().length === 0) {
    throw new Error('Die Zeitzone des Geräts konnte nicht ermittelt werden.');
  }
  return timeZone;
}

// Extracts "YYYY-MM-DD" from a Date's *local* calendar components (not its UTC
// components), so the string matches what the device's calendar/clock shows.
export function toLocalDateString(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
