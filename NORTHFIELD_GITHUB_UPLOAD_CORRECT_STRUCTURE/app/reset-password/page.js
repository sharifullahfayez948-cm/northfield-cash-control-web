"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

export default function ResetPasswordPage() {
  const router = useRouter();
  const params = useSearchParams();

  const initialUsername = params.get("username") || "";

  const [username, setUsername] = useState(initialUsername);
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function resetPassword(e) {
    e.preventDefault();
    setError("");
    setMessage("");

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (password.length < 8) {
      setError("Password must contain at least 8 characters.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          username,
          otp,
          password,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Unable to reset password.");
        return;
      }

      setMessage(
        data.message ||
          "Password changed successfully. Redirecting to sign in..."
      );

      setTimeout(() => {
        router.replace("/login");
      }, 1800);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="loginPage">
      <form className="loginCard" onSubmit={resetPassword}>
        <img
          src="/northfield_logo_clean.png"
          alt="Northfield Veterinary Clinic"
        />

        <h1>Reset Password</h1>

        <p>
          Enter the 6-digit verification code sent to your registered email.
        </p>

        {error && <div className="notice error">{error}</div>}

        {message && <div className="notice">{message}</div>}

        <div className="field">
          <label>Username</label>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            required
          />
        </div>

        <br />

        <div className="field">
          <label>Verification Code</label>
          <input
            value={otp}
            onChange={(e) =>
              setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))
            }
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            required
          />
        </div>

        <br />

        <div className="field">
          <label>New Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            required
          />
        </div>

        <br />

        <div className="field">
          <label>Confirm New Password</label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            autoComplete="new-password"
            required
          />
        </div>

        <br />

        <button
          className="btn btnPrimary"
          style={{ width: "100%" }}
          type="submit"
          disabled={loading}
        >
          {loading ? "RESETTING..." : "RESET PASSWORD"}
        </button>

        <div
          style={{
            textAlign: "center",
            marginTop: "18px",
          }}
        >
          <Link href="/login">Back to Sign In</Link>
        </div>
      </form>
    </main>
  );
}
