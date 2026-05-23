"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "../../context/AuthContext";
import { apiAuthGet, UnauthorizedError } from "../../lib/api";
import { useApiData } from "../../lib/useApiData";
import { ProtectedRoute } from "../../components/ProtectedRoute";
import { AppShell } from "../../components/AppShell";
import { StatusMessage } from "../../components/ui/StatusMessage";
import { Money } from "../../components/ui/Money";

/* ── Types ─────────────────────────────────────────────────────────── */

interface UserMonthBreakdown {
  id: number;
  name: string;
  rent_owed: string;
  utility_owed: string;
  household_owed: string;
  personal_owed: string;
  meal_owed: string;
  settlement_owed: string;
  total_paid: string;
  settlement_balance: string;
  total_owed: string;
  balance: string;
}

interface MonthSummary {
  month_id: string;
  household_id: number;
  status: string;
  meal_pool: string;
  total_meals: string;
  cost_per_meal: string;
  users: UserMonthBreakdown[];
}

/* ── Helpers ──────────────────────────────────────────────────────── */

function currentMonthId(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function priorMonths(n: number): string[] {
  const months: string[] = [];
  const now = new Date();
  for (let i = 1; i <= n; i++) {
    const d = new Date(Date.UTC(now.getFullYear(), now.getMonth() - i, 1));
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return months;
}

function formatMonthId(m: string): string {
  const [y, mo] = m.split("-");
  return new Date(Date.UTC(+y, +mo - 1, 1)).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    timeZone: "UTC",
  });
}

function balanceVariant(v: string): "positive" | "negative" | "default" {
  const t = v.trim();
  if (t.startsWith("-")) return "negative";
  if (t === "0.00" || t === "0") return "default";
  return "positive";
}

/* ── Page shell ────────────────────────────────────────────────────── */

export default function MonthsPage() {
  return (
    <ProtectedRoute>
      <MonthsContent />
    </ProtectedRoute>
  );
}

/* ── Main content ──────────────────────────────────────────────────── */

function MonthsContent() {
  const { user, logout } = useAuth();
  const thisMonth = currentMonthId();
  const [prior] = useState(() => priorMonths(11));

  const {
    data: summary,
    loading: summaryLoading,
    error: summaryError,
  } = useApiData<MonthSummary>(`/api/v1/months/${thisMonth}/summary`);

  const [priorSummaries, setPriorSummaries] = useState<(MonthSummary | null)[]>(
    () => prior.map(() => null)
  );
  const [priorError, setPriorError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setPriorError(null);

    Promise.all(
      prior.map((m) =>
        apiAuthGet<MonthSummary>(`/api/v1/months/${m}/summary`).catch((e: unknown): MonthSummary => {
          if (e instanceof UnauthorizedError) logout();
          return { month_id: m, household_id: 0, status: "open", meal_pool: "0.00", total_meals: "0", cost_per_meal: "0.00", users: [] };
        })
      )
    )
      .then((results) => {
        if (!cancelled) setPriorSummaries(results);
      })
      .catch(() => {
        if (!cancelled) setPriorError("Failed to load month statuses.");
      });

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const myBreakdown = user ? (summary?.users.find((u) => u.id === user.id) ?? null) : null;

  return (
    <AppShell>
      <div className="p-6 md:p-8 max-w-4xl">

        {/* Page header */}
        <div className="mb-6 animate-fade-up">
          <h1 className="font-display text-2xl font-bold text-fg tracking-tight">Months</h1>
          <p className="text-sm text-fg-muted mt-0.5">Monthly expense summaries &amp; settlements</p>
        </div>

        {/* Current month hero card */}
        <div className="mb-8 animate-fade-up delay-75">
          <div
            className="rounded-xl bg-surface-1 border border-border p-6"
            style={{ boxShadow: "var(--shadow-card)" }}
          >
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <p className="text-xs font-semibold text-fg-muted uppercase tracking-wider mb-0.5">
                  Current Month
                </p>
                <p className="font-display text-xl font-bold text-fg">{formatMonthId(thisMonth)}</p>
              </div>
              <Link
                href={`/months/${thisMonth}`}
                className="text-xs text-fg-muted hover:text-accent transition-colors shrink-0"
              >
                View detail →
              </Link>
            </div>

            {summaryLoading && !summary && (
              <p className="text-sm text-fg-muted">Loading…</p>
            )}
            {summaryError && (
              <p className="text-sm text-danger">{summaryError}</p>
            )}
            {!summaryLoading && !summaryError && summary && summary.users.length === 0 && (
              <p className="text-sm text-fg-muted">No active members this month.</p>
            )}

            {myBreakdown && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-xs text-fg-muted mb-1">Settlement Balance</p>
                  <Money
                    amount={myBreakdown.settlement_balance}
                    variant={balanceVariant(myBreakdown.settlement_balance)}
                    size="lg"
                  />
                </div>
                <div>
                  <p className="text-xs text-fg-muted mb-1">Total Owed</p>
                  <Money amount={myBreakdown.total_owed} size="lg" />
                </div>
                <div>
                  <p className="text-xs text-fg-muted mb-1">You Paid</p>
                  <Money amount={myBreakdown.total_paid} size="lg" />
                </div>
                <div>
                  <p className="text-xs text-fg-muted mb-1">Rent Owed</p>
                  <Money amount={myBreakdown.rent_owed} size="lg" />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Prior months grid */}
        <div className="animate-fade-up delay-100">
          <h2 className="text-sm font-semibold text-fg-muted uppercase tracking-wider mb-3">
            Prior Months
          </h2>
          {priorError && <StatusMessage kind="error" message={priorError} />}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {prior.map((m, i) => {
              const s = priorSummaries[i];
              const isClosed = s?.status === "closed";
              const statusLabel = s === null ? "Loading…" : isClosed ? "Closed" : "Open";
              return (
                <Link key={m} href={`/months/${m}`} className="group">
                  <div
                    className="rounded-xl bg-surface-1 border border-border p-4 h-full transition-colors group-hover:border-accent/40"
                    style={{ boxShadow: "var(--shadow-card)" }}
                  >
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <p className="font-display text-sm font-semibold text-fg">
                        {formatMonthId(m)}
                      </p>
                      <span
                        className={[
                          "text-xs px-2 py-0.5 rounded-full font-medium shrink-0",
                          s === null
                            ? "bg-surface-2 text-fg-muted"
                            : isClosed
                            ? "bg-success/10 text-success"
                            : "bg-accent/10 text-accent",
                        ].join(" ")}
                      >
                        {statusLabel}
                      </span>
                    </div>
                    <p className="text-xs text-fg-muted group-hover:text-accent transition-colors">
                      View summary →
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

      </div>
    </AppShell>
  );
}
