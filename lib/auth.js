import crypto from "crypto";
import { cookies } from "next/headers";
import { query } from "./db";

const COOKIE = "northfield_session";
const secret = () => process.env.SESSION_SECRET || "change-me-immediately";

export function hashPassword(
  password,
  salt = crypto.randomBytes(16).toString("hex"),
) {
  const digest = crypto
    .pbkdf2Sync(password, salt, 180000, 32, "sha256")
    .toString("hex");
  return `${salt}$${digest}`;
}
export function verifyPassword(password, stored) {
  const [salt, expected] = String(stored || "").split("$");
  if (!salt || !expected) return false;
  const actual = hashPassword(password, salt).split("$")[1];
  try {
    return crypto.timingSafeEqual(
      Buffer.from(actual, "hex"),
      Buffer.from(expected, "hex"),
    );
  } catch {
    return false;
  }
}
function sign(payload) {
  return crypto
    .createHmac("sha256", secret())
    .update(payload)
    .digest("base64url");
}
export function makeSession(user) {
  const payload = Buffer.from(
    JSON.stringify({
      id: user.id,
      username: user.username,
      name: user.display_name,
      role: user.role,
      exp: Date.now() + 1000 * 60 * 60 * 12,
    }),
  ).toString("base64url");
  return `${payload}.${sign(payload)}`;
}
export function parseSession(token) {
  if (!token) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig || sign(payload) !== sig) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString());
    return data.exp > Date.now() ? data : null;
  } catch {
    return null;
  }
}
export async function setSession(user) {
  const jar = await cookies();
  jar.set(COOKIE, makeSession(user), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
}
export async function clearSession() {
  const jar = await cookies();
  jar.delete(COOKIE);
}
export async function currentUser() {
  const jar = await cookies();
  return parseSession(jar.get(COOKIE)?.value);
}
export async function requireUser() {
  const u = await currentUser();
  if (!u) throw new Error("UNAUTHORIZED");
  return u;
}
export const PERMISSION_KEYS = [
  "dashboard",
  "transactions",
  "movements",
  "closing",
  "bank",
  "transfer",
  "reports",
  "directory",
  "attendance",
];
export async function ensurePermissionsSchema() {
  await query(`create table if not exists user_permissions(
    user_id bigint not null references users(id) on delete cascade,
    permission_key text not null,
    allowed boolean not null default false,
    updated_at timestamptz not null default now(),
    primary key(user_id,permission_key)
  )`);
}
export async function accessForUser(user) {
  const full = Object.fromEntries(PERMISSION_KEYS.map((k) => [k, true]));
  if (user?.role === "Super Admin") return full;
  if (user?.role === "Staff")
    return Object.fromEntries(
      PERMISSION_KEYS.map((k) => [k, k === "attendance"]),
    );
  await ensurePermissionsSchema();
  const r = await query(
    "select permission_key,allowed from user_permissions where user_id=$1",
    [user.id],
  );
  if (!r.rows.length)
    return user?.role === "Staff"
      ? Object.fromEntries(PERMISSION_KEYS.map((k) => [k, k === "attendance"]))
      : full;
  return Object.fromEntries(
    PERMISSION_KEYS.map((k) => [
      k,
      r.rows.find((x) => x.permission_key === k)?.allowed === true,
    ]),
  );
}
export async function requirePermission(key) {
  const user = await requireUser();
  const access = await accessForUser(user);
  if (!access[key]) {
    const e = new Error("ACCESS_DENIED");
    e.status = 403;
    throw e;
  }
  return user;
}
export async function requireAnyPermission(keys) {
  const user = await requireUser();
  const access = await accessForUser(user);
  if (!keys.some((key) => access[key])) {
    const e = new Error("ACCESS_DENIED");
    e.status = 403;
    throw e;
  }
  return user;
}
export async function authenticate(username, password) {
  const r = await query(
    "select id,username,display_name,role,password_hash,active from users where lower(username)=lower($1) and active=true limit 1",
    [username],
  );
  const user = r.rows[0];
  return user && verifyPassword(password, user.password_hash) ? user : null;
}
