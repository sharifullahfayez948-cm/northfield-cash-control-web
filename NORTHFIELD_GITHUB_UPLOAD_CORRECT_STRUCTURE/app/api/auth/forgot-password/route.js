import crypto from "crypto";
import { query } from "../../../../lib/db";

const GENERIC_MESSAGE =
  "If the account exists, a verification code has been sent to the registered email.";

const COMPANY_NAME =
  process.env.COMPANY_NAME || "Northfield Veterinary Clinic";

const COMPANY_LOGO_URL =
  process.env.COMPANY_LOGO_URL || "";

function otpHash(code) {
  const secret =
    process.env.SESSION_SECRET || "change-me-immediately";

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

    // Never reveal whether the account exists.
    if (!user || !user.email) {
      return Response.json({
        message: GENERIC_MESSAGE,
      });
    }

    // Prevent repeated OTP requests.
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

    // Invalidate previous unused OTP codes.
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

    const logoHtml = COMPANY_LOGO_URL
      ? `
        <div style="text-align:center;margin-bottom:18px;">
          <img
            src="${COMPANY_LOGO_URL}"
            alt="${COMPANY_NAME}"
            style="
              max-width:180px;
              max-height:90px;
              object-fit:contain;
              display:inline-block;
            "
          />
        </div>
      `
      : "";

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
            `${COMPANY_NAME} <onboarding@resend.dev>`,

          to: [user.email],

          subject: `${COMPANY_NAME} - Password Reset Code`,

          html: `
            <div style="
              background:#f5f6f7;
              padding:35px 15px;
              font-family:Arial,sans-serif;
            ">

              <div style="
                max-width:520px;
                margin:0 auto;
                background:#ffffff;
                border-radius:16px;
                padding:36px 30px;
                box-shadow:0 8px 30px rgba(0,0,0,0.08);
                color:#102b3f;
              ">

                ${logoHtml}

                <div style="
                  text-align:center;
                  margin-bottom:28px;
                ">
                  <h2 style="
                    margin:0;
                    color:#0b2942;
                    font-size:24px;
                  ">
                    ${COMPANY_NAME}
                  </h2>

                  <p style="
                    margin:7px 0 0;
                    color:#8a6a28;
                    font-size:13px;
                    letter-spacing:1px;
                    text-transform:uppercase;
                  ">
                    Secure Password Recovery
                  </p>
                </div>

                <p style="
                  font-size:16px;
                  line-height:1.6;
                ">
                  Hello ${
                    user.display_name ||
                    user.username
                  },
                </p>

                <p style="
                  font-size:15px;
                  line-height:1.7;
                  color:#475569;
                ">
                  We received a request to reset your password.
                  Use the verification code below to continue.
                </p>

                <div style="
                  margin:28px 0;
                  padding:22px 15px;
                  text-align:center;
                  background:#f7f3e8;
                  border:1px solid #e5d8b7;
                  border-radius:14px;
                ">

                  <div style="
                    font-size:12px;
                    color:#7a6843;
                    text-transform:uppercase;
                    letter-spacing:1.5px;
                    margin-bottom:10px;
                  ">
                    Verification Code
                  </div>

                  <div style="
                    font-size:36px;
                    font-weight:800;
                    letter-spacing:10px;
                    color:#0b2942;
                  ">
                    ${otp}
                  </div>

                </div>

                <p style="
                  font-size:14px;
                  line-height:1.7;
                  color:#475569;
                ">
                  This verification code expires in
                  <strong>10 minutes</strong>.
                </p>

                <p style="
                  font-size:14px;
                  line-height:1.7;
                  color:#64748b;
                ">
                  If you did not request a password reset,
                  you can safely ignore this email.
                </p>

                <div style="
                  height:1px;
                  background:#e8eaed;
                  margin:30px 0 20px;
                "></div>

                <p style="
                  margin:0;
                  text-align:center;
                  font-size:12px;
                  color:#94a3b8;
                ">
                  ${COMPANY_NAME}<br/>
                  Automated security notification
                </p>

              </div>
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
