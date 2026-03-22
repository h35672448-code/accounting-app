"use client";

export type ShiftSlot = "morning" | "afternoon" | "emergency";

export type ShiftRecord = {
  id: ShiftSlot;
  label: string;
  time: string;
  nurse: string;
  contact: string;
};

export const NURSE_SHIFT_STORAGE_KEY = "nurse_shift_schedule_v1";
export const NURSE_SHIFT_EVENT = "nurse-shifts-updated";

const DEFAULT_SHIFTS: ShiftRecord[] = [
  {
    id: "morning",
    label: "ช่วงเช้า",
    time: "08:00 - 12:00",
    nurse: "พยาบาลวิลาสินี",
    contact: "ต่อ 108"
  },
  {
    id: "afternoon",
    label: "ช่วงบ่าย",
    time: "12:00 - 16:00",
    nurse: "พยาบาลธนภรณ์",
    contact: "ต่อ 108"
  },
  {
    id: "emergency",
    label: "เวรฉุกเฉิน",
    time: "16:00 - 20:00",
    nurse: "พยาบาลสุจิตรา",
    contact: "ต่อ 118"
  }
];

function isBrowser() {
  return typeof window !== "undefined";
}

function toText(value: unknown) {
  return String(value ?? "").trim();
}

function normalizeShiftRecord(value: unknown, fallback: ShiftRecord): ShiftRecord {
  if (!value || typeof value !== "object") return fallback;
  const row = value as Record<string, unknown>;

  return {
    id: fallback.id,
    label: toText(row.label) || fallback.label,
    time: toText(row.time) || fallback.time,
    nurse: toText(row.nurse) || fallback.nurse,
    contact: toText(row.contact) || fallback.contact
  };
}

export function getDefaultShifts() {
  return DEFAULT_SHIFTS.map((item) => ({ ...item }));
}

export function loadShiftSchedule(): ShiftRecord[] {
  if (!isBrowser()) return getDefaultShifts();

  try {
    const raw = window.localStorage.getItem(NURSE_SHIFT_STORAGE_KEY);
    if (!raw) return getDefaultShifts();

    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return getDefaultShifts();

    return DEFAULT_SHIFTS.map((fallback, index) => normalizeShiftRecord(parsed[index], fallback));
  } catch {
    return getDefaultShifts();
  }
}

export function saveShiftSchedule(records: ShiftRecord[]) {
  if (!isBrowser()) return;

  const normalized = DEFAULT_SHIFTS.map((fallback) => {
    const found = records.find((item) => item.id === fallback.id);
    return normalizeShiftRecord(found, fallback);
  });

  window.localStorage.setItem(NURSE_SHIFT_STORAGE_KEY, JSON.stringify(normalized));
  window.dispatchEvent(new Event(NURSE_SHIFT_EVENT));
}
