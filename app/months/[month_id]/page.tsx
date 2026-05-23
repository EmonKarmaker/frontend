"use client";

// Sign convention (from settlement service):
//   settlement_balance = total_paid − settlement_owed
//   Positive → creditor (paid more than their share; pool owes them)
//   Negative → debtor   (paid less than their share; they owe the pool)

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useAuth } from "../../../context/AuthContext";
import { apiAuthPost, apiAuthPatch, UnauthorizedError } from "../../../lib/api";
import { useApiData } from "../../../lib/useApiData";
import { addDecimalStrings } from "../../../lib/money";
import { ProtectedRoute } from "../../../components/ProtectedRoute";
import { AppShell } from "../../../components/AppShell";
import { StatusMessage } from "../../../components/ui/StatusMessage";
import { Button } from "../../../components/ui/Button";
import { Money } from "../../../components/ui/Money";

/* ── Types ─────────────────────────────────────────────────────────── */

interface UserMini { id: number; name: string; }

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

interface SettlementResponse {
  id: number;
  month_id: string;
  from_user: UserMini;
  to_user: UserMini;
  amount: string;
  paid: boolean;
  paid_at: string | null;
  paid_marked_by: UserMini | null;
  created_at: string;
}

/* ── Helpers ──────────────────────────────────────────────────────── */

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

function extractErrorMessage(rawMsg: string): string {
  const jsonMatch = rawMsg.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      if (typeof parsed.detail === "string") return parsed.detail;
    } catch {}
  }
  return rawMsg;
}

function centsFromDecStr(s: string): bigint {
  const t = s.trim();
  const neg = t.startsWith("-");
  const abs = neg ? t.slice(1) : t;
  const [intStr = "0", fracStr = ""] = abs.split(".");
  const cents = BigInt(intStr) * 100n + BigInt((fracStr + "00").slice(0, 2));
  return neg ? -cents : cents;
}

/* ── Page shell ────────────────────────────────────────────────────── */

export default function MonthDetailPage() {
  return (
    <ProtectedRoute>
      <MonthDetailContent />
    </ProtectedRoute>
  );
}

/* ── Main content ──────────────────────────────────────────────────── */

