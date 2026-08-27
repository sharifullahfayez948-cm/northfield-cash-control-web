import crypto from "crypto";
import { query } from "../../../../lib/db";

const GENERIC_MESSAGE =
  "If the account exists, a verification code has been sent to the registered email.";

function otpHash(code) {
  const secret = process.env.SESSION_SECRET || "change-me-immediately";

  return crypto
    .createHash("sha256")
    .update(`${code}:${secret}`)
    .digest("hex");
}

export async function POST(request) {
  try {
    const body = await request.json();
    const username = String(body?.username || "").trim();

    if (!username) {
      return Response.json(
        { error: "Username is required." },
        { status: 400 }
      );
    }

    const result = await query(
      `
      SELECT id, username, display_name, email, active
      FROM users
      WHERE lower(username) = lower($1)
        AND active = true
      LIMIT 1
      `,
      [username]
    );

    const user = result.rows[0];

    // Do not reveal whether an account exists.
    if (!user || !user.email) {
      return Response.json({
        message: GENERIC_MESSAGE,
      });
    }

    // Basic anti-spam protection:
    // only one OTP request per minute per user.
    const recent = await query(
      `
      SELECT id
      FROM password_reset_otps
      WHERE user_id = $1
        AND created_at > now() - interval '1 minute'
      ORDER BY created_at DESC
      LIMIT 1
      `,
      [user.id]
    );

    if (recent.rows.length > 0) {
      return Response.json(
        {
          error:
            "A verification code was recently sent. Please wait one minute before requesting another.",
        },
        { status: 429 }
      );
    }

    // Invalidate old unused OTPs.
    await query(
      `
      UPDATE password_reset_otps
      SET used_at = now()
      WHERE user_id = $1
        AND used_at IS NULL
      `,
      [user.id]
    );

    const otp = String(
      crypto.randomInt(100000, 1000000)
    );

    const hash = otpHash(otp);

    await query(
      `
      INSERT INTO password_reset_otps
        (user_id, otp_hash, expires_at)
      VALUES
        ($1, $2, now() + interval '10 minutes')
      `,
      [user.id, hash]
    );

    const apiKey = process.env.RESEND_API_KEY;

    if (!apiKey) {
      console.error("RESEND_API_KEY is missing.");

      return Response.json(
        {
          error:
            "Email service is not configured yet.",
        },
        { status: 500 }
      );
    }

    const emailResponse = await fetch(
      "https://api.resend.com/emails",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from:
            process.env.EMAIL_FROM ||
            "Northfield Cash Control <onboarding@resend.dev>",

          to: [user.email],

          subject:
            "Northfield Cash Control - Password Reset Code",

          html: `
            <div style="
              font-family:Arial,sans-serif;
              max-width:520px;
              margin:auto;
              padding:30px;
              color:#0b2942;
            ">
              <h2>Northfield Cash Control</h2>

              <p>Hello ${
                user.display_name ||
                user.username
              },</p>

              <p>
                We received a request to reset your password.
              </p>

              <div style="
                font-size:32px;
                font-weight:700;
                letter-spacing:8px;
                padding:20px;
                margin:24px 0;
                text-align:center;
                background:#f4f6f8;
                border-radius:12px;
              ">
                ${otp}
              </div>

              <p>
                This verification code expires in
                <strong>10 minutes</strong>.
              </p>

              <p>
                If you did not request this reset,
                you can safely ignore this email.
              </p>
            </div>
          `,
        }),
      }
    );

    if (!emailResponse.ok) {
      const emailError =
        await emailResponse.text();

      console.error(
        "Resend error:",
        emailError
      );

      return Response.json(
        {
          error:
            "Unable to send the verification email.",
        },
        { status: 500 }
      );
    }

    return Response.json({
      message: GENERIC_MESSAGE,
    });
  } catch (error) {
    console.error(
      "Forgot password error:",
      error
    );

    return Response.json(
      {
        error:
          "Unable to process the password reset request.",
      },
      { status: 500 }
    );
  }
}
