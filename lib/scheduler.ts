// Smart Event Scheduler — slot-finding algorithm

export interface AvailabilityBlock {
  user_id: string;
  day: number;   // 0=Mon … 6=Sun
  hour: number;  // 0-23
}

export interface CommonSlot {
  day: number;
  start_hour: number;
  duration_hours: number;
  available_users: string[];
  overlap_count: number;
}

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export function getDayName(day: number): string {
  return DAY_NAMES[day] ?? 'Unknown';
}

export function formatSlot(slot: CommonSlot): string {
  const start = formatHour(slot.start_hour);
  const end = formatHour(slot.start_hour + slot.duration_hours);
  return `${getDayName(slot.day)}, ${start} – ${end}`;
}

export function formatHour(h: number): string {
  const hour = Math.floor(h) % 24;
  const minutes = (h % 1) * 60;
  const period = hour < 12 ? 'AM' : 'PM';
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  return minutes === 0 ? `${displayHour}:00 ${period}` : `${displayHour}:30 ${period}`;
}

/**
 * Find common available slots across all members.
 * Returns ALL slots across all days, sorted by overlap_count desc, then day, then hour.
 * Even slots with just 1 member are included so admin can see the full picture.
 */
export function findCommonSlots(
  availability: AvailabilityBlock[],
  durationHours: number
): CommonSlot[] {
  // Build a map: day → hour → Set<user_id>
  const grid: Map<number, Map<number, Set<string>>> = new Map();

  for (const block of availability) {
    if (!grid.has(block.day)) grid.set(block.day, new Map());
    const dayMap = grid.get(block.day)!;
    if (!dayMap.has(block.hour)) dayMap.set(block.hour, new Set());
    dayMap.get(block.hour)!.add(block.user_id);
  }

  const slots: CommonSlot[] = [];
  const slotsNeeded = Math.ceil(durationHours);

  for (const [day, hourMap] of grid.entries()) {
    const hours = Array.from(hourMap.keys()).sort((a, b) => a - b);

    for (let i = 0; i <= hours.length - slotsNeeded; i++) {
      // Check if hours[i..i+slotsNeeded-1] are consecutive
      let consecutive = true;
      for (let k = 1; k < slotsNeeded; k++) {
        if (hours[i + k] !== hours[i] + k) { consecutive = false; break; }
      }
      if (!consecutive) continue;

      // Intersect user sets across consecutive hours
      let commonUsers = new Set(hourMap.get(hours[i])!);
      for (let k = 1; k < slotsNeeded; k++) {
        const nextUsers = hourMap.get(hours[i + k])!;
        commonUsers = new Set([...commonUsers].filter(u => nextUsers.has(u)));
      }

      if (commonUsers.size < 1) continue;

      slots.push({
        day,
        start_hour: hours[i],
        duration_hours: durationHours,
        available_users: Array.from(commonUsers),
        overlap_count: commonUsers.size,
      });
    }
  }

  // Sort by overlap desc, then day asc, then hour asc
  slots.sort((a, b) =>
    b.overlap_count - a.overlap_count ||
    a.day - b.day ||
    a.start_hour - b.start_hour
  );

  return slots; // Return ALL slots — no limit
}

/**
 * Build a Google Calendar "create event" URL for a slot.
 * date: a Date object for the next occurrence of that weekday
 */
export function buildGoogleCalendarUrl(
  slot: CommonSlot,
  title: string,
  communityName: string
): string {
  // Find next occurrence of the day
  const now = new Date();
  const todayDay = (now.getDay() + 6) % 7; // convert Sun=0 to Mon=0
  let daysAhead = slot.day - todayDay;
  if (daysAhead <= 0) daysAhead += 7;

  const meetingDate = new Date(now);
  meetingDate.setDate(now.getDate() + daysAhead);

  const startDate = new Date(meetingDate);
  startDate.setHours(slot.start_hour, 0, 0, 0);

  const endDate = new Date(startDate);
  endDate.setTime(startDate.getTime() + slot.duration_hours * 60 * 60 * 1000);

  const fmt = (d: Date) =>
    d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: title || `${communityName} Meeting`,
    dates: `${fmt(startDate)}/${fmt(endDate)}`,
    details: `Scheduled via Smart Scheduler for the ${communityName} club.`,
  });

  return `https://www.google.com/calendar/render?${params.toString()}`;
}
