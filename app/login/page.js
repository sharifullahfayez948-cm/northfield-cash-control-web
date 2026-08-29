"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import CompanyBrand from "@/components/CompanyBrand";
import FayezSignature from "@/components/FayezSignature";

export default function Login() {
  const r = useRouter();

  const [f, setF] = useState({
    username: "",
    password: ""
  });

  const [e, setE] = useState("");

  async function go(x) {
    x.preventDefault();
    setE("");

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify(f)
      });

      const d = await res.json();

      if (res.ok) {
        r.replace("/");
      } else {
        setE(d.error || "Invalid username or password.");
      }
    } catch {
      setE("Something went wrong. Please try again.");
    }
  }

  return (
    <main className="loginPage">
      <form className="loginCard" onSubmit={go}>
        <CompanyBrand />

        <h1>Northfield Cash Control</h1>

        <p>
          Secure access to cash, bank and daily closing control.
        </p>

        {e && (
          <div className="notice error">
            {e}
          </div>
        )}

        <div className="field">
          <label>Username</label>
          <input
            value={f.username}
            onChange={(e) =>
              setF({
                ...f,
                username: e.target.value
              })
            }
            autoComplete="username"
            required
          />
        </div>

        <br />

        <div className="field">
          <label>Password</label>
          <input
            type="password"
            value={f.password}
            onChange={(e) =>
              setF({
                ...f,
                password: e.target.value
              })
            }
            autoComplete="current-password"
            required
          />
        </div>

        <div
          style={{
            textAlign: "right",
            marginTop: "10px",
            marginBottom: "18px"
          }}
        >
          <Link
            href="/forgot-password"
            style={{
              fontSize: "14px",
              fontWeight: "600",
              textDecoration: "none"
            }}
          >
            Forgot password?
          </Link>
        </div>

        <button
          className="btn btnPrimary"
          style={{ width: "100%" }}
          type="submit"
        >
          SIGN IN
        </button>

        <FayezSignature />
      </form>
    </main>
  );
}
