"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "../../context/AuthContext";
import { Logo } from "../../components/Logo";
import { Card } from "../../components/ui/Card";
import { Input } from "../../components/ui/Input";
import { Button } from "../../components/ui/Button";

function LoginForm() {
  const { login } = useAuth();
  const searchParams = useSearchParams();
  const resetSuccess = searchParams.get("reset") === "success";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showResetBanner, setShowResetBanner] = useState(resetSuccess);

  async function handleSubmit(e: { preventDefault(): void }): Promise<void> {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
      // login() navigates away on success — no setLoading(false) needed
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("401")) {
        setError("Invalid email or password.");
      } else if (msg.includes("422")) {
        setError("Please enter a valid email and password.");
      } else {
        setError(msg);
      }
      setLoading(false);
    }
  }

  return (
    <Card title="Sign in">
      {showResetBanner && (
        <div className="mt-1 mb-3 rounded-lg bg-success/10 border border-success/30 px-4 py-3 text-sm text-success">
          Password reset successfully. Log in with your new password.
        </div>
      )}
      <form onSubmit={handleSubmit} className="space-y-4 pt-1">
        <Input
          label="Email"
          type="email"
          required
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setShowResetBanner(false);
          }}
          disabled={loading}
          autoComplete="email"
        />
        <div>
          <Input
            label="Password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading}
            autoComplete="current-password"
          />
          <div className="flex justify-end mt-1.5">
            <Link
              href="/forgot-password"
              className="text-xs text-fg-muted hover:text-fg"
            >
              Forgot password?
            </Link>
          </div>
        </div>
        {error && <p className="text-sm text-danger">{error}</p>}
        <Button type="submit" loading={loading} className="w-full">
          {loading ? "Signing in…" : "Sign in"}
        </Button>
      </form>
    </Card>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-bg px-4 py-12">
      <div className="w-full max-w-md animate-fade-up">
        <div className="flex justify-center mb-8">
          <Logo size="md" tagline />
        </div>
        <Suspense
          fallback={
            <Card title="Sign in">
              <div className="py-6" />
            </Card>
          }
        >
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
