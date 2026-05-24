"use client";

import { Suspense, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { apiPost } from "../../lib/api";
import { Logo } from "../../components/Logo";
import { Card } from "../../components/ui/Card";
import { Input } from "../../components/ui/Input";
import { Button } from "../../components/ui/Button";

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token") ?? "";

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [tokenExpired, setTokenExpired] = useState(false);
  const [successRedirecting, setSuccessRedirecting] = useState(false);

  if (token.length < 32) {
    return (
      <Card title="Reset password">
        <p className="text-sm text-danger pt-1 pb-4">
          This reset link is invalid or incomplete. Please request a new one.
        </p>
        <Link
          href="/forgot-password"
          className="text-sm text-accent hover:underline"
        >
          Request a new reset link
        </Link>
      </Card>
    );
  }

  if (successRedirecting) {
    return (
      <Card title="Reset password">
        <p className="text-sm text-success pt-1">
          Password reset successfully. Redirecting to login…
        </p>
      </Card>
    );
  }

  async function handleSubmit(e: { preventDefault(): void }): Promise<void> {
    e.preventDefault();

    if (newPassword.length < 8) {
      setErrorMessage("Password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMessage("Passwords do not match.");
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    try {
      await apiPost("/api/v1/auth/reset-password", {
        token,
        new_password: newPassword,
      });
      setSuccessRedirecting(true);
      setTimeout(() => router.push("/login?reset=success"), 1500);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("400")) {
        setTokenExpired(true);
        setErrorMessage("Invalid or expired reset token.");
      } else {
        setErrorMessage("Could not reach the server. Please try again.");
      }
      setIsLoading(false);
    }
  }

  return (
    <Card title="Reset password">
      <form onSubmit={handleSubmit} className="space-y-4 pt-1">
        <Input
          label="New password"
          type="password"
          required
          minLength={8}
          maxLength={128}
          value={newPassword}
          onChange={(e) => {
            setNewPassword(e.target.value);
            setErrorMessage(null);
          }}
          disabled={isLoading}
          autoComplete="new-password"
        />
        <Input
          label="Confirm new password"
          type="password"
          required
          minLength={8}
          value={confirmPassword}
          onChange={(e) => {
            setConfirmPassword(e.target.value);
            setErrorMessage(null);
          }}
          disabled={isLoading}
          autoComplete="new-password"
        />
        {errorMessage && (
          <div>
            <p className="text-sm text-danger">{errorMessage}</p>
            {tokenExpired && (
              <Link
                href="/forgot-password"
                className="mt-1 inline-block text-xs text-accent hover:underline"
              >
                Request a new reset link
              </Link>
            )}
          </div>
        )}
        <Button
          type="submit"
          loading={isLoading}
          aria-busy={isLoading}
          className="w-full"
        >
          {isLoading ? "Resetting…" : "Reset password"}
        </Button>
      </form>
    </Card>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-bg px-4 py-12">
      <div className="w-full max-w-md animate-fade-up">
        <div className="flex justify-center mb-8">
          <Logo size="md" tagline />
        </div>
        <Suspense
          fallback={
            <Card title="Reset password">
              <div className="py-4" />
            </Card>
          }
        >
          <ResetPasswordForm />
        </Suspense>
      </div>
    </div>
  );
}
