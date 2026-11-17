// Offline sign-in for devices that already signed in online once.
// Stores only a salted PBKDF2 hash of email+password, never the password.
const KEY = "hr-offline-cred";
export const OFFLINE_FLAG = "hr-offline-auth";

async function hash(email: string, password: string, salt: string) {
  const enc = new TextEncoder();
  const base = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt: enc.encode(salt + email.trim().toLowerCase()), iterations: 100000, hash: "SHA-256" }, base, 256);
  return btoa(String.fromCharCode(...new Uint8Array(bits)));
}

export async function rememberOfflineLogin(email: string, password: string) {
  const salt = crypto.randomUUID();
  localStorage.setItem(KEY, JSON.stringify({ salt, h: await hash(email, password, salt) }));
}

export async function checkOfflineLogin(email: string, password: string) {
  const raw = localStorage.getItem(KEY);
  if (!raw) return false;
  const { salt, h } = JSON.parse(raw);
  return (await hash(email, password, salt)) === h;
}

export function isOfflineAuthed() {
  try { return sessionStorage.getItem(OFFLINE_FLAG) === "1"; } catch { return false; }
}
