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
  const marker = toText(row.type || row.category || row.entity);
  const id = toText(row.id);
  return marker === SHIFT_MARKER || id.startsWith("shift-");
}

function normalizeShiftSlot(value: unknown, fallback: ShiftSlot): ShiftSlot {
  const raw = toText(value).replace(/^shift-/, "");
  if (raw === "morning" || raw === "afternoon" || raw === "emergency") return raw;
  return fallback;
}

function rowToShift(row: StoreRow, fallback: ShiftRecord): ShiftRecord {
  return {
    id: normalizeShiftSlot(row.shift_id || row.id, fallback.id),
    label: toText(row.label) || fallback.label,
    time: toText(row.time) || fallback.time,
    nurse: toText(row.nurse) || fallback.nurse,
    contact: toText(row.contact) || fallback.contact
  };
}

function shiftToRow(shift: ShiftRecord, index: number): StoreRow {
  const now = new Date().toISOString();
  return {
    id: `shift-${shift.id}`,
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
