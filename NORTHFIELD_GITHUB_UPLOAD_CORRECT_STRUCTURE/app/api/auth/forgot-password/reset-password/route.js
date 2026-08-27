import crypto from "crypto";
import { query } from "../../../../lib/db";
import { hashPassword } from "../../../../lib/auth";

function otpHash(code) {
  const secret = process.env.SESSION_SECRET || "change-me-immediately";

  return crypto
    .createHash("sha256")
    .update(`${code}:${secret}`)
    .digest("hex");
}

function safeEqual(a, b) {
  try {
    const aa = Buffer.from(String(a), "hex");
    const bb = Buffer.from(String(b), "hex");

    if (aa.length !== bb.length) return false;

    return crypto.timingSafeEqual(aa, bb);
  } catch {
    return false;
  }
}

export async function POST(request) {
  try {
    const body = await request.json();

    const username = String(body?.username || "").trim();
    const otp = String(body?.otp || "").trim();
    const password = String(body?.password || "");

    if (!username || !otp || !password) {
      return Response.json(
        {
          error: "Username, verification code and new password are required.",
        },
        { status: 400 }
      );
    }

    if (!/^\d{6}$/.test(otp)) {
      return Response.json(
        { error: "Verification code must contain 6 digits." },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return Response.json(
        { error: "Password must contain at least 8 characters." },
        { status: 400 }
      );
    }

    const userResult = await query(
      `
      SELECT id, username, active
      FROM users
      WHERE lower(username) = lower($1)
        AND active = true
      LIMIT 1
      `,
      [username]
    );

    const user = userResult.rows[0];

    if (!user) {
      return Response.json(
        { error: "Invalid or expired verification code." },
        { status: 400 }
      );
    }

    const otpResult = await query(
      `
      SELECT id, otp_hash, expires_at
      FROM password_reset_otps
      WHERE user_id = $1
        AND used_at IS NULL
        AND expires_at > now()
      ORDER BY created_at DESC
      LIMIT 1
      `,
      [user.id]
    );

    const reset = otpResult.rows[0];

    if (!reset) {
      return Response.json(
        { error: "Invalid or expired verification code." },
        { status: 400 }
      );
    }

    const suppliedHash = otpHash(otp);

    if (!safeEqual(suppliedHash, reset.otp_hash)) {
      return Response.json(
        { error: "Invalid or expired verification code." },
        { status: 400 }
      );
    }

    const newPasswordHash = hashPassword(password);

    await query(
      `
      UPDATE users
      SET password_hash = $1,
          updated_at = now()
      WHERE id = $2
      `,
      [newPasswordHash, user.id]
    );

    await query(
      `
      UPDATE password_reset_otps
      SET used_at = now()
      WHERE user_id = $1
        AND used_at IS NULL
      `,
      [user.id]
    );

    return Response.json({
      message: "Password changed successfully. You can now sign in.",
    });
  } catch (error) {
    console.error("Reset password error:", error);

    return Response.json(
      { error: "Unable to reset password. Please try again." },
      { status: 500 }
    );
  }
}
