"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiGet } from "../lib/api";
import { StatusMessage } from "../components/ui/StatusMessage";

type SetupRequired = { required: boolean };

export default function HomePage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);

  function runCheck() {
    setChecking(true);
    setError(null);
    apiGet<SetupRequired>("/api/v1/setup/required")
      .then(({ required }) => {
        router.push(required ? "/setup" : "/login");
      })
      .catch((e: Error) => {
        setError(e.message);
        setChecking(false);
      });
  }

  useEffect(() => {
    runCheck();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen bg-bg flex flex-col items-center justify-center gap-8 px-4">

      {/* Brand mark */}
      <div className="text-center animate-fade-up">
        <div className="inline-flex items-center justify-center size-16 rounded-2xl bg-accent/10 border border-accent/25 mb-6 glow-sm">
          <span className="font-display text-2xl font-bold text-accent text-glow select-none">
            ৳
          </span>
        </div>
        <h1 className="font-display text-3xl font-bold text-fg tracking-tight">
          Household Expenses
        </h1>
        <p className="mt-2 text-sm text-fg-muted">
          Track and manage shared expenses together.
        </p>
      </div>

      {/* Connection status */}
      <div className="animate-fade-up delay-150 w-full max-w-xs">
        {checking && !error && (
          <StatusMessage
            kind="loading"
            message="Connecting to server — first load may take up to 60 seconds…"
          />
        )}
        {error && (
          <StatusMessage
            kind="error"
            message={error}
            onRetry={runCheck}
          />
        )}
      </div>

    </div>
  );
}
