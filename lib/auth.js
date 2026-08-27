import crypto from "crypto";
import { cookies } from "next/headers";
import { query } from "./db";

const COOKIE="northfield_session";
const secret=()=>process.env.SESSION_SECRET || "change-me-immediately";

export function hashPassword(password, salt=crypto.randomBytes(16).toString("hex")) {
  const digest=crypto.pbkdf2Sync(password, salt, 180000, 32, "sha256").toString("hex");
  return `${salt}$${digest}`;
}
export function verifyPassword(password, stored) {
  const [salt, expected] = String(stored||"").split("$");
  if (!salt || !expected) return false;
  const actual=hashPassword(password,salt).split("$")[1];
  try { return crypto.timingSafeEqual(Buffer.from(actual,"hex"),Buffer.from(expected,"hex")); }
  catch { return false; }
}
function sign(payload) {
  return crypto.createHmac("sha256",secret()).update(payload).digest("base64url");
}
export function makeSession(user) {
  const payload=Buffer.from(JSON.stringify({id:user.id,username:user.username,name:user.display_name,role:user.role,exp:Date.now()+1000*60*60*12})).toString("base64url");
  return `${payload}.${sign(payload)}`;
}
export function parseSession(token) {
  if (!token) return null;
  const [payload,sig]=token.split(".");
  if (!payload || !sig || sign(payload)!==sig) return null;
  try {
    const data=JSON.parse(Buffer.from(payload,"base64url").toString());
    return data.exp>Date.now()?data:null;
  } catch { return null; }
}
export async function setSession(user) {
  const jar=await cookies();
  jar.set(COOKIE,makeSession(user),{httpOnly:true,sameSite:"lax",secure:process.env.NODE_ENV==="production",path:"/",maxAge:60*60*12});
}
export async function clearSession() {
  const jar=await cookies(); jar.delete(COOKIE);
}
export async function currentUser() {
  const jar=await cookies(); return parseSession(jar.get(COOKIE)?.value);
}
export async function requireUser() {
  const u=await currentUser(); if(!u) throw new Error("UNAUTHORIZED"); return u;
}
export async function authenticate(username,password) {
  const r=await query("select id,username,display_name,role,password_hash,active from users where lower(username)=lower($1) and active=true limit 1",[username]);
  const user=r.rows[0];
  return user && verifyPassword(password,user.password_hash)?user:null;
}
