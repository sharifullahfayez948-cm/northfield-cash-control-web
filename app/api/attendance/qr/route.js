import QRCode from "qrcode";
import crypto from "crypto";
import { requireUser } from "@/lib/auth";
import { ensureAttendanceSchema } from "@/lib/attendance";
import { query } from "@/lib/db";
import { ok, fail } from "@/lib/api";

export async function GET() {
  try {
    const user = await requireUser();
    if (!["Super Admin", "Manager"].includes(user.role))
      return fail("Manager access required.", 403);
    await ensureAttendanceSchema();
    await query(
      `insert into attendance_site(id,static_token) values(1,$1) on conflict(id) do nothing`,
      [crypto.randomBytes(32).toString("hex")],
    );
    const site = (await query("select * from attendance_site where id=1"))
      .rows[0];
    const token = site.static_token;
    const value = `northfield-attendance:${token}`;
    const image = await QRCode.toDataURL(value, {
      width: 420,
      margin: 2,
      color: { dark: "#08243a", light: "#ffffff" },
      errorCorrectionLevel: "M",
    });
    return ok({ token, value, image, site });
  } catch (e) {
    return fail(e.message, e.message === "UNAUTHORIZED" ? 401 : 500);
  }
}
