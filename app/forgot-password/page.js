"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import CompanyBrand from "@/components/CompanyBrand";

export default function ForgotPassword() {
  const router = useRouter();

  const [username, setUsername] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function sendOtp(e) {
    e.preventDefault();

    setError("");
    setMessage("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ username }),
      });

      const data = await res.json();

      if (res.ok) {
        setMessage(
          data.message || "Verification code has been sent to your email."
        );

        setTimeout(() => {
          router.push(
            `/reset-password?username=${encodeURIComponent(username)}`
          );
        }, 1000);
      } else {
        setError(data.error || "Unable to send verification code.");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="loginPage">
      <form className="loginCard" onSubmit={sendOtp}>
        <CompanyBrand />

        <h1>Reset Password</h1>

        <p>
          Enter your username to receive a verification code.
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

        <button
          className="btn btnPrimary"
          style={{ width: "100%" }}
          type="submit"
          disabled={loading}
        >
          {loading ? "SENDING..." : "SEND OTP"}
        </button>

        <div
          style={{
            textAlign: "center",
            marginTop: "18px",
          }}
        >
          <Link href="/login">
            Back to Sign In
          </Link>
        </div>
      </form>
    </main>
  );
}
