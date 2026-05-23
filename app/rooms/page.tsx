"use client";

import { useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { apiAuthPost, apiAuthPatch, apiAuthDelete, UnauthorizedError } from "../../lib/api";
import { useApiData } from "../../lib/useApiData";
import { ProtectedRoute } from "../../components/ProtectedRoute";
import { AppShell } from "../../components/AppShell";
import { StatusMessage } from "../../components/ui/StatusMessage";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Card } from "../../components/ui/Card";
import { Money } from "../../components/ui/Money";

/* ── Types ─────────────────────────────────────────────────────────── */

interface RoomResponse {
  id: number;
  household_id: number;
  name: string;
  monthly_rent: string;
  monthly_service_charge: string;
  created_at: string;
  updated_at: string;
}

type FormMode = { kind: "add" } | { kind: "edit"; room: RoomResponse } | null;

/* ── Helpers ───────────────────────────────────────────────────────── */

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

/* ── Room form ─────────────────────────────────────────────────────── */

interface RoomFormProps {
  mode: FormMode;
  onSuccess: (msg: string) => void;
  onCancel: () => void;
  onReload: () => Promise<void>;
  onUnauthorized: () => void;
}

function RoomForm({ mode, onSuccess, onCancel, onReload, onUnauthorized }: RoomFormProps) {
  const editing = mode?.kind === "edit";
  const existing = editing ? mode.room : null;

  const [name, setName] = useState(existing?.name ?? "");
  const [monthlyRent, setMonthlyRent] = useState(existing?.monthly_rent ?? "");
  const [monthlyServiceCharge, setMonthlyServiceCharge] = useState(
    existing?.monthly_service_charge ?? ""
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: { preventDefault(): void }) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      if (editing && existing) {
        const body: Record<string, string> = {};
        if (name !== existing.name) body.name = name;
        if (monthlyRent !== existing.monthly_rent) body.monthly_rent = monthlyRent;
        if (monthlyServiceCharge !== existing.monthly_service_charge)
          body.monthly_service_charge = monthlyServiceCharge;
        await apiAuthPatch<RoomResponse>(`/api/v1/rooms/${existing.id}`, body);
        await onReload();
        onSuccess(`Room "${name}" updated.`);
      } else {
        const body: Record<string, string> = { name, monthly_rent: monthlyRent };
        if (monthlyServiceCharge.trim()) body.monthly_service_charge = monthlyServiceCharge.trim();
        await apiAuthPost<RoomResponse>("/api/v1/rooms", body);
        await onReload();
        onSuccess(`Room "${name}" created.`);
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
      <Card title={editing ? `Edit "${existing?.name}"` : "Add a new room"}>
        <form onSubmit={handleSubmit} className="pt-1 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Input
              label="Room Name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={submitting}
            />
            <Input
              label="Monthly Rent (৳)"
              type="text"
              required
              placeholder="e.g. 8000.00"
              value={monthlyRent}
              onChange={(e) => setMonthlyRent(e.target.value)}
              disabled={submitting}
            />
            <Input
              label="Service Charge (৳, optional)"
              type="text"
              placeholder="e.g. 500.00"
              value={monthlyServiceCharge}
              onChange={(e) => setMonthlyServiceCharge(e.target.value)}
              disabled={submitting}
            />
          </div>
          {error && <p className="text-sm text-danger">{error}</p>}
          <div className="flex items-center gap-3">
            <Button type="submit" loading={submitting}>
              {submitting ? (editing ? "Saving…" : "Creating…") : editing ? "Save Changes" : "Create Room"}
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
  room: RoomResponse;
  onConfirm: () => void;
  onCancel: () => void;
  deleting: boolean;
}

function DeleteConfirm({ room, onConfirm, onCancel, deleting }: DeleteConfirmProps) {
  return (
    <div className="mb-6 animate-fade-up">
      <Card title="Delete room?">
        <p className="text-sm text-fg-muted pt-1 pb-4">
          Are you sure you want to delete <span className="text-fg font-medium">{room.name}</span>? This cannot be undone.
        </p>
        <div className="flex items-center gap-3">
          <Button variant="danger" loading={deleting} onClick={onConfirm}>
            {deleting ? "Deleting…" : "Delete Room"}
          </Button>
          <Button type="button" variant="ghost" onClick={onCancel} disabled={deleting}>
            Cancel
          </Button>
        </div>
      </Card>
    </div>
  );
}

/* ── Row / Card ────────────────────────────────────────────────────── */

interface RoomRowProps {
  room: RoomResponse;
  isLast: boolean;
  isAdmin: boolean;
  onEdit: (room: RoomResponse) => void;
  onDelete: (room: RoomResponse) => void;
}

function RoomRow({ room, isLast, isAdmin, onEdit, onDelete }: RoomRowProps) {
  const total = addDecimalStrings(room.monthly_rent, room.monthly_service_charge);
  return (
    <tr className={["hover:bg-surface-2/40 transition-colors", !isLast ? "border-b border-border" : ""].join(" ")}>
      <td className="px-5 py-3.5 text-fg font-medium text-sm">{room.name}</td>
      <td className="px-5 py-3.5">
        <Money amount={room.monthly_rent} size="sm" />
      </td>
      <td className="px-5 py-3.5">
        <Money amount={room.monthly_service_charge} size="sm" variant="default" />
      </td>
      <td className="px-5 py-3.5">
        <Money amount={total} size="sm" variant="emphasis" />
      </td>
      {isAdmin && (
        <td className="px-5 py-3.5">
          <div className="flex items-center gap-2">
            <button
              onClick={() => onEdit(room)}
              className="text-xs text-fg-muted hover:text-accent transition-colors"
            >
              Edit
            </button>
            <span className="text-border">·</span>
            <button
              onClick={() => onDelete(room)}
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

interface RoomCardProps {
  room: RoomResponse;
  isAdmin: boolean;
  onEdit: (room: RoomResponse) => void;
  onDelete: (room: RoomResponse) => void;
}

function RoomCard({ room, isAdmin, onEdit, onDelete }: RoomCardProps) {
  const total = addDecimalStrings(room.monthly_rent, room.monthly_service_charge);
  return (
    <div className="rounded-lg bg-surface-2 border border-border p-4">
      <div className="flex items-start justify-between gap-2 mb-3">
        <span className="text-fg font-semibold text-sm">{room.name}</span>
        {isAdmin && (
          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={() => onEdit(room)}
              className="text-xs text-fg-muted hover:text-accent transition-colors"
            >
              Edit
            </button>
            <button
              onClick={() => onDelete(room)}
              className="text-xs text-fg-muted hover:text-danger transition-colors"
            >
              Delete
            </button>
          </div>
        )}
      </div>
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-fg-muted text-xs">Rent</span>
          <Money amount={room.monthly_rent} size="sm" />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-fg-muted text-xs">Service charge</span>
          <Money amount={room.monthly_service_charge} size="sm" />
        </div>
        <div className="flex items-center justify-between pt-1.5 border-t border-border">
          <span className="text-fg-muted text-xs font-medium">Total / month</span>
          <Money amount={total} size="sm" variant="emphasis" />
        </div>
      </div>
    </div>
  );
}

/* ── Page shell ────────────────────────────────────────────────────── */

export default function RoomsPage() {
  return (
    <ProtectedRoute>
      <RoomsContent />
    </ProtectedRoute>
  );
}

/* ── Main content ──────────────────────────────────────────────────── */

function RoomsContent() {
  const { user, logout } = useAuth();
  const { data: rooms, loading, error, reload } = useApiData<RoomResponse[]>("/api/v1/rooms");

  const [formMode, setFormMode] = useState<FormMode>(null);
  const [deleteTarget, setDeleteTarget] = useState<RoomResponse | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [deleteError, setDeleteError] = useState("");

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
      await apiAuthDelete(`/api/v1/rooms/${deleteTarget.id}`);
      await reload();
      const msg = `Room "${deleteTarget.name}" deleted.`;
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
      setDeleteError(msg);
      setTimeout(() => setDeleteError(""), 4000);
    } finally {
      setDeleting(false);
    }
  }

  const sorted = rooms ? [...rooms].sort((a, b) => a.name.localeCompare(b.name)) : [];

  return (
    <AppShell>
      <div className="p-6 md:p-8 max-w-5xl">

        {/* Page header */}
        <div className="flex items-start justify-between gap-4 mb-6 animate-fade-up">
          <div>
            <h1 className="font-display text-2xl font-bold text-fg tracking-tight">Rooms</h1>
            {rooms !== null && (
              <p className="text-sm text-fg-muted mt-0.5">
                {rooms.length} room{rooms.length !== 1 ? "s" : ""}
              </p>
            )}
          </div>
          {isAdmin && !formMode && !deleteTarget && (
            <Button size="sm" onClick={() => setFormMode({ kind: "add" })}>
              Add Room
            </Button>
          )}
        </div>

        {/* Success / error toasts */}
        {successMsg && (
          <p className="text-sm text-success mb-4 animate-fade-up">{successMsg}</p>
        )}
        {deleteError && (
          <p className="text-sm text-danger mb-4 animate-fade-up">{deleteError}</p>
        )}

        {/* Delete confirm */}
        {deleteTarget && (
          <DeleteConfirm
            room={deleteTarget}
            onConfirm={handleDeleteConfirm}
            onCancel={() => setDeleteTarget(null)}
            deleting={deleting}
          />
        )}

        {/* Add / edit form */}
        {formMode && (
          <RoomForm
            mode={formMode}
            onSuccess={handleSuccess}
            onCancel={() => setFormMode(null)}
            onReload={reload}
            onUnauthorized={logout}
          />
        )}

        {/* Loading */}
        {loading && !rooms && (
          <StatusMessage
            kind="loading"
            message="Loading rooms — first load may take up to 60 seconds…"
          />
        )}

        {/* Error */}
        {error && <StatusMessage kind="error" message={error} onRetry={reload} />}

        {/* Empty */}
        {!loading && !error && rooms && rooms.length === 0 && (
          <StatusMessage kind="empty" message="No rooms yet." />
        )}

        {/* Desktop table */}
        {rooms && rooms.length > 0 && !error && (
          <>
            <div
              className="hidden md:block rounded-xl bg-surface-1 border border-border overflow-hidden animate-fade-up delay-75"
              style={{ boxShadow: "var(--shadow-card)" }}
            >
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-surface-2/50">
                    <th className="text-left px-5 py-3 text-xs font-semibold text-fg-muted uppercase tracking-wider">Room</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-fg-muted uppercase tracking-wider">Rent</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-fg-muted uppercase tracking-wider">Service</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-fg-muted uppercase tracking-wider">Total / mo</th>
                    {isAdmin && <th className="px-5 py-3" />}
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((room, i) => (
                    <RoomRow
                      key={room.id}
                      room={room}
                      isLast={i === sorted.length - 1}
                      isAdmin={isAdmin}
                      onEdit={(r) => { setDeleteTarget(null); setFormMode({ kind: "edit", room: r }); }}
                      onDelete={(r) => { setFormMode(null); setDeleteTarget(r); }}
                    />
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile stacked cards */}
            <div className="md:hidden space-y-3 animate-fade-up delay-75">
              {sorted.map((room) => (
                <RoomCard
                  key={room.id}
                  room={room}
                  isAdmin={isAdmin}
                  onEdit={(r) => { setDeleteTarget(null); setFormMode({ kind: "edit", room: r }); }}
                  onDelete={(r) => { setFormMode(null); setDeleteTarget(r); }}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
