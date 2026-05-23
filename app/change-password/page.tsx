"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../context/AuthContext";
import { apiAuthPost, UnauthorizedError } from "../../lib/api";
import { Logo } from "../../components/Logo";
import { Card } from "../../components/ui/Card";
import { Input } from "../../components/ui/Input";
import { Button } from "../../components/ui/Button";
import type { UserResponse } from "../../context/AuthContext";

export default function ChangePasswordPage() {
  const router = useRouter();
  const { logout } = useAuth();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: { preventDefault(): void }): Promise<void> {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await apiAuthPost<UserResponse>("/api/v1/auth/change-password", {
        current_password: currentPassword,
        new_password: newPassword,
      });
      router.push("/dashboard");
    } catch (err: unknown) {
      if (err instanceof UnauthorizedError) {
        logout();
        return;
      }
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("422")) {
        setError("Please check your input — both fields are required.");
      } else {
        setError(msg);
      }
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg px-4 py-12">
      <div className="w-full max-w-md animate-fade-up">
        <div className="flex justify-center mb-8">
          <Logo size="md" tagline />
        </div>
        <Card title="Change your password">
          <p className="text-sm text-fg-muted pt-1 pb-3">
            Your account requires a password change before continuing.
          </p>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Current Password"
              type="password"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              disabled={loading}
              autoComplete="current-password"
            />
            <Input
              label="New Password"
              type="password"
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              disabled={loading}
              autoComplete="new-password"
            />
            {error && <p className="text-sm text-danger">{error}</p>}
            <Button type="submit" loading={loading} className="w-full">
              {loading ? "Updating password…" : "Update Password"}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
