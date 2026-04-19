"use client";

import { fetchEntity, saveEntity, type StoreRow } from "./storeApi";
import { type ShiftRecord, type ShiftSlot, getDefaultShifts, saveShiftSchedule } from "./shiftSchedule";

const SHIFT_MARKER = "shift_schedule";

function toText(value: unknown) {
  return String(value ?? "").trim();
}

function toNumber(value: unknown, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function isShiftRow(row: StoreRow) {
  const marker = toText(row.type || row.category || row.entity || row.alert_type);
  const id = toText(row.id);
  return marker === SHIFT_MARKER || id.startsWith("shift-");
}

function normalizeShiftSlot(value: unknown, fallback: ShiftSlot): ShiftSlot {
  const raw = toText(value).replace(/^shift-/, "");
  if (raw === "morning" || raw === "afternoon" || raw === "emergency") return raw;
  return fallback;
}

function parseShiftMessage(value: unknown): Partial<ShiftRecord> {
  const raw = toText(value);
  if (!raw) return {};

  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return {
      label: toText(parsed.label),
      time: toText(parsed.time),
      nurse: toText(parsed.nurse),
      contact: toText(parsed.contact)
    };
  } catch {
    return {};
  }
}

function rowToShift(row: StoreRow, fallback: ShiftRecord): ShiftRecord {
  const message = parseShiftMessage(row.message);
  return {
    id: normalizeShiftSlot(row.shift_id || row.status || row.id, fallback.id),
    label: toText(row.label) || message.label || fallback.label,
    time: toText(row.time) || message.time || fallback.time,
    nurse: toText(row.nurse) || message.nurse || fallback.nurse,
    contact: toText(row.contact) || message.contact || fallback.contact
  };
}

function shiftToRow(shift: ShiftRecord, index: number): StoreRow {
  const now = new Date().toISOString();
  const message = JSON.stringify({
    label: shift.label,
    time: shift.time,
    nurse: shift.nurse,
    contact: shift.contact
  });

  return {
    id: `shift-${shift.id}`,
    alert_type: SHIFT_MARKER,
    status: shift.id,
    message,
    visit_id: "",
    medicine_id: "",
    created_at: now,
    resolved_at: now,
    type: SHIFT_MARKER,
    category: SHIFT_MARKER,
    entity: SHIFT_MARKER,
    shift_id: shift.id,
    label: shift.label,
    time: shift.time,
    nurse: shift.nurse,
    contact: shift.contact,
    priority: index + 1,
    updated_at: now
  };
}

export function rowsToShiftSchedule(rows: StoreRow[]) {
  const defaults = getDefaultShifts();
  const shiftRows = rows
    .filter(isShiftRow)
    .sort((a, b) => toNumber(a.priority, 0) - toNumber(b.priority, 0));

  if (shiftRows.length === 0) return null;

  return defaults.map((fallback, index) => {
    const matched = shiftRows.find((row) => normalizeShiftSlot(row.shift_id || row.id, fallback.id) === fallback.id) || shiftRows[index];
    return matched ? rowToShift(matched, fallback) : fallback;
  });
}

export async function fetchShiftScheduleFromStore() {
  const rows = await fetchEntity("alerts");
  const shifts = rowsToShiftSchedule(rows);
  if (shifts) saveShiftSchedule(shifts);
  return shifts;
}

export async function saveShiftScheduleToStore(shifts: ShiftRecord[]) {
  const currentRows = await fetchEntity("alerts").catch(() => []);
  const keepRows = currentRows.filter((row) => !isShiftRow(row));
  const nextRows = [...keepRows, ...shifts.map(shiftToRow)];
  await saveEntity("alerts", nextRows);
  saveShiftSchedule(shifts);
}
