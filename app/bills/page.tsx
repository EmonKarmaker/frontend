"use client";

import { ChangeEvent, ReactNode, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { apiAuthPostForm, apiAuthPatch, apiAuthDelete, UnauthorizedError } from "../../lib/api";
import { useApiData } from "../../lib/useApiData";
import { ProtectedRoute } from "../../components/ProtectedRoute";
import { AppShell } from "../../components/AppShell";
import { StatusMessage } from "../../components/ui/StatusMessage";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Card } from "../../components/ui/Card";
import { Money } from "../../components/ui/Money";

/* ── Types ─────────────────────────────────────────────────────────── */

interface UtilityBillResponse {
  id: number;
  household_id: number;
  month: string;            // "YYYY-MM"
  type: string;
  amount: string;           // decimal-as-string — never parseFloat
  paid_by: { id: number; name: string };
  paid_at: string;          // "YYYY-MM-DD"
  photo_url: string | null;
  note: string | null;
  created_at: string;
  updated_at: string;
}

type FormMode = { kind: "add" } | { kind: "edit"; bill: UtilityBillResponse } | null;

// Fallback when the /types endpoint hasn't resolved yet.
const DEFAULT_TYPES = ["electricity", "internet", "gas", "water", "other"];

// Sentinel that switches the type field from dropdown to free-text input.
const CUSTOM_SENTINEL = "__custom__";

/* ── Helpers ───────────────────────────────────────────────────────── */

function formatMonth(m: string): string {
  const [y, mo] = m.split("-");
  return new Date(Date.UTC(+y, +mo - 1, 1)).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    timeZone: "UTC",
  });
}

function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-");
  return new Date(Date.UTC(+y, +m - 1, +d)).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function formatType(t: string): string {
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/* ── SelectField ───────────────────────────────────────────────────── */

interface SelectFieldProps {
  label: string;
  value: string;
  onChange: (e: ChangeEvent<HTMLSelectElement>) => void;
  disabled?: boolean;
  children: ReactNode;
}

function SelectField({ label, value, onChange, disabled, children }: SelectFieldProps) {
  const id = label.toLowerCase().replace(/\s+/g, "-");
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-fg-muted">
        {label}
      </label>
      <div className="relative">
        <select
          id={id}
          value={value}
          onChange={onChange}
          disabled={disabled}
          className={[
            "h-10 w-full rounded-lg px-3 pr-9 text-sm bg-surface-2 text-fg",
            "border border-border appearance-none cursor-pointer",
            "transition-colors duration-100",
            "focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent/60",
            "disabled:opacity-50 disabled:cursor-not-allowed",
          ].join(" ")}
        >
          {children}
        </select>
        <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-fg-muted">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
      </div>
    </div>
  );
}

/* ── Bill form ─────────────────────────────────────────────────────── */

interface BillFormProps {
  mode: FormMode;
  availableTypes: string[];
  onSuccess: (msg: string) => void;
  onCancel: () => void;
  onReload: () => Promise<void>;
  onReloadTypes: () => Promise<void>;
  onUnauthorized: () => void;
}

