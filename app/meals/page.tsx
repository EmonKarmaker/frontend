"use client";

import { useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { apiAuthPost, UnauthorizedError } from "../../lib/api";
import { useApiData } from "../../lib/useApiData";
import { useConfirm } from "../../lib/useConfirm";
import { ProtectedRoute } from "../../components/ProtectedRoute";
import { AppShell } from "../../components/AppShell";
import { StatusMessage } from "../../components/ui/StatusMessage";
import { Button } from "../../components/ui/Button";
import { ConfirmModal } from "../../components/ui/ConfirmModal";

/* ── Types ──────────────────────────────────────────────────────────── */

interface UserMini { id: number; name: string }

interface UserResponse {
  id: number;
  name: string;
  is_admin: boolean;
  joined_at: string;
  left_at: string | null;
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

interface MealLogUpsert {
  user_id: number;
  log_date: string;
  meal_count: string;
  guest_meals: string;
  note?: string | null;
}

type PendingMap = Map<string, MealLogUpsert>;

/* ── Helpers ────────────────────────────────────────────────────────── */

function currentYearMonth(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

function daysInMonth(yyyymm: string): string[] {
  const [y, m] = yyyymm.split("-");
  const count = new Date(Date.UTC(+y, +m, 0)).getUTCDate();
  return Array.from({ length: count }, (_, i) =>
    `${yyyymm}-${String(i + 1).padStart(2, "0")}`
  );
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  const date = new Date(Date.UTC(+y, +m - 1, +d));
  const weekday = date.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" });
  return `${weekday} ${+d}`;
}

function findLog(
  logs: MealLogResponse[],
  user_id: number,
  log_date: string
): MealLogResponse | undefined {
  return logs.find((l) => l.user.id === user_id && l.log_date === log_date);
}

function pendingKey(user_id: number, log_date: string): string {
  return `${user_id}|${log_date}`;
}

function decimalToCents(s: string): bigint {
  const t = s.trim();
  const [intStr = "0", fracStr = ""] = t.split(".");
  return BigInt(intStr) * 100n + BigInt((fracStr + "00").slice(0, 2));
}

function validMealCount(s: string): boolean {
  if (s === "") return true;
  if (!/^\d+(\.\d{1,2})?$/.test(s.trim())) return false;
  return decimalToCents(s) <= 1000n;
}

function validGuestMeals(s: string): boolean {
  if (s === "") return true;
  if (!/^\d+(\.\d{1,2})?$/.test(s.trim())) return false;
  return decimalToCents(s) <= 2000n;
}

function addDecimalStrings(a: string, b: string): string {
  const toCents = (s: string): bigint => {
    const t = s.trim();
    const neg = t.startsWith("-");
    const abs = neg ? t.slice(1) : t;
    const [intStr = "0", fracStr = ""] = abs.split(".");
    const cents = BigInt(intStr) * 100n + BigInt((fracStr + "00").slice(0, 2));
    return neg ? -cents : cents;
  };
  const sum = toCents(a) + toCents(b);
  const neg = sum < 0n;
  const abs = neg ? -sum : sum;
  return `${neg ? "-" : ""}${abs / 100n}.${(abs % 100n).toString().padStart(2, "0")}`;
}

function todayIso(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-${String(now.getUTCDate()).padStart(2, "0")}`;
}

function userJoinedBy(user: UserResponse, log_date: string): boolean {
  // ISO date strings compare lexicographically correctly
  return user.joined_at <= log_date;
}

function userLeftBefore(user: UserResponse, log_date: string): boolean {
  return user.left_at !== null && user.left_at < log_date;
}

function isUserInHousehold(user: UserResponse, log_date: string): boolean {
  return userJoinedBy(user, log_date) && !userLeftBefore(user, log_date);
}

/* ── EditableCell ────────────────────────────────────────────────────── */

interface EditableCellProps {
  value: string;
  onChange: (v: string) => void;
  disabled: boolean;
  narrow?: boolean;
  invalid?: boolean;
}

function EditableCell({ value, onChange, disabled, narrow, invalid }: EditableCellProps) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      placeholder="—"
      className={[
        "rounded-md px-2 py-1 text-sm bg-surface-2 text-fg border",
        "focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent/60",
        "disabled:opacity-40 disabled:cursor-not-allowed placeholder:text-fg-subtle",
        "transition-colors duration-100",
        narrow ? "w-14 text-center" : "w-20 text-center",
        invalid ? "border-danger/60 bg-danger/5" : "border-border",
      ].join(" ")}
    />
  );
}

/* ── SaveFooter ──────────────────────────────────────────────────────── */

interface SaveFooterProps {
  pending: PendingMap;
  isSaving: boolean;
  onSave: () => void;
  onDiscard: () => void;
}

function SaveFooter({ pending, isSaving, onSave, onDiscard }: SaveFooterProps) {
  if (pending.size === 0 && !isSaving) return null;
  return (
    <div className="sticky bottom-0 border-t border-border bg-surface-1/95 backdrop-blur-sm px-6 py-3 flex items-center gap-4">
      <span className="text-xs text-fg-muted">
        ● {pending.size} unsaved change{pending.size !== 1 ? "s" : ""}
      </span>
      <Button
        size="sm"
        loading={isSaving}
        onClick={onSave}
        disabled={pending.size === 0 || isSaving}
      >
        {isSaving ? "Saving…" : "Save"}
      </Button>
      <Button size="sm" variant="ghost" onClick={onDiscard} disabled={isSaving}>
        Discard
      </Button>
    </div>
  );
}

/* ── MyLogView ───────────────────────────────────────────────────────── */

interface MyLogViewProps {
  logs: MealLogResponse[];
  userId: number;
  currentUser: UserResponse | undefined;
  days: string[];
  today: string;
  pending: PendingMap;
  onSetPending: (key: string, upsert: MealLogUpsert) => void;
}

function MyLogView({ logs, userId, currentUser, days, today, pending, onSetPending }: MyLogViewProps) {
  return (
    <div
      className="rounded-xl bg-surface-1 border border-border overflow-hidden"
      style={{ boxShadow: "var(--shadow-card)" }}
    >
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-surface-2/50">
            <th className="text-left px-4 py-2.5 text-xs font-semibold text-fg-muted uppercase tracking-wider w-24">Date</th>
            <th className="text-center px-3 py-2.5 text-xs font-semibold text-fg-muted uppercase tracking-wider w-24">Meals</th>
            <th className="text-center px-3 py-2.5 text-xs font-semibold text-fg-muted uppercase tracking-wider w-24">Guests</th>
            <th className="text-center px-3 py-2.5 text-xs font-semibold text-fg-muted uppercase tracking-wider w-20">Total</th>
            <th className="px-4 py-2.5 text-xs font-semibold text-fg-muted uppercase tracking-wider">Note / Quick-set</th>
          </tr>
        </thead>
        <tbody>
          {days.map((day, i) => {
            const log = findLog(logs, userId, day);
            const key = pendingKey(userId, day);
            const p = pending.get(key);
            const isToday = day === today;

            const mealValue = p?.meal_count ?? log?.meal_count ?? "";
            const guestValue = p?.guest_meals ?? log?.guest_meals ?? "";
            const mealInvalid = mealValue !== "" && !validMealCount(mealValue);
            const guestInvalid = guestValue !== "" && !validGuestMeals(guestValue);

            function handleMealChange(v: string) {
              onSetPending(key, {
                user_id: userId,
                log_date: day,
                meal_count: v,
                guest_meals: p?.guest_meals ?? log?.guest_meals ?? "0",
                note: p?.note ?? log?.note ?? null,
              });
            }

            function handleGuestChange(v: string) {
              onSetPending(key, {
                user_id: userId,
                log_date: day,
                meal_count: p?.meal_count ?? log?.meal_count ?? "0",
                guest_meals: v,
                note: p?.note ?? log?.note ?? null,
              });
            }

            function setMealPreset(v: string) {
              onSetPending(key, {
                user_id: userId,
                log_date: day,
                meal_count: v,
                guest_meals: p?.guest_meals ?? log?.guest_meals ?? "0",
                note: p?.note ?? log?.note ?? null,
              });
            }

            function incrementGuest() {
              const cur = (p?.guest_meals ?? log?.guest_meals ?? "0") || "0";
              handleGuestChange(addDecimalStrings(cur, "1"));
            }

            const inHousehold = currentUser ? isUserInHousehold(currentUser, day) : true;

            return (
              <tr
                key={day}
                className={[
                  i < days.length - 1 ? "border-b border-border/60" : "",
                  isToday ? "bg-accent/5" : "hover:bg-surface-2/20 transition-colors",
                  inHousehold && p !== undefined ? "ring-1 ring-inset ring-accent/20" : "",
                  !inHousehold ? "opacity-50" : "",
                ].join(" ")}
              >
                <td className={["px-4 py-2 text-xs font-medium", isToday ? "text-accent" : "text-fg-muted"].join(" ")}>
                  {formatDate(day)}
                  {isToday && <span className="ml-1 text-accent/60">·today</span>}
                </td>
                <td className="px-3 py-2 text-center">
                  {inHousehold ? (
                    <EditableCell
                      value={mealValue}
                      onChange={handleMealChange}
                      disabled={false}
                      narrow
                      invalid={mealInvalid}
                    />
                  ) : (
                    <span className="text-xs text-fg-subtle select-none">—</span>
                  )}
                </td>
                <td className="px-3 py-2 text-center">
                  {inHousehold ? (
                    <EditableCell
                      value={guestValue}
                      onChange={handleGuestChange}
                      disabled={false}
                      narrow
                      invalid={guestInvalid}
                    />
                  ) : (
                    <span className="text-xs text-fg-subtle select-none">—</span>
                  )}
                </td>
                <td className="px-3 py-2 text-center text-xs text-fg-muted">
                  {log?.total_meals ?? "—"}
                </td>
                <td className="px-4 py-2">
                  {inHousehold && isToday ? (
                    <div className="flex items-center gap-1 flex-wrap">
                      {(["0", "0.5", "1", "1.5", "2"] as const).map((v) => (
                        <button
                          key={v}
                          type="button"
                          onClick={() => setMealPreset(v)}
                          className="px-2 py-0.5 rounded text-xs bg-surface-2 hover:bg-accent/15 hover:text-accent border border-border transition-colors"
                        >
                          {v}
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={incrementGuest}
                        className="px-2 py-0.5 rounded text-xs bg-surface-2 hover:bg-accent/15 hover:text-accent border border-border transition-colors"
                      >
                        +1g
                      </button>
                    </div>
                  ) : inHousehold && log?.note ? (
                    <span className="text-xs text-fg-muted italic truncate block max-w-[200px]" title={log.note}>
                      {log.note}
                    </span>
                  ) : null}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ── HouseholdView ───────────────────────────────────────────────────── */

interface HouseholdViewProps {
  logs: MealLogResponse[];
  users: UserResponse[];
  currentUserId: number;
  isAdmin: boolean;
  days: string[];
  today: string;
  pending: PendingMap;
  onSetPending: (key: string, upsert: MealLogUpsert) => void;
}

function HouseholdView({
  logs, users, currentUserId, isAdmin, days, today, pending, onSetPending,
}: HouseholdViewProps) {
  const activeUsers = users.filter((u) => u.left_at === null);

  return (
    <div
      className="rounded-xl bg-surface-1 border border-border overflow-x-auto"
      style={{ boxShadow: "var(--shadow-card)" }}
    >
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-surface-2/50">
            <th className="sticky left-0 z-10 bg-surface-2/90 text-left px-4 py-2.5 text-xs font-semibold text-fg-muted uppercase tracking-wider w-20">
              Date
            </th>
            {activeUsers.map((u) => (
              <th key={u.id} className="px-3 py-2.5 text-xs font-semibold uppercase tracking-wider text-center min-w-[96px]">
                <span className={u.id === currentUserId ? "text-accent" : "text-fg-muted"}>
                  {u.name}
                </span>
              </th>
            ))}
          </tr>
          <tr className="border-b border-border/40 bg-surface-2/30">
            <td className="sticky left-0 z-10 bg-surface-2/60 px-4 py-1 text-xs text-fg-subtle" />
            {activeUsers.map((u) => (
              <td key={u.id} className="px-3 py-1 text-center">
                <div className="flex justify-center gap-2 text-xs text-fg-subtle">
                  <span>meals</span>
                  <span>guests</span>
                </div>
              </td>
            ))}
          </tr>
        </thead>
        <tbody>
          {days.map((day, i) => {
            const isToday = day === today;
            return (
              <tr
                key={day}
                className={[
                  i < days.length - 1 ? "border-b border-border/50" : "",
                  isToday ? "bg-accent/5" : "hover:bg-surface-2/20 transition-colors",
                ].join(" ")}
              >
                <td className={[
                  "sticky left-0 z-10 bg-surface-1 px-4 py-1.5 text-xs font-medium w-20",
                  isToday ? "text-accent" : "text-fg-muted",
                ].join(" ")}>
                  {formatDate(day)}
                </td>
                {activeUsers.map((u) => {
                  const inHousehold = isUserInHousehold(u, day);
                  const editable = (isAdmin || u.id === currentUserId) && inHousehold;
                  const log = findLog(logs, u.id, day);
                  const key = pendingKey(u.id, day);
                  const p = pending.get(key);

                  const mealValue = p?.meal_count ?? log?.meal_count ?? "";
                  const guestValue = p?.guest_meals ?? log?.guest_meals ?? "";
                  const mealInvalid = mealValue !== "" && !validMealCount(mealValue);
                  const guestInvalid = guestValue !== "" && !validGuestMeals(guestValue);

                  function handleChange(field: "meal_count" | "guest_meals", v: string) {
                    onSetPending(key, {
                      user_id: u.id,
                      log_date: day,
                      meal_count: field === "meal_count" ? v : (p?.meal_count ?? log?.meal_count ?? "0"),
                      guest_meals: field === "guest_meals" ? v : (p?.guest_meals ?? log?.guest_meals ?? "0"),
                      note: p?.note ?? log?.note ?? null,
                    });
                  }

                  return (
                    <td key={u.id} className={["px-2 py-1.5 text-center", p !== undefined && inHousehold ? "bg-accent/5" : ""].join(" ")}>
                      {inHousehold ? (
                        <div className="flex justify-center items-center gap-1.5">
                          <EditableCell
                            value={mealValue}
                            onChange={(v) => handleChange("meal_count", v)}
                            disabled={!editable}
                            narrow
                            invalid={mealInvalid}
                          />
                          <EditableCell
                            value={guestValue}
                            onChange={(v) => handleChange("guest_meals", v)}
                            disabled={!editable}
                            narrow
                            invalid={guestInvalid}
                          />
                        </div>
                      ) : (
                        <span className="text-xs text-fg-subtle select-none">·</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ── MealsContent ────────────────────────────────────────────────────── */

function MealsContent() {
  const { user, logout } = useAuth();
  const [selectedMonth, setSelectedMonth] = useState(currentYearMonth());
  const [view, setView] = useState<"my" | "household">("my");
  const [pending, setPending] = useState<PendingMap>(new Map());
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const { confirm, modalProps } = useConfirm();

  const { data: myLogs, loading: myLoading, error: myError, reload: reloadMy } =
    useApiData<MealLogResponse[]>(`/api/v1/meals/me?month=${selectedMonth}`);
  const { data: allLogs, loading: allLoading, error: allError, reload: reloadAll } =
    useApiData<MealLogResponse[]>(`/api/v1/meals?month=${selectedMonth}`);
  const { data: usersData } = useApiData<UserResponse[]>("/api/v1/users");

  const days = daysInMonth(selectedMonth);
  const today = todayIso();
  const users = usersData ?? [];
  const isAdmin = user?.is_admin ?? false;
  const currentUserId = user?.id ?? 0;
  const currentUserFull = users.find((u) => u.id === currentUserId);

  const activeLogs = view === "my" ? myLogs : allLogs;
  const activeLoading = view === "my" ? myLoading : allLoading;
  const activeError = view === "my" ? myError : allError;

  async function guardPending(action: () => void): Promise<void> {
    if (pending.size > 0) {
      if (!(await confirm({
        title: "Discard unsaved changes?",
        message: `You have ${pending.size} unsaved change${pending.size !== 1 ? "s" : ""}. Switch views and discard them?`,
      }))) return;
      setPending(new Map());
    }
    action();
  }

  function tryChangeMonth(newMonth: string) {
    void guardPending(() => setSelectedMonth(newMonth));
  }

  function tryChangeView(newView: "my" | "household") {
    if (newView === view) return;
    void guardPending(() => setView(newView));
  }

  function handleSetPending(key: string, upsert: MealLogUpsert) {
    setPending((prev) => {
      const next = new Map(prev);
      next.set(key, upsert);
      return next;
    });
  }

  async function handleSave() {
    setSaveError("");

    // Belt-and-suspenders: drop any pending entry for a date outside the user's
    // household tenure (shouldn't be reachable via UI, but guards against races).
    const allPending = Array.from(pending.values());
    const safeEntries = allPending.filter((e) => {
      const u = users.find((u) => u.id === e.user_id);
      if (!u || !isUserInHousehold(u, e.log_date)) {
        console.warn(`Dropping out-of-household pending entry: user ${e.user_id} on ${e.log_date}`);
        return false;
      }
      return true;
    });

    const entries = safeEntries.map((e) => ({
      ...e,
      meal_count: e.meal_count || "0",
      guest_meals: e.guest_meals || "0",
    }));

    for (const e of entries) {
      if (!validMealCount(e.meal_count)) {
        setSaveError(`Invalid meal count "${e.meal_count}" for ${e.log_date}.`);
        return;
      }
      if (!validGuestMeals(e.guest_meals)) {
        setSaveError(`Invalid guest meals "${e.guest_meals}" for ${e.log_date}.`);
        return;
      }
    }

    setIsSaving(true);
    try {
      await apiAuthPost("/api/v1/meals/bulk", { entries });
      await Promise.all([reloadMy(), reloadAll()]);
      setPending(new Map());
      setSuccessMsg("Changes saved.");
      setTimeout(() => setSuccessMsg(""), 4000);
    } catch (err: unknown) {
      if (err instanceof UnauthorizedError) { logout(); return; }
      const rawMsg = err instanceof Error ? err.message : String(err);
      if (rawMsg.includes("422")) {
        let displayMsg = "Please check your input — all required fields must be valid.";
        const jsonMatch = rawMsg.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          try {
            const parsed = JSON.parse(jsonMatch[0]);
            if (typeof parsed.detail === "string") displayMsg = parsed.detail;
          } catch {}
        }
        setSaveError(displayMsg);
      } else {
        setSaveError(rawMsg);
      }
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDiscard() {
    if (pending.size > 0) {
      if (!(await confirm({
        title: "Discard changes?",
        message: `Discard ${pending.size} unsaved change${pending.size !== 1 ? "s" : ""}?`,
        variant: "danger",
        confirmLabel: "Discard",
      }))) return;
    }
    setPending(new Map());
    setSaveError("");
  }

  return (
    <>
    <AppShell>
      <div className="p-6 md:p-8 max-w-5xl pb-24">

        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-6 animate-fade-up">
          <h1 className="font-display text-2xl font-bold text-fg tracking-tight">Meals</h1>
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => tryChangeMonth(e.target.value)}
            className="h-9 rounded-lg px-3 text-sm bg-surface-2 text-fg border border-border focus:outline-none focus:ring-2 focus:ring-accent/40"
          />
        </div>

        {/* View toggle */}
        <div className="flex items-center gap-1 mb-6 p-1 rounded-xl bg-surface-2 border border-border w-fit animate-fade-up">
          {(["my", "household"] as const).map((v) => (
            <button
              key={v}
              onClick={() => tryChangeView(v)}
              className={[
                "px-4 py-1.5 rounded-lg text-sm font-medium transition-all duration-150",
                view === v
                  ? "bg-surface-1 text-fg shadow-sm border border-border"
                  : "text-fg-muted hover:text-fg",
              ].join(" ")}
            >
              {v === "my" ? "My Log" : "Household"}
            </button>
          ))}
        </div>

        {successMsg && <p className="text-sm text-success mb-4 animate-fade-up">{successMsg}</p>}
        {saveError && <p className="text-sm text-danger mb-4">{saveError}</p>}

        {activeLoading && !activeLogs && (
          <StatusMessage kind="loading" message="Loading meals — first load may take up to 60 seconds…" />
        )}

        {activeError && <StatusMessage kind="error" message={activeError} />}

        {activeLogs && !activeError && (
          <div className="animate-fade-up delay-75">
            {view === "my" && (
              <MyLogView
                logs={activeLogs}
                userId={currentUserId}
                currentUser={currentUserFull}
                days={days}
                today={today}
                pending={pending}
                onSetPending={handleSetPending}
              />
            )}
            {view === "household" && (
              <HouseholdView
                logs={activeLogs}
                users={users}
                currentUserId={currentUserId}
                isAdmin={isAdmin}
                days={days}
                today={today}
                pending={pending}
                onSetPending={handleSetPending}
              />
            )}
          </div>
        )}

      </div>

      <SaveFooter
        pending={pending}
        isSaving={isSaving}
        onSave={handleSave}
        onDiscard={handleDiscard}
      />
    </AppShell>
    <ConfirmModal {...modalProps} />
    </>
  );
}

/* ── Page ────────────────────────────────────────────────────────────── */

export default function MealsPage() {
  return (
    <ProtectedRoute>
      <MealsContent />
    </ProtectedRoute>
  );
}
