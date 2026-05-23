"use client";

import { useEffect, useState } from "react";
import { apiGet } from "../../lib/api";
import { Card } from "../../components/ui/Card";
import { StatusMessage } from "../../components/ui/StatusMessage";

export default function HealthPage() {
  const [health, setHealth] = useState<unknown>(null);
  const [setup, setSetup] = useState<unknown>(null);
  const [errors, setErrors] = useState<{ health?: string; setup?: string }>({});

  useEffect(() => {
    apiGet("/health")
      .then(setHealth)
      .catch((e: Error) => setErrors((prev) => ({ ...prev, health: e.message })));

    apiGet("/api/v1/setup/required")
      .then(setSetup)
      .catch((e: Error) => setErrors((prev) => ({ ...prev, setup: e.message })));
  }, []);

  return (
    <main className="min-h-screen bg-bg p-6 md:p-10">
      <h1 className="font-display text-2xl font-bold text-fg mb-8">
        Backend connectivity check
      </h1>

      <div className="space-y-4 max-w-2xl">
        <Card title="GET /health">
          {errors.health ? (
            <StatusMessage kind="error" message={errors.health} />
          ) : health === null ? (
            <StatusMessage kind="loading" message="Waiting for response…" />
          ) : (
            <pre className="text-sm text-fg-muted font-mono bg-surface-2 rounded-lg p-4 overflow-x-auto leading-relaxed">
              {JSON.stringify(health, null, 2)}
            </pre>
          )}
        </Card>

        <Card title="GET /api/v1/setup/required">
          {errors.setup ? (
            <StatusMessage kind="error" message={errors.setup} />
          ) : setup === null ? (
            <StatusMessage kind="loading" message="Waiting for response…" />
          ) : (
            <pre className="text-sm text-fg-muted font-mono bg-surface-2 rounded-lg p-4 overflow-x-auto leading-relaxed">
              {JSON.stringify(setup, null, 2)}
            </pre>
          )}
        </Card>
      </div>
    </main>
  );
}