function MonthDetailContent() {
  const params = useParams();
  const monthId = (params?.month_id as string) ?? "";
  const { user, logout } = useAuth();
  const isAdmin = user?.is_admin ?? false;

  const {
    data: summary,
    loading: summaryLoading,
    error: summaryError,
    reload: reloadSummary,
  } = useApiData<MonthSummary>(monthId ? `/api/v1/months/${monthId}/summary` : "");

  const {
    data: settlements,
    error: settlementsError,
    reload: reloadSettlements,
  } = useApiData<SettlementResponse[]>(monthId ? `/api/v1/months/${monthId}/settlements` : "");

  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [closingOrOpening, setClosingOrOpening] = useState(false);
  const [togglingId, setTogglingId] = useState<number | null>(null);

  const isClosed = summary?.status === "closed";

  async function handleClose() {
    if (!window.confirm(`Close ${formatMonthId(monthId)}? This will generate settlements for all active members.`)) return;
    setActionError(null);
    setActionSuccess(null);
    setClosingOrOpening(true);
    try {
      await apiAuthPost(`/api/v1/months/${monthId}/close`, {});
      await Promise.all([reloadSummary(), reloadSettlements()]);
      setActionSuccess("Month closed and settlements generated.");
    } catch (err: unknown) {
      if (err instanceof UnauthorizedError) { logout(); return; }
      const msg = err instanceof Error ? err.message : String(err);
      setActionError(extractErrorMessage(msg));
    } finally {
      setClosingOrOpening(false);
    }
  }

  async function handleReopen() {
    if (!window.confirm(`Reopen ${formatMonthId(monthId)}? All settlement records will be deleted.`)) return;
    setActionError(null);
    setActionSuccess(null);
    setClosingOrOpening(true);
    try {
      await apiAuthPost(`/api/v1/months/${monthId}/reopen`, {});
      await Promise.all([reloadSummary(), reloadSettlements()]);
      setActionSuccess("Month reopened. Settlement records cleared.");
    } catch (err: unknown) {
      if (err instanceof UnauthorizedError) { logout(); return; }
      const msg = err instanceof Error ? err.message : String(err);
      setActionError(extractErrorMessage(msg));
    } finally {
      setClosingOrOpening(false);
    }
  }

  async function handleTogglePaid(s: SettlementResponse) {
    setTogglingId(s.id);
    setActionError(null);
    try {
      await apiAuthPatch<SettlementResponse>(`/api/v1/settlements/${s.id}`, { paid: !s.paid });
      await reloadSettlements();
    } catch (err: unknown) {
      if (err instanceof UnauthorizedError) { logout(); return; }
      const msg = err instanceof Error ? err.message : String(err);
      setActionError(extractErrorMessage(msg));
    } finally {
      setTogglingId(null);
    }
  }

  const sortedSettlements = settlements
    ? [...settlements].sort((a, b) => {
        if (a.paid !== b.paid) return a.paid ? 1 : -1;
        const diff = centsFromDecStr(b.amount) - centsFromDecStr(a.amount);
        return diff > 0n ? 1 : diff < 0n ? -1 : 0;
      })
    : [];

  const settlementsTotal = sortedSettlements.reduce<string>(
    (acc, s) => addDecimalStrings(acc, s.amount),
    "0.00"
  );

  if (!monthId) {
    return (
      <AppShell>
        <div className="p-6 md:p-8">
          <StatusMessage kind="error" message="Invalid month ID." />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="p-6 md:p-8 max-w-4xl space-y-8">

        {/* Header */}
        <div className="animate-fade-up">
          <div className="flex items-center gap-3 mb-1">
            <Link href="/months" className="text-xs text-fg-muted hover:text-accent transition-colors">
              ← Months
            </Link>
            <span className="text-border text-xs">·</span>
            <span
              className={[
                "text-xs px-2 py-0.5 rounded-full font-medium",
                summaryLoading
                  ? "bg-surface-2 text-fg-muted"
                  : isClosed
                  ? "bg-success/10 text-success"
                  : "bg-accent/10 text-accent",
              ].join(" ")}
            >
              {summaryLoading ? "…" : isClosed ? "Closed" : "Open"}
            </span>
          </div>
          <h1 className="font-display text-2xl font-bold text-fg tracking-tight">
            {formatMonthId(monthId)}
          </h1>
        </div>

        {/* Summary loading / error */}
        {summaryLoading && !summary && (
          <StatusMessage kind="loading" message="Loading summary…" />
        )}
        {summaryError && (
          <StatusMessage kind="error" message={summaryError} onRetry={reloadSummary} />
        )}

        {/* Overview stats */}
        {summary && (
          <div
            className="rounded-xl bg-surface-1 border border-border p-6 animate-fade-up delay-75"
            style={{ boxShadow: "var(--shadow-card)" }}
          >
            <h2 className="text-sm font-semibold text-fg-muted uppercase tracking-wider mb-4">
              Overview
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <p className="text-xs text-fg-muted mb-1">Meal Pool</p>
                <Money amount={summary.meal_pool} size="lg" />
              </div>
              <div>
                <p className="text-xs text-fg-muted mb-1">Total Meals</p>
                <span className="font-display tabular-nums text-xl text-fg tracking-tight">
                  {summary.total_meals}
                </span>
              </div>
              <div>
                <p className="text-xs text-fg-muted mb-1">Cost / Meal</p>
                <Money amount={summary.cost_per_meal} size="lg" />
              </div>
            </div>
          </div>
        )}

        {/* Per-user breakdowns */}
        {summary && summary.users.length > 0 && (
          <div className="animate-fade-up delay-75">
            <h2 className="text-sm font-semibold text-fg-muted uppercase tracking-wider mb-3">
              Breakdown by Member
            </h2>
            <div className="space-y-4">
              {summary.users.map((u) => (
                <div
                  key={u.id}
                  className="rounded-xl bg-surface-1 border border-border p-5"
                  style={{ boxShadow: "var(--shadow-card)" }}
                >
                  <div className="flex items-center gap-2 mb-4">
                    <p className="font-display font-bold text-fg">{u.name}</p>
                    {user?.id === u.id && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-accent/10 text-accent font-medium">
                        You
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-3">
                    <BreakdownStat label="Rent Owed" value={u.rent_owed} />
                    <BreakdownStat label="Utility Owed" value={u.utility_owed} />
                    <BreakdownStat label="Household Owed" value={u.household_owed} />
                    <BreakdownStat label="Personal Owed" value={u.personal_owed} />
                    <BreakdownStat label="Meal Owed" value={u.meal_owed} />
                    <BreakdownStat label="Settlement Owed" value={u.settlement_owed} />
                    <BreakdownStat label="Total Paid" value={u.total_paid} />
                    <BreakdownStat
                      label="Settlement Balance"
                      value={u.settlement_balance}
                      variant={balanceVariant(u.settlement_balance)}
                    />
                    <BreakdownStat label="Total Owed" value={u.total_owed} />
                    <BreakdownStat
                      label="Balance"
                      value={u.balance}
                      variant={balanceVariant(u.balance)}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Action feedback */}
        {actionSuccess && (
          <p className="text-sm text-success animate-fade-up">{actionSuccess}</p>
        )}
        {actionError && (
          <p className="text-sm text-danger animate-fade-up">{actionError}</p>
        )}

        {/* Settlements error */}
        {settlementsError && (
          <StatusMessage kind="error" message={settlementsError} onRetry={reloadSettlements} />
        )}

        {/* Settlements list (closed months only) */}
        {isClosed && settlements !== null && (
          <div className="animate-fade-up delay-100">
            <div className="flex items-center justify-between gap-4 mb-3">
              <h2 className="text-sm font-semibold text-fg-muted uppercase tracking-wider">
                Settlements
              </h2>
              {settlements.length > 0 && (
                <p className="text-xs text-fg-muted">
                  Total: <Money amount={settlementsTotal} size="sm" />
                </p>
              )}
            </div>
            {settlements.length === 0 ? (
              <p className="text-sm text-fg-muted">
                No settlements were generated — all balances were even.
              </p>
            ) : (
            <div className="space-y-3">
              {sortedSettlements.map((s) => (
                <div
                  key={s.id}
                  className="rounded-xl bg-surface-1 border border-border p-4"
                  style={{ boxShadow: "var(--shadow-card)" }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-fg">{s.from_user.name}</span>
                        <span className="text-xs text-fg-muted">pays</span>
                        <span className="text-sm font-semibold text-fg">{s.to_user.name}</span>
                      </div>
                      <div className="mt-1">
                        <Money amount={s.amount} variant="emphasis" size="md" />
                      </div>
                      {s.paid && s.paid_marked_by && (
                        <p className="text-xs text-fg-muted mt-1">
                          Marked paid by {s.paid_marked_by.name}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span
                        className={[
                          "text-xs px-2 py-0.5 rounded-full font-medium",
                          s.paid ? "bg-success/10 text-success" : "bg-surface-2 text-fg-muted",
                        ].join(" ")}
                      >
                        {s.paid ? "Paid" : "Unpaid"}
                      </span>
                      {isAdmin && (
                        <button
                          onClick={() => handleTogglePaid(s)}
                          disabled={togglingId === s.id}
                          className="text-xs text-fg-muted hover:text-accent transition-colors disabled:opacity-50"
                        >
                          {togglingId === s.id
                            ? "Saving…"
                            : s.paid
                            ? "Mark Unpaid"
                            : "Mark Paid"}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            )}
          </div>
        )}

        {/* Admin actions card */}
        {isAdmin && summary !== null && (
          <div
            className="rounded-xl bg-surface-1 border border-border p-5 animate-fade-up delay-100"
            style={{ boxShadow: "var(--shadow-card)" }}
          >
            <h2 className="text-sm font-semibold text-fg-muted uppercase tracking-wider mb-3">
              Admin Actions
            </h2>
            {!isClosed ? (
              <div>
                <p className="text-sm text-fg-muted mb-3">
                  Closing the month calculates all expenses and generates settlement transfers
                  between members.
                </p>
                <Button onClick={handleClose} loading={closingOrOpening}>
                  {closingOrOpening ? "Closing…" : "Close Month"}
                </Button>
              </div>
            ) : (
              <div>
                <p className="text-sm text-fg-muted mb-3">
                  Reopening deletes all settlement records and allows corrections to the
                  month&apos;s data.
                </p>
                <Button variant="danger" onClick={handleReopen} loading={closingOrOpening}>
                  {closingOrOpening ? "Reopening…" : "Reopen Month"}
                </Button>
              </div>
            )}
          </div>
        )}

      </div>
    </AppShell>
  );
}

/* ── BreakdownStat ─────────────────────────────────────────────────── */

interface BreakdownStatProps {
  label: string;
  value: string;
  variant?: "positive" | "negative" | "default";
}

function BreakdownStat({ label, value, variant = "default" }: BreakdownStatProps) {
  return (
    <div>
      <p className="text-xs text-fg-muted mb-0.5">{label}</p>
      <Money amount={value} variant={variant} size="sm" />
    </div>
  );
}
