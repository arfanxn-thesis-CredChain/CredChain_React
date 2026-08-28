/**
 * Format helpers for blockchain identifiers, dates, and other display values.
 */

export function truncateAddress(address: string, lead = 10, tail = 4): string {
  if (!address) return "";
  if (address.length <= lead + tail) return address;
  return `${address.slice(0, lead)}...${address.slice(-tail)}`;
}

export function truncateId(id: string, lead = 10, tail = 4): string {
  return truncateAddress(id, lead, tail);
}

export function truncateHash(hash: string, length = 16): string {
  if (!hash) return "";
  if (hash.length <= length) return hash;
  return `${hash.slice(0, length)}...`;
}

/**
 * YYYY-MM-DD from a Date's *local* parts.
 *
 * Deliberately not `toISOString().slice(0, 10)`: that converts to UTC first, so
 * a date-only value west of Greenwich lands on the previous day.
 */
export function formatISODate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

export function formatDate(value: string | number | Date | null, locale = "en"): string {
  if (!value) return "-";
  const date = new Date(value);
  return new Intl.DateTimeFormat(locale === "id" ? "id-ID" : "en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}

export function formatDateTime(value: string | number | Date | null, locale = "en"): string {
  if (!value) return "-";
  const date = new Date(value);
  return new Intl.DateTimeFormat(locale === "id" ? "id-ID" : "en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function toKebabCase(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/[\s-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function relativeTime(value: string | number | Date, locale = "en"): string {
  const now = Date.now();
  const then = new Date(value).getTime();
  const diffMs = now - then;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHrs = Math.floor(diffMin / 60);

  if (diffMin < 1) return locale === "id" ? "Baru saja" : "Just now";
  if (diffMin < 60) return locale === "id" ? `${diffMin}m lalu` : `${diffMin}m ago`;
  if (diffHrs < 24) return locale === "id" ? `${diffHrs}j lalu` : `${diffHrs}h ago`;
  return formatDate(value, locale);
}
