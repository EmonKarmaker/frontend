"use client";

import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { apiAuthGet, apiAuthPatch, UnauthorizedError } from "../../lib/api";
import { addDecimalStrings } from "../../lib/money";
import { ProtectedRoute } from "../../components/ProtectedRoute";
import { AppShell } from "../../components/AppShell";
import { StatusMessage } from "../../components/ui/StatusMessage";
import { Money } from "../../components/ui/Money";

/* ── Types ─────────────────────────────────────────────────────────── */

interface UserMini { id: number; name: string; }

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

type SettlementWithMonth = SettlementResponse & { month_label: string };

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

function centsFromDecStr(s: string): bigint {
  const t = s.trim();
  const neg = t.startsWith("-");
  const abs = neg ? t.slice(1) : t;
  const [intStr = "0", fracStr = ""] = abs.split(".");
  const cents = BigInt(intStr) * 100n + BigInt((fracStr + "00").slice(0, 2));
  return neg ? -cents : cents;
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

function sortSettlements(items: SettlementWithMonth[]): SettlementWithMonth[] {
  return [...items].sort((a, b) => {
    if (a.paid !== b.paid) return a.paid ? 1 : -1;
    const diff = centsFromDecStr(b.amount) - centsFromDecStr(a.amount);
    return diff > 0n ? 1 : diff < 0n ? -1 : 0;
  });
}

/* ── Page shell ────────────────────────────────────────────────────── */

export default function SettlementsPage() {
  return (
    <ProtectedRoute>
      <SettlementsContent />
    </ProtectedRoute>
  );
}

/* ── Main content ──────────────────────────────────────────────────── */

function SettlementsContent() {
  const { user, logout } = useAuth();
  const isAdmin = user?.is_admin ?? false;

  const [months] = useState<string[]>(() => [currentMonthId(), ...priorMonths(11)]);
  const [settlements, setSettlements] = useState<SettlementWithMonth[] | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showPaid, setShowPaid] = useState(false);
  const [togglingId, setTogglingId] = useState<number | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setFetchError(null);

    Promise.all(
      months.map((m) =>
        apiAuthGet<SettlementResponse[]>(`/api/v1/months/${m}/settlements`)
          .then((rows) =>
            rows.map((s) => ({ ...s, month_label: formatMonthId(m) }))
          )
          .catch((e: unknown): SettlementWithMonth[] => {
            if (e instanceof UnauthorizedError) logout();
            return [];
          })
      )
    )
      .then((results) => {
        if (!cancelled) {
          setSettlements(results.flat());
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setFetchError("Failed to load settlements.");
          setLoading(false);
        }
      });

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleTogglePaid(s: SettlementWithMonth) {
    setTogglingId(s.id);
    setActionError(null);
    try {
      const updated = await apiAuthPatch<SettlementResponse>(
        `/api/v1/settlements/${s.id}`,
        { paid: !s.paid }
      );
      setSettlements((prev) =>
        prev
          ? prev.map((item) =>
              item.id === s.id
                ? { ...updated, month_label: s.month_label }
                : item
            )
          : prev
      );
    } catch (err: unknown) {
      if (err instanceof UnauthorizedError) { logout(); return; }
      const msg = err instanceof Error ? err.message : String(err);
      setActionError(extractErrorMessage(msg));
    } finally {
      setTogglingId(null);
    }
  }

  const unpaidSettlements = settlements
    ? settlements.filter((s) => !s.paid)
    : [];

  const unpaidTotal = unpaidSettlements.reduce<string>(
    (acc, s) => addDecimalStrings(acc, s.amount),
    "0.00"
  );

  const visibleSettlements = settlements
    ? sortSettlements(showPaid ? settlements : unpaidSettlements)
    : [];

  // Group by month_label, preserving month order (months array order)
  const grouped: { label: string; items: SettlementWithMonth[] }[] = [];
  const labelOrder = months.map((m) => formatMonthId(m));

  for (const label of labelOrder) {
    const items = visibleSettlements.filter((s) => s.month_label === label);
    if (items.length > 0) {
      grouped.push({ label, items });
    }
  }

  return (
    <AppShell>
      <div className="p-6 md:p-8 max-w-3xl space-y-8">

        {/* Header */}
        <div className="animate-fade-up">
          <h1 className="font-display text-2xl font-bold text-fg tracking-tight">Settlements</h1>
          <p className="text-sm text-fg-muted mt-0.5">All inter-flatmate payments across months</p>
        </div>

        {/* Stats + toggle row */}
        <div className="flex items-center justify-between gap-4 animate-fade-up delay-75">
          <div className="text-sm text-fg-muted">
            {settlements !== null && !loading && (
              <>
                <span className="font-medium text-fg">{unpaidSettlements.length} unpaid</span>
                {unpaidSettlements.length > 0 && (
                  <>
                    {" · "}
                    <Money amount={unpaidTotal} size="sm" variant="negative" />
                    {" total unpaid"}
                  </>
                )}
              </>
            )}
          </div>
          <label className="flex items-center gap-2 text-sm text-fg-muted cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showPaid}
              onChange={(e) => setShowPaid(e.target.checked)}
              className="w-4 h-4 rounded border-border accent-accent"
            />
            Show paid
          </label>
        </div>

        {/* Loading */}
        {loading && <StatusMessage kind="loading" message="Loading settlements…" />}

        {/* Fetch error */}
        {fetchError && <StatusMessage kind="error" message={fetchError} />}

        {/* Action error */}
        {actionError && (
          <p className="text-sm text-danger animate-fade-up">{actionError}</p>
        )}

        {/* Empty state */}
        {!loading && !fetchError && settlements !== null && visibleSettlements.length === 0 && (
          <StatusMessage
            kind="empty"
            message={
              showPaid
                ? "No settlements found in the last 12 months."
                : "No unpaid settlements. All clear!"
            }
          />
        )}

        {/* Grouped settlement list */}
        {!loading && grouped.map(({ label, items }) => (
          <div key={label} className="animate-fade-up">
            <h2 className="text-sm font-semibold text-fg-muted uppercase tracking-wider mb-3">
              {label}
            </h2>
            <div className="space-y-3">
              {items.map((s) => (
                <SettlementRow
                  key={s.id}
                  settlement={s}
                  isAdmin={isAdmin}
                  togglingId={togglingId}
                  onTogglePaid={handleTogglePaid}
                />
              ))}
            </div>
          </div>
        ))}

      </div>
    </AppShell>
  );
}

/* ── SettlementRow ─────────────────────────────────────────────────── */

interface SettlementRowProps {
  settlement: SettlementWithMonth;
  isAdmin: boolean;
  togglingId: number | null;
  onTogglePaid: (s: SettlementWithMonth) => void;
}

function SettlementRow({ settlement: s, isAdmin, togglingId, onTogglePaid }: SettlementRowProps) {
  return (
    <div
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
              onClick={() => onTogglePaid(s)}
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
  );
}
