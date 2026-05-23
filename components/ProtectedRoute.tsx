"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../context/AuthContext";
import { StatusMessage } from "./ui/StatusMessage";

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [loading, user, router]);

  // Show loading screen while hydrating from stored token
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg">
        <StatusMessage kind="loading" message="Loading your account…" />
      </div>
    );
  }

  // User not authenticated — blank while redirect fires
  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg">
        <StatusMessage kind="loading" message="Redirecting…" />
      </div>
    );
  }

  return <>{children}</>;
}
