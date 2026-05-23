"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "../../context/AuthContext";
import { apiAuthPatch, UnauthorizedError } from "../../lib/api";
import { useApiData } from "../../lib/useApiData";
import { addDecimalStrings } from "../../lib/money";
import { ProtectedRoute } from "../../components/ProtectedRoute";
import { AppShell } from "../../components/AppShell";
import { Card } from "../../components/ui/Card";
import { Money } from "../../components/ui/Money";

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

interface MealLogResponse {
  id: number;
  user: UserMini;
  log_date: string;
  meal_count: string;
  guest_meals: string;
  total_meals: string;
  note: string | null;
  created_at: string;
  updated_at: string;
}

interface ShoppingItemResponse {
  id: number;
  entry_id: number;
  name: string;
  price: string;
  quantity: string;
  category: string;
  target_user: UserMini | null;
  line_total: string;
  created_at: string;
}

interface ShoppingEntryResponse {
  id: number;
  household_id: number;
  month: string;
  paid_by: UserMini;
  photo_url: string | null;
  note: string | null;
  items: ShoppingItemResponse[];
  created_at: string;
  updated_at: string;
}

interface UtilityBillResponse {
  id: number;
  household_id: number;
  month: string;
  type: string;
  amount: string;
  paid_by: UserMini;
  paid_at: string;
  photo_url: string | null;
  note: string | null;
  created_at: string;
  updated_at: string;
}

/* ── Helpers ──────────────────────────────────────────────────────── */

