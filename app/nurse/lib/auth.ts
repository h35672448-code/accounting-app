"use client";

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

export function ensureUsersSeed(): NurseUserRecord[] {
  const existing = getStoredUsers();
  if (existing.length > 0) return existing;
  const seeded = defaultUsers();
  saveStoredUsers(seeded);
  return seeded;
}

export function findUserCredential(username: string, password: string): NurseUserRecord | null {
  const users = ensureUsersSeed();
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
