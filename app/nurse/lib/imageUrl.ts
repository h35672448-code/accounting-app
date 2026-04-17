"use client";

const DRIVE_FILE_ID_PATTERNS = [
  /drive\.google\.com\/file\/d\/([^/?#]+)/i,
  /drive\.google\.com\/open\?id=([^&#]+)/i,
  /drive\.google\.com\/uc\?(?:[^#]*&)?id=([^&#]+)/i,
  /[?&]id=([^&#]+)/i
];

export function resolveImageUrl(value: unknown, fallback = "/logo.png") {
  const raw = String(value ?? "").trim();
  if (!raw) return fallback;
  if (raw.startsWith("/") || raw.startsWith("data:")) return raw;

  for (const pattern of DRIVE_FILE_ID_PATTERNS) {
    const match = raw.match(pattern);
    if (match?.[1]) {
      return `https://drive.google.com/thumbnail?id=${encodeURIComponent(match[1])}&sz=w1200`;
    }
  }

  return raw;
}
