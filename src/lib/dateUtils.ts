export const THAI_MONTHS = [
  'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
  'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'
];

export const THAI_MONTHS_FULL = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
];

export function getOrderDate(order: any): Date | null {
  if (!order) return null;
  const val = order.created_at || order.completed_at;
  if (!val) return null;
  if (typeof val === 'object' && typeof val.seconds === 'number') {
    return new Date(val.seconds * 1000);
  }
  if (typeof val === 'string') {
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d;
  }
  if (val instanceof Date) return val;
  return null;
}

export function isSameDay(d1: Date, d2: Date): boolean {
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
}

export function isSameMonth(d1: Date, d2: Date): boolean {
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth()
  );
}

export function isSameYear(d1: Date, d2: Date): boolean {
  return d1.getFullYear() === d2.getFullYear();
}

/**
 * Returns Monday 00:00:00 to Sunday 23:59:59 for any given date
 */
export function getWeekRange(refDate: Date = new Date()): { start: Date; end: Date } {
  const d = new Date(refDate);
  const day = d.getDay(); // 0 is Sunday, 1 is Monday, ... 6 is Saturday
  // Diff to Monday: if day === 0 (Sunday), diff is -6 days. Otherwise 1 - day.
  const diffToMonday = day === 0 ? -6 : 1 - day;

  const monday = new Date(d);
  monday.setDate(d.getDate() + diffToMonday);
  monday.setHours(0, 0, 0, 0);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);

  return { start: monday, end: sunday };
}

/**
 * Generates an ISO week cycle ID like '2026-W37'
 */
export function getCycleId(refDate: Date = new Date()): string {
  const { start } = getWeekRange(refDate);
  const year = start.getFullYear();
  // Approximate week number
  const firstDayOfYear = new Date(year, 0, 1);
  const pastDaysOfYear = (start.getTime() - firstDayOfYear.getTime()) / 86400000;
  const weekNum = Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
  return `${year}-W${String(weekNum).padStart(2, '0')}`;
}

export function formatThaiDate(date: Date, includeYear = true): string {
  const day = date.getDate();
  const month = THAI_MONTHS[date.getMonth()];
  const year = date.getFullYear() + 543; // Buddhist Era
  return includeYear ? `${day} ${month} ${year}` : `${day} ${month}`;
}

export function formatThaiDateWithTime(date: Date): string {
  const datePart = formatThaiDate(date, true);
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${datePart} ${hours}:${minutes} น.`;
}

export function formatCycleLabel(weekStart: Date, weekEnd: Date): string {
  const startDay = weekStart.getDate();
  const startMonth = THAI_MONTHS[weekStart.getMonth()];
  const endDay = weekEnd.getDate();
  const endMonth = THAI_MONTHS[weekEnd.getMonth()];
  const year = weekEnd.getFullYear() + 543;

  if (startMonth === endMonth) {
    return `รอบ ${startDay} - ${endDay} ${endMonth} ${year}`;
  }
  return `รอบ ${startDay} ${startMonth} - ${endDay} ${endMonth} ${year}`;
}
