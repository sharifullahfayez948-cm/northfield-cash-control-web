import QRCode from "qrcode";
import { requireUser } from "@/lib/auth";
import { makeAttendanceToken } from "@/lib/attendance";
import { ok, fail } from "@/lib/api";

export async function GET() {
  try {
    const user = await requireUser();
    if (!["Super Admin", "Manager"].includes(user.role))
      return fail("Manager access required.", 403);
    const token = makeAttendanceToken();
    const value = `northfield-attendance:${token}`;
    const image = await QRCode.toDataURL(value, {
      width: 420,
      margin: 2,
      color: { dark: "#08243a", light: "#ffffff" },
      errorCorrectionLevel: "M",
    });
    return ok({ token, value, image, expiresIn: 45 });
  } catch (e) {
    return fail(e.message, e.message === "UNAUTHORIZED" ? 401 : 500);
  }
}
