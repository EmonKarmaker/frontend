"use client";

import { useState } from "react";
import Link from "next/link";
import { apiPost } from "../../lib/api";
import { Logo } from "../../components/Logo";
import { Card } from "../../components/ui/Card";
import { Input } from "../../components/ui/Input";
import { Button } from "../../components/ui/Button";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [submittedMessage, setSubmittedMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(e: { preventDefault(): void }): Promise<void> {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const data = await apiPost<{ message: string }>(
        "/api/v1/auth/forgot-password",
        { email: email.trim() }
      );
      setSubmittedMessage(
        data.message ??
          "If an account with that email exists, a reset link has been sent."
      );
    } catch {
      setErrorMessage("Could not reach the server. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg px-4 py-12">
      <div className="w-full max-w-md animate-fade-up">
        <div className="flex justify-center mb-8">
          <Logo size="md" tagline />
        </div>
        {submittedMessage ? (
          <Card title="Check your inbox">
            <p className="text-sm text-fg-muted pt-1 pb-4">{submittedMessage}</p>
            <Link href="/login" className="text-sm text-accent hover:underline">
              Back to login
            </Link>
          </Card>
        ) : (
          <Card title="Forgot password">
            <p className="text-sm text-fg-muted pt-1 pb-3">
              Enter your email and we&apos;ll send you a link to reset your
              password.
            </p>
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                label="Email"
                type="email"
                required
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading}
                autoComplete="email"
              />
              {errorMessage && (
                <p className="text-sm text-danger">{errorMessage}</p>
              )}
              <Button
                type="submit"
                loading={isLoading}
                aria-busy={isLoading}
                className="w-full"
              >
                {isLoading ? "Sending…" : "Send reset link"}
              </Button>
            </form>
            <p className="mt-4 text-sm text-fg-muted">
              Remember your password?{" "}
              <Link href="/login" className="text-accent hover:underline">
                Log in
              </Link>
            </p>
          </Card>
        )}
      </div>
    </div>
  );
}