function BillForm({
  mode,
  availableTypes,
  onSuccess,
  onCancel,
  onReload,
  onReloadTypes,
  onUnauthorized,
}: BillFormProps) {
  const editing = mode?.kind === "edit";
  const existing = editing ? mode.bill : null;

  // If editing a type not in the known list (defensive), open in custom mode.
  const initialBillType = existing
    ? (availableTypes.includes(existing.type) ? existing.type : CUSTOM_SENTINEL)
    : (availableTypes[0] ?? "electricity");

  const [month, setMonth] = useState(existing?.month ?? "");
  const [billType, setBillType] = useState(initialBillType);
  // Pre-fill custom input when editing an unknown type.
  const [customType, setCustomType] = useState(
    existing && !availableTypes.includes(existing.type) ? existing.type : ""
  );
  const [amount, setAmount] = useState(existing?.amount ?? "");
  const [paidAt, setPaidAt] = useState(existing?.paid_at ?? "");
  const [note, setNote] = useState(existing?.note ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const isCustomMode = billType === CUSTOM_SENTINEL;

  async function handleSubmit(e: { preventDefault(): void }) {
    e.preventDefault();
    setError("");

    // Resolve the value that will actually be stored.
    const effectiveType = isCustomMode ? customType.trim().toLowerCase() : billType;

    // Validate custom input before touching the network.
    if (isCustomMode) {
      if (!effectiveType) {
        setError("Custom type is required.");
        return;
      }
      if (effectiveType.length > 50) {
        setError("Custom type must be at most 50 characters.");
        return;
      }
    }

    setSubmitting(true);
    try {
      if (editing && existing) {
        const body: Record<string, string> = {};
        if (month !== existing.month) body.month = month;
        if (effectiveType !== existing.type) body.type = effectiveType;
        if (amount !== existing.amount) body.amount = amount;
        if (paidAt !== existing.paid_at) body.paid_at = paidAt;
        if (note !== (existing.note ?? "")) body.note = note;
        await apiAuthPatch<UtilityBillResponse>(`/api/v1/bills/${existing.id}`, body);
        await onReload();
        onSuccess("Bill updated.");
      } else {
        const fd = new FormData();
        fd.append("month", month);
        fd.append("type", effectiveType);
        fd.append("amount", amount);
        fd.append("paid_at", paidAt);
        if (note.trim()) fd.append("note", note.trim());
        await apiAuthPostForm<UtilityBillResponse>("/api/v1/bills", fd);
        // Refresh bill list and known types concurrently — a new custom type
        // may have been added and should appear the next time the form opens.
        await Promise.all([onReload(), onReloadTypes()]);
        onSuccess("Bill added.");
      }
    } catch (err: unknown) {
      if (err instanceof UnauthorizedError) {
        onUnauthorized();
        return;
      }
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg.includes("422") ? "Please check your input — all required fields must be valid." : msg);
      setSubmitting(false);
    }
  }

  return (
    <div className="mb-6 animate-fade-up">
      <Card title={editing ? "Edit bill" : "Add a bill"}>
        <form onSubmit={handleSubmit} className="pt-1 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Input
              label="Month"
              type="month"
              required
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              disabled={submitting}
            />

            {/* Type: dropdown (with "+ Add custom type…") or free-text input */}
            {isCustomMode ? (
              <div className="flex flex-col gap-1">
                <Input
                  label="Custom type"
                  type="text"
                  autoFocus
                  placeholder="e.g. cable tv"
                  maxLength={50}
                  value={customType}
                  onChange={(e) => setCustomType(e.target.value)}
                  disabled={submitting}
                />
                <button
                  type="button"
                  onClick={() => setBillType(availableTypes[0] ?? "electricity")}
                  disabled={submitting}
                  className="text-xs text-fg-muted hover:text-accent transition-colors self-start"
                >
                  ← Use existing types
                </button>
              </div>
            ) : (
              <SelectField
                label="Type"
                value={billType}
                onChange={(e) => setBillType(e.target.value)}
                disabled={submitting}
              >
                {availableTypes.map((t) => (
                  <option key={t} value={t} className="bg-surface-2 text-fg">
                    {formatType(t)}
                  </option>
                ))}
                <option value={CUSTOM_SENTINEL} className="bg-surface-2 text-fg-muted">
                  + Add custom type…
                </option>
              </SelectField>
            )}

            <Input
              label="Amount (৳)"
              type="text"
              required
              placeholder="e.g. 1200.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              disabled={submitting}
            />
            <Input
              label="Paid At"
              type="date"
              required
              value={paidAt}
              onChange={(e) => setPaidAt(e.target.value)}
              disabled={submitting}
            />
            <Input
              label="Note (optional)"
              type="text"
              placeholder="e.g. Invoice #42"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              disabled={submitting}
            />
          </div>
          {error && <p className="text-sm text-danger">{error}</p>}
          <div className="flex items-center gap-3">
            <Button type="submit" loading={submitting}>
              {submitting
                ? editing ? "Saving…" : "Adding…"
                : editing ? "Save Changes" : "Add Bill"}
            </Button>
            <Button type="button" variant="ghost" onClick={onCancel} disabled={submitting}>
              Cancel
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

/* ── Delete confirm ────────────────────────────────────────────────── */

interface DeleteConfirmProps {
  bill: UtilityBillResponse;
  onConfirm: () => void;
  onCancel: () => void;
  deleting: boolean;
}

function DeleteConfirm({ bill, onConfirm, onCancel, deleting }: DeleteConfirmProps) {
  return (
    <div className="mb-6 animate-fade-up">
      <Card title="Delete bill?">
        <p className="text-sm text-fg-muted pt-1 pb-4">
          Are you sure you want to delete the{" "}
          <span className="text-fg font-medium">{formatType(bill.type)}</span> bill for{" "}
          <span className="text-fg font-medium">{formatMonth(bill.month)}</span>? This cannot be undone.
        </p>
        <div className="flex items-center gap-3">
          <Button variant="danger" loading={deleting} onClick={onConfirm}>
            {deleting ? "Deleting…" : "Delete Bill"}
          </Button>
          <Button type="button" variant="ghost" onClick={onCancel} disabled={deleting}>
            Cancel
          </Button>
        </div>
      </Card>
    </div>
  );
}

/* ── Desktop row ───────────────────────────────────────────────────── */

interface BillRowProps {
  bill: UtilityBillResponse;
  isLast: boolean;
  isAdmin: boolean;
  onEdit: (bill: UtilityBillResponse) => void;
  onDelete: (bill: UtilityBillResponse) => void;
}

function BillRow({ bill, isLast, isAdmin, onEdit, onDelete }: BillRowProps) {
  return (
    <tr
      className={[
        "hover:bg-surface-2/40 transition-colors",
        !isLast ? "border-b border-border" : "",
      ].join(" ")}
    >
      <td className="px-5 py-3.5 text-fg font-medium text-sm">{formatMonth(bill.month)}</td>
      <td className="px-5 py-3.5 text-fg-muted text-sm">{formatType(bill.type)}</td>
      <td className="px-5 py-3.5"><Money amount={bill.amount} size="sm" /></td>
      <td className="px-5 py-3.5 text-fg-muted text-xs">{bill.paid_by.name}</td>
      <td className="px-5 py-3.5 text-fg-muted text-xs">{formatDate(bill.paid_at)}</td>
      <td className="px-5 py-3.5 text-fg-muted text-xs">{bill.note ?? "—"}</td>
      {isAdmin && (
        <td className="px-5 py-3.5">
          <div className="flex items-center gap-2">
            <button
              onClick={() => onEdit(bill)}
              className="text-xs text-fg-muted hover:text-accent transition-colors"
            >
              Edit
            </button>
            <span className="text-border">·</span>
            <button
              onClick={() => onDelete(bill)}
              className="text-xs text-fg-muted hover:text-danger transition-colors"
            >
              Delete
            </button>
          </div>
        </td>
      )}
    </tr>
  );
}

/* ── Mobile card ───────────────────────────────────────────────────── */

interface BillCardProps {
  bill: UtilityBillResponse;
  isAdmin: boolean;
  onEdit: (bill: UtilityBillResponse) => void;
  onDelete: (bill: UtilityBillResponse) => void;
}

function BillCard({ bill, isAdmin, onEdit, onDelete }: BillCardProps) {
  return (
    <div className="rounded-lg bg-surface-2 border border-border p-4">
      <div className="flex items-start justify-between gap-2 mb-3">
        <div>
          <div className="text-fg font-semibold text-sm">{formatMonth(bill.month)}</div>
          <div className="text-fg-muted text-xs mt-0.5">{formatType(bill.type)}</div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <Money amount={bill.amount} size="sm" variant="emphasis" />
          {isAdmin && (
            <>
              <button
                onClick={() => onEdit(bill)}
                className="text-xs text-fg-muted hover:text-accent transition-colors"
              >
                Edit
              </button>
              <button
                onClick={() => onDelete(bill)}
                className="text-xs text-fg-muted hover:text-danger transition-colors"
              >
                Delete
              </button>
            </>
          )}
        </div>
      </div>
      <div className="space-y-1 text-xs text-fg-muted">
        <div className="flex justify-between">
          <span>Paid by</span>
          <span>{bill.paid_by.name}</span>
        </div>
        <div className="flex justify-between">
          <span>Paid at</span>
          <span>{formatDate(bill.paid_at)}</span>
        </div>
        {bill.note && (
          <div className="flex justify-between gap-4">
            <span className="shrink-0">Note</span>
            <span className="text-right">{bill.note}</span>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Page shell ────────────────────────────────────────────────────── */

export default function BillsPage() {
  return (
    <ProtectedRoute>
      <BillsContent />
    </ProtectedRoute>
  );
}

/* ── Main content ──────────────────────────────────────────────────── */

function BillsContent() {
  const { user, logout } = useAuth();
  const { data: bills, loading, error, reload } = useApiData<UtilityBillResponse[]>("/api/v1/bills");
  const { data: typesData, reload: reloadTypes } = useApiData<{ types: string[] }>("/api/v1/bills/types");

  // Fall back to the 5 defaults while the types endpoint is still loading.
  const availableTypes = typesData?.types ?? DEFAULT_TYPES;

  const [formMode, setFormMode] = useState<FormMode>(null);
  const [deleteTarget, setDeleteTarget] = useState<UtilityBillResponse | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");

  const isAdmin = user?.is_admin ?? false;

  function handleSuccess(msg: string) {
    setFormMode(null);
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(""), 4000);
  }

  async function handleDeleteConfirm() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await apiAuthDelete(`/api/v1/bills/${deleteTarget.id}`);
      await reload();
      const msg = "Bill deleted.";
      setDeleteTarget(null);
      setSuccessMsg(msg);
      setTimeout(() => setSuccessMsg(""), 4000);
    } catch (err: unknown) {
      if (err instanceof UnauthorizedError) {
        logout();
        return;
      }
      const msg = err instanceof Error ? err.message : String(err);
      setSuccessMsg("");
      alert(msg);
    } finally {
      setDeleting(false);
    }
  }

  // Month desc, then paid_at desc — ISO strings compare correctly as-is.
  const sorted = bills
    ? [...bills].sort((a, b) => {
        if (b.month !== a.month) return b.month.localeCompare(a.month);
        return b.paid_at.localeCompare(a.paid_at);
      })
    : [];

  return (
    <AppShell>
      <div className="p-6 md:p-8 max-w-5xl">

        {/* Page header */}
        <div className="flex items-start justify-between gap-4 mb-6 animate-fade-up">
          <div>
            <h1 className="font-display text-2xl font-bold text-fg tracking-tight">Bills</h1>
            {bills !== null && (
              <p className="text-sm text-fg-muted mt-0.5">
                {bills.length} bill{bills.length !== 1 ? "s" : ""}
              </p>
            )}
          </div>
          {isAdmin && !formMode && !deleteTarget && (
            <Button size="sm" onClick={() => setFormMode({ kind: "add" })}>
              Add Bill
            </Button>
          )}
        </div>

        {/* Success toast */}
        {successMsg && (
          <p className="text-sm text-success mb-4 animate-fade-up">{successMsg}</p>
        )}

        {/* Delete confirm */}
        {deleteTarget && (
          <DeleteConfirm
            bill={deleteTarget}
            onConfirm={handleDeleteConfirm}
            onCancel={() => setDeleteTarget(null)}
            deleting={deleting}
          />
        )}

        {/* Add / edit form */}
        {formMode && (
          <BillForm
            mode={formMode}
            availableTypes={availableTypes}
            onSuccess={handleSuccess}
            onCancel={() => setFormMode(null)}
            onReload={reload}
            onReloadTypes={reloadTypes}
            onUnauthorized={logout}
          />
        )}

        {/* Loading */}
        {loading && !bills && (
          <StatusMessage
            kind="loading"
            message="Loading bills — first load may take up to 60 seconds…"
          />
        )}

        {/* Error */}
        {error && <StatusMessage kind="error" message={error} onRetry={reload} />}

        {/* Empty */}
        {!loading && !error && bills && bills.length === 0 && (
          <StatusMessage kind="empty" message="No bills yet." />
        )}

        {/* Desktop table */}
        {bills && bills.length > 0 && !error && (
          <>
            <div
              className="hidden md:block rounded-xl bg-surface-1 border border-border overflow-hidden animate-fade-up delay-75"
              style={{ boxShadow: "var(--shadow-card)" }}
            >
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-surface-2/50">
                    <th className="text-left px-5 py-3 text-xs font-semibold text-fg-muted uppercase tracking-wider">Month</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-fg-muted uppercase tracking-wider">Type</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-fg-muted uppercase tracking-wider">Amount</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-fg-muted uppercase tracking-wider">Paid By</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-fg-muted uppercase tracking-wider">Paid At</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-fg-muted uppercase tracking-wider">Note</th>
                    {isAdmin && <th className="px-5 py-3" />}
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((bill, i) => (
                    <BillRow
                      key={bill.id}
                      bill={bill}
                      isLast={i === sorted.length - 1}
                      isAdmin={isAdmin}
                      onEdit={(b) => { setDeleteTarget(null); setFormMode({ kind: "edit", bill: b }); }}
                      onDelete={(b) => { setFormMode(null); setDeleteTarget(b); }}
                    />
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile stacked cards */}
            <div className="md:hidden space-y-3 animate-fade-up delay-75">
              {sorted.map((bill) => (
                <BillCard
                  key={bill.id}
                  bill={bill}
                  isAdmin={isAdmin}
                  onEdit={(b) => { setDeleteTarget(null); setFormMode({ kind: "edit", bill: b }); }}
                  onDelete={(b) => { setFormMode(null); setDeleteTarget(b); }}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
