/**
 * Bangkok, Thailand Timezone Utilities (GMT+7)
 * 
 * All timestamp generation in this application uses Bangkok/Thailand timezone
 * Timezone: Asia/Bangkok (GMT+7)
 */

const BANGKOK_TIMEZONE = 'Asia/Bangkok';
const GMT_PLUS_7 = 7;

/**
 * Get current date/time in Bangkok timezone
 */
export function getBangkokTime(): Date {
  const now = new Date();
  // Adjust to GMT+7 (Bangkok timezone)
  return new Date(now.getTime() + (GMT_PLUS_7 * 60 * 60 * 1000) - (now.getTimezoneOffset() * 60 * 1000));
}

/**
 * Format time in Bangkok timezone: YYYY-MM-DD HHmmss (GMT+7)
 * Example: 2026-01-28 062637
 */
export function formatBangkokTime(date?: Date): string {
  const bangkokTime = date || getBangkokTime();
  
  const year = bangkokTime.getUTCFullYear();
  const month = String(bangkokTime.getUTCMonth() + 1).padStart(2, '0');
  const day = String(bangkokTime.getUTCDate()).padStart(2, '0');
  const hours = String(bangkokTime.getUTCHours()).padStart(2, '0');
  const minutes = String(bangkokTime.getUTCMinutes()).padStart(2, '0');
  const seconds = String(bangkokTime.getUTCSeconds()).padStart(2, '0');
  
  return `${year}-${month}-${day} ${hours}${minutes}${seconds}`;
}

/**
 * Format time in Bangkok timezone: YYYY-MM-DD HH:mm:ss (GMT+7)
 * Example: 2026-01-28 06:26:37
 */
export function formatBangkokTimeReadable(date?: Date): string {
  const bangkokTime = date || getBangkokTime();
  
  const year = bangkokTime.getUTCFullYear();
  const month = String(bangkokTime.getUTCMonth() + 1).padStart(2, '0');
  const day = String(bangkokTime.getUTCDate()).padStart(2, '0');
  const hours = String(bangkokTime.getUTCHours()).padStart(2, '0');
  const minutes = String(bangkokTime.getUTCMinutes()).padStart(2, '0');
  const seconds = String(bangkokTime.getUTCSeconds()).padStart(2, '0');
  
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

/**
 * Get localized string for Bangkok timezone
 */
export function getBangkokLocaleString(date?: Date, options?: Intl.DateTimeFormatOptions): string {
  const bangkokTime = date || getBangkokTime();
  return bangkokTime.toLocaleString('en-TH', {
    timeZone: BANGKOK_TIMEZONE,
    ...options,
  });
}

/**
 * Get timezone info: Bangkok/Thailand (GMT+7)
 */
export function getTimezoneInfo(): { name: string; abbreviation: string; offset: number } {
  return {
    name: 'Bangkok, Thailand',
    abbreviation: 'GMT+7',
    offset: GMT_PLUS_7,
  };
}

/**
 * Get current Bangkok time with timezone label
 * Format: YYYY-MM-DD HHmmss (GMT+7)
 */
export function getBangkokTimestamp(): string {
  const bangkokTime = getBangkokTime();
  const formatted = formatBangkokTime(bangkokTime);
  const info = getTimezoneInfo();
  return `${formatted} (${info.abbreviation})`;
}

/**
 * Get current Bangkok time with timezone label (readable format)
 * Format: YYYY-MM-DD HH:mm:ss (GMT+7)
 */
export function getBangkokTimestampReadable(): string {
  const bangkokTime = getBangkokTime();
  const formatted = formatBangkokTimeReadable(bangkokTime);
  const info = getTimezoneInfo();
  return `${formatted} (${info.abbreviation})`;
}
