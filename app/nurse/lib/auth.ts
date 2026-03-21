"use client";

import { fetchEntity, saveEntity, type StoreRow } from "./storeApi";

export type NurseRole = "admin" | "user";

export type NurseUserRecord = {
  id: number;
  username: string;
  password: string;
  role: NurseRole;
  createdAt: string;
};

export type NurseSession = {
  username: string;
  role: NurseRole;
  loginAt: string;
};

export const NURSE_USERS_STORAGE_KEY = "nurse_users";
export const NURSE_SESSION_STORAGE_KEY = "nurse_current_user";

function isBrowser() {
  return typeof window !== "undefined";
}

function isRole(value: unknown): value is NurseRole {
  return value === "admin" || value === "user";
}

function defaultUsers(): NurseUserRecord[] {
  return [
    {
      id: 1,
      username: "admin",
      password: "admin1234",
      role: "admin",
      createdAt: new Date().toISOString()
    }
  ];
}

function toNumber(value: unknown, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toText(value: unknown) {
  return String(value ?? "").trim();
}

function normalizeStoreUser(row: StoreRow, index: number): NurseUserRecord | null {
  const username = toText(row.username);
  if (!username) return null;

  const fallbackPassword = username.toLowerCase() === "admin" ? "admin1234" : "";
  const password = toText(row.password) || fallbackPassword;
  if (!password) return null;

  return {
    id: toNumber(row.id, index + 1),
    username,
    password,
    role: isRole(row.role) ? row.role : "user",
    createdAt: toText(row.createdAt || row.created_at) || new Date().toISOString()
  };
}

function userToStoreRow(user: NurseUserRecord): StoreRow {
  const now = new Date().toISOString();
  return {
    id: user.id,
    username: user.username,
    password: user.password,
    role: user.role,
    is_active: 1,
    createdAt: user.createdAt,
    created_at: user.createdAt,
    updated_at: now
  };
}

export function getStoredUsers(): NurseUserRecord[] {
  if (!isBrowser()) return defaultUsers();

  try {
    const raw = window.localStorage.getItem(NURSE_USERS_STORAGE_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
      .map((item, index) => ({
        id: Number(item.id) || index + 1,
        username: String(item.username || "").trim(),
        password: String(item.password || ""),
        role: isRole(item.role) ? item.role : "user",
        createdAt: String(item.createdAt || "")
      }))
      .filter((item) => item.username !== "" && item.password !== "");
  } catch {
    return [];
  }
}

export function saveStoredUsers(users: NurseUserRecord[]) {
  if (!isBrowser()) return;
  window.localStorage.setItem(NURSE_USERS_STORAGE_KEY, JSON.stringify(users));
}

export async function saveUsersToStore(users: NurseUserRecord[]) {
  saveStoredUsers(users);
  await saveEntity(
    "users",
    users.map(userToStoreRow)
  );
}

export async function loadUsersFromStore(): Promise<NurseUserRecord[]> {
  const cachedUsers = getStoredUsers();

  try {
    const rows = await fetchEntity("users");
    const users = rows
      .map((row, index) => normalizeStoreUser(row, index))
      .filter((row): row is NurseUserRecord => row !== null);

    if (users.length > 0) {
      saveStoredUsers(users);
      return users;
    }
  } catch {
    if (cachedUsers.length > 0) {
      return cachedUsers;
    }
  }

  if (cachedUsers.length > 0) {
    return cachedUsers;
  }

  const seeded = defaultUsers();
  saveStoredUsers(seeded);

  try {
    await saveUsersToStore(seeded);
  } catch {
    // Keep local seed so login still works if the API is temporarily unavailable.
  }

  return seeded;
}

export async function ensureUsersSeed(): Promise<NurseUserRecord[]> {
  return loadUsersFromStore();
}

export async function findUserCredential(username: string, password: string): Promise<NurseUserRecord | null> {
  const users = await ensureUsersSeed();
  const targetUsername = username.trim().toLowerCase();
  const targetPassword = password.trim();
  return users.find((user) => user.username.toLowerCase() === targetUsername && user.password === targetPassword) || null;
}

export function setCurrentSession(session: NurseSession) {
  if (!isBrowser()) return;
  window.localStorage.setItem(NURSE_SESSION_STORAGE_KEY, JSON.stringify(session));
}

export function clearCurrentSession() {
  if (!isBrowser()) return;
  window.localStorage.removeItem(NURSE_SESSION_STORAGE_KEY);
}

export function getCurrentSession(): NurseSession | null {
  if (!isBrowser()) return null;
  try {
    const raw = window.localStorage.getItem(NURSE_SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { username?: unknown; role?: unknown; loginAt?: unknown };
    const username = String(parsed.username || "").trim();
    if (!username || !isRole(parsed.role)) return null;
    return {
      username,
      role: parsed.role,
      loginAt: String(parsed.loginAt || "")
    };
  } catch {
    return null;
  }
}

export function getCurrentRole(): NurseRole | "guest" {
  const session = getCurrentSession();
  return session?.role || "guest";
}