function currentMonthId(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function isoDateLocal(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function last7DaysLocal(): string[] {
  const days: string[] = [];
  const now = new Date();
  for (let i = 0; i < 7; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    days.push(isoDateLocal(d));
  }
  return days;
}

// Strip leading minus — used for "You owe ৳X" display (pass abs value to Money).
function absDecStr(s: string): string {
  return s.startsWith("-") ? s.slice(1) : s;
}

function formatMealGapDate(d: string): string {
  const [y, m, day] = d.split("-");
  return new Date(Date.UTC(+y, +m - 1, +day)).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function formatActivityDate(dt: string): string {
  return new Date(dt).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function entryTotal(entry: ShoppingEntryResponse): string {
  return entry.items.reduce<string>(
    (acc, item) => addDecimalStrings(acc, item.line_total),
    "0.00"
  );
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

/* ── Page shell ────────────────────────────────────────────────────── */

export default function DashboardPage() {
  return (
    <ProtectedRoute>
      <DashboardContent />
    </ProtectedRoute>
  );
}

/* ── Main content ──────────────────────────────────────────────────── */

function DashboardContent() {
  const { user, logout } = useAuth();
  const currentMonth = currentMonthId();
  const isAdmin = user?.is_admin ?? false;
  const currentUserId = user?.id ?? null;

  const { data: summary } =
    useApiData<MonthSummary>(`/api/v1/months/${currentMonth}/summary`);
  const { data: settlements, reload: reloadSettlements } =
    useApiData<SettlementResponse[]>(`/api/v1/months/${currentMonth}/settlements`);
  const { data: mealLogs } =
    useApiData<MealLogResponse[]>(`/api/v1/meals/me?month=${currentMonth}`);
  const { data: bills } =
    useApiData<UtilityBillResponse[]>(`/api/v1/bills?month=${currentMonth}`);
  const { data: shoppingEntries } =
    useApiData<ShoppingEntryResponse[]>(`/api/v1/shopping?month=${currentMonth}`);

  const [togglingId, setTogglingId] = useState<number | null>(null);
  const [markPaidError, setMarkPaidError] = useState<string | null>(null);
  const [markPaidSuccess, setMarkPaidSuccess] = useState<string | null>(null);

  async function handleMarkPaid(s: SettlementResponse) {
    setTogglingId(s.id);
    setMarkPaidError(null);
    setMarkPaidSuccess(null);
    try {
      await apiAuthPatch<SettlementResponse>(`/api/v1/settlements/${s.id}`, { paid: true });
      await reloadSettlements();
      setMarkPaidSuccess("Settlement marked as paid.");
      setTimeout(() => setMarkPaidSuccess(null), 4000);
    } catch (err: unknown) {
      if (err instanceof UnauthorizedError) { logout(); return; }
      const msg = err instanceof Error ? err.message : String(err);
      setMarkPaidError(extractErrorMessage(msg));
    } finally {
      setTogglingId(null);
    }
  }

  // Hero: current user's breakdown from this month's summary.
  // null when summary is loading, user just joined, or load failed.
  const myBreakdown = currentUserId !== null
    ? (summary?.users.find((u) => u.id === currentUserId) ?? null)
    : null;

  // Unpaid settlements involving the current user (either side).
  const unpaidInvolvingMe = settlements !== null
    ? settlements.filter(
        (s) =>
          !s.paid &&
          (s.from_user.id === currentUserId || s.to_user.id === currentUserId)
      )
    : null;
  const unpaidTotal = unpaidInvolvingMe
    ? unpaidInvolvingMe.reduce<string>((acc, s) => addDecimalStrings(acc, s.amount), "0.00")
    : "0.00";

  // Meal gaps: days in the last 7 (today inclusive) with no log entry.
  // Respects joined_at — don't surface days before the user joined.
  const today = isoDateLocal(new Date());
  const mealGaps: string[] | null =
    mealLogs !== null && user !== null
      ? last7DaysLocal().filter((day) => {
          if (day > today) return false;
          if (day < user.joined_at) return false;
          return !mealLogs.some(
            (l) => l.user.id === currentUserId && l.log_date === day
          );
        })
      : null;

  // Activity: combine bills + shopping, sort created_at desc, top 5.
  type ActivityItem =
    | { kind: "bill"; item: UtilityBillResponse }
    | { kind: "shopping"; item: ShoppingEntryResponse };

  const activity: ActivityItem[] | null =
    bills !== null && shoppingEntries !== null
      ? [
          ...bills.map((b) => ({ kind: "bill" as const, item: b })),
          ...shoppingEntries.map((e) => ({ kind: "shopping" as const, item: e })),
        ]
          .sort((a, b) => b.item.created_at.localeCompare(a.item.created_at))
          .slice(0, 5)
      : null;

  return (
    <AppShell>
      <div className="p-6 md:p-8 max-w-4xl space-y-6">

        {/* Page header */}
        <div className="animate-fade-up">
          <h1 className="font-display text-2xl font-bold text-fg tracking-tight">Dashboard</h1>
          <p className="text-sm text-fg-muted mt-0.5">Welcome back, {user?.name ?? "—"}.</p>
        </div>

        {/* 1. Hero balance card — hidden when user not in this month's data */}
        {myBreakdown && (
          <div className="animate-fade-up delay-75">
            <Card>
              <HeroBalance breakdown={myBreakdown} />
            </Card>
          </div>
        )}

        {/* 2. Unpaid settlements involving me — hidden when none */}
        {unpaidInvolvingMe && unpaidInvolvingMe.length > 0 && (
          <div className="animate-fade-up delay-75">
            <Card title="Unpaid Settlements">
              {markPaidSuccess && (
                <p className="text-xs text-success mb-3">{markPaidSuccess}</p>
              )}
              {markPaidError && (
                <p className="text-xs text-danger mb-3">{markPaidError}</p>
              )}
              <div className="space-y-3">
                {unpaidInvolvingMe.map((s) => {
                  const iOwe = s.from_user.id === currentUserId;
                  return (
                    <div key={s.id} className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        {iOwe ? (
                          <p className="text-sm text-fg">
                            Pay{" "}
                            <span className="font-semibold">{s.to_user.name}</span>
                            {": "}
                            <Money amount={s.amount} variant="negative" size="sm" />
                          </p>
                        ) : (
                          <p className="text-sm text-fg">
                            <span className="font-semibold">{s.from_user.name}</span>
                            {" owes you "}
                            <Money amount={s.amount} variant="positive" size="sm" />
                          </p>
                        )}
                      </div>
                      {isAdmin && (
                        <button
                          onClick={() => handleMarkPaid(s)}
                          disabled={togglingId === s.id}
                          className="text-xs text-fg-muted hover:text-accent transition-colors disabled:opacity-50 shrink-0"
                        >
                          {togglingId === s.id ? "Saving…" : "Mark Paid"}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="mt-4 pt-3 border-t border-border flex items-center justify-between">
                <span className="text-xs text-fg-muted">Total unpaid</span>
                <Money amount={unpaidTotal} size="sm" />
              </div>
            </Card>
          </div>
        )}

        {/* 3. Meal log gaps — hidden when none */}
        {mealGaps && mealGaps.length > 0 && (
          <div className="animate-fade-up delay-75">
            <Card title="Log your meals">
              <div className="space-y-2">
                {mealGaps.map((day) => (
                  <Link
                    key={day}
                    href={`/meals?month=${currentMonth}`}
                    className="flex items-center justify-between group py-0.5"
                  >
                    <span className="text-sm text-fg-muted group-hover:text-fg transition-colors">
                      {formatMealGapDate(day)}
                    </span>
                    <span className="text-xs text-fg-muted group-hover:text-accent transition-colors">
                      Log →
                    </span>
                  </Link>
                ))}
              </div>
            </Card>
          </div>
        )}

        {/* 4. Activity glance — always visible, shows loading/empty states */}
        <div className="animate-fade-up delay-100">
          <Card title="Recent Activity">
            {activity === null && (
              <p className="text-sm text-fg-muted">Loading…</p>
            )}
            {activity !== null && activity.length === 0 && (
              <p className="text-sm text-fg-muted">No recent activity this month.</p>
            )}
            {activity !== null && activity.length > 0 && (
              <div className="space-y-3">
                {activity.map((a) => {
                  if (a.kind === "bill") {
                    const b = a.item;
                    return (
                      <Link
                        key={`bill-${b.id}`}
                        href="/bills"
                        className="flex items-center justify-between gap-3 group"
                      >
                        <div className="min-w-0">
                          <p className="text-sm text-fg truncate">
                            <span className="font-semibold">{b.paid_by.name}</span>
                            {` added ${b.type} bill`}
                          </p>
                          <p className="text-xs text-fg-muted">{formatActivityDate(b.created_at)}</p>
                        </div>
                        <Money amount={b.amount} size="sm" />
                      </Link>
                    );
                  }
                  const e = a.item;
                  const total = entryTotal(e);
                  return (
                    <Link
                      key={`shopping-${e.id}`}
                      href="/shopping"
                      className="flex items-center justify-between gap-3 group"
                    >
                      <div className="min-w-0">
                        <p className="text-sm text-fg truncate">
                          <span className="font-semibold">{e.paid_by.name}</span>
                          {" added shopping"}
                        </p>
                        <p className="text-xs text-fg-muted">{formatActivityDate(e.created_at)}</p>
                      </div>
                      <Money amount={total} size="sm" />
                    </Link>
                  );
                })}
              </div>
            )}
          </Card>
        </div>

        {/* 5. Quick actions */}
        <div className="animate-fade-up delay-100">
          <div className="grid grid-cols-3 gap-3">
            {(
              [
                { label: "Add Bill", href: "/bills" },
                { label: "Add Shopping", href: "/shopping" },
                { label: "Log Meal", href: "/meals" },
              ] as const
            ).map(({ label, href }) => (
              <Link
                key={href}
                href={href}
                className="inline-flex items-center justify-center h-10 px-4 text-sm font-medium rounded-lg text-fg-muted hover:text-fg hover:bg-surface-2 border border-border transition-all duration-150"
              >
                {label}
              </Link>
            ))}
          </div>
        </div>

      </div>
    </AppShell>
  );
}

/* ── HeroBalance ───────────────────────────────────────────────────── */

interface HeroBalanceProps {
  breakdown: UserMonthBreakdown;
}

function HeroBalance({ breakdown }: HeroBalanceProps) {
  const bal = breakdown.settlement_balance.trim();
  const isNegative = bal.startsWith("-");
  const isZero = bal === "0.00" || bal === "0";
  const isPositive = !isNegative && !isZero;

  return (
    <div>
      <p className="text-xs font-semibold text-fg-muted uppercase tracking-wider mb-3">
        This Month
      </p>

      {isNegative && (
        <div className="mb-4">
          <p className="text-xs text-fg-muted mb-1">You owe</p>
          <Money amount={absDecStr(bal)} variant="negative" size="xl" />
        </div>
      )}
      {isPositive && (
        <div className="mb-4">
          <p className="text-xs text-fg-muted mb-1">You&apos;re owed</p>
          <Money amount={bal} variant="positive" size="xl" />
        </div>
      )}
      {isZero && (
        <p className="text-lg font-display text-fg-muted mb-4">All settled this month</p>
      )}

      <div className="grid grid-cols-3 gap-4 pt-3 border-t border-border">
        <div>
          <p className="text-xs text-fg-muted mb-1">Total Owed</p>
          <Money amount={breakdown.total_owed} size="sm" />
        </div>
        <div>
          <p className="text-xs text-fg-muted mb-1">You Paid</p>
          <Money amount={breakdown.total_paid} size="sm" />
        </div>
        <div>
          <p className="text-xs text-fg-muted mb-1">Settlement Balance</p>
          <Money
            amount={bal}
            size="sm"
            variant={isNegative ? "negative" : isPositive ? "positive" : "default"}
          />
        </div>
      </div>
    </div>
  );
}
