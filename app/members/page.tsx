"use client";

import { useState } from "react";
import { useAuth } from "../../context/AuthContext";
import type { UserResponse } from "../../context/AuthContext";
import { apiAuthPost, UnauthorizedError } from "../../lib/api";
import { useApiData } from "../../lib/useApiData";
import { ProtectedRoute } from "../../components/ProtectedRoute";
import { AppShell } from "../../components/AppShell";
import { StatusMessage } from "../../components/ui/StatusMessage";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Card } from "../../components/ui/Card";

/* ── Types ─────────────────────────────────────────────────────────── */

// Extends the auth context's UserResponse with the left_at field
// the members endpoint returns but auth/me omits.
interface MemberResponse extends UserResponse {
  left_at: string | null;
}

interface InviteUserResponse {
  user: MemberResponse;
  email_sent: boolean;
}

/* ── Helpers ───────────────────────────────────────────────────────── */

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/* ── Sub-components ────────────────────────────────────────────────── */

function AdminBadge() {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-accent/10 text-accent border border-accent/20 glow-sm">
      Admin
    </span>
  );
}

function YouBadge() {
  return (
    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-accent/10 text-accent">
      You
    </span>
  );
}

function ActiveStatus({ leftAt }: { leftAt: string | null }) {
  return leftAt === null ? (
    <span className="text-success text-xs font-medium">Active</span>
  ) : (
    <span className="text-fg-subtle text-xs">Left {formatDate(leftAt)}</span>
  );
}

interface RowProps {
  member: MemberResponse;
  isYou: boolean;
  isLast: boolean;
}

function MemberRow({ member, isYou, isLast }: RowProps) {
  const dimmed = member.left_at !== null;
  return (
    <tr
      className={[
        "hover:bg-surface-2/40 transition-colors",
        !isLast ? "border-b border-border" : "",
        dimmed ? "opacity-50" : "",
      ].join(" ")}
    >
      <td className="px-5 py-3.5">
        <div className="flex items-center gap-2">
          <span className="text-fg font-medium text-sm">{member.name}</span>
          {isYou && <YouBadge />}
        </div>
      </td>
      <td className="px-5 py-3.5 text-fg-muted text-sm">{member.email}</td>
      <td className="px-5 py-3.5">
        {member.is_admin ? <AdminBadge /> : <span className="text-fg-muted text-xs">Member</span>}
      </td>
      <td className="px-5 py-3.5 text-fg-muted text-xs">{formatDate(member.joined_at)}</td>
      <td className="px-5 py-3.5">
        <ActiveStatus leftAt={member.left_at} />
      </td>
    </tr>
  );
}

function MemberCard({ member, isYou }: { member: MemberResponse; isYou: boolean }) {
  const dimmed = member.left_at !== null;
  return (
    <div
      className={[
        "rounded-lg bg-surface-2 border border-border p-4 transition-opacity",
        dimmed ? "opacity-50" : "",
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-2 mb-2.5">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-fg font-semibold text-sm">{member.name}</span>
            {isYou && <YouBadge />}
          </div>
          <p className="text-fg-muted text-xs mt-0.5">{member.email}</p>
        </div>
        {member.is_admin ? <AdminBadge /> : <span className="text-fg-subtle text-xs mt-0.5">Member</span>}
      </div>
      <div className="flex items-center justify-between">
        <span className="text-fg-muted text-xs">Joined {formatDate(member.joined_at)}</span>
        <ActiveStatus leftAt={member.left_at} />
      </div>
    </div>
  );
}

/* ── Invite form ───────────────────────────────────────────────────── */

interface InviteFormProps {
  onSuccess: (msg: string) => void;
  onCancel: () => void;
  onReload: () => void;
  onUnauthorized: () => void;
}

function InviteForm({ onSuccess, onCancel, onReload, onUnauthorized }: InviteFormProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [roomId, setRoomId] = useState("");
  const [depositAmount, setDepositAmount] = useState("");
  const [effectiveMonth, setEffectiveMonth] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: { preventDefault(): void }) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const result = await apiAuthPost<InviteUserResponse>("/api/v1/users/invite", {
        name,
        email,
        room_id: parseInt(roomId, 10),
        deposit_amount: depositAmount,
        ...(effectiveMonth.trim() ? { effective_month: effectiveMonth.trim() } : {}),
      });
      const label = result.email_sent
        ? `${result.user.name} invited — invite email sent.`
        : `${result.user.name} invited.`;
      onReload();
      onSuccess(label);
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
      <Card title="Invite a new member">
        <form onSubmit={handleSubmit} className="pt-1 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={submitting}
            />
            <Input
              label="Email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={submitting}
            />
            <Input
              label="Room ID"
              type="number"
              required
              min={1}
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              disabled={submitting}
            />
            <Input
              label="Deposit Amount (৳)"
              type="text"
              required
              placeholder="e.g. 5000.00"
              value={depositAmount}
              onChange={(e) => setDepositAmount(e.target.value)}
              disabled={submitting}
            />
            <Input
              label="Effective Month (optional)"
              type="text"
              placeholder="YYYY-MM"
              value={effectiveMonth}
              onChange={(e) => setEffectiveMonth(e.target.value)}
              disabled={submitting}
            />
          </div>
          {error && <p className="text-sm text-danger">{error}</p>}
          <div className="flex items-center gap-3">
            <Button type="submit" loading={submitting}>
              {submitting ? "Inviting…" : "Send Invite"}
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

/* ── Page shell ────────────────────────────────────────────────────── */

export default function MembersPage() {
  return (
    <ProtectedRoute>
      <MembersContent />
    </ProtectedRoute>
  );
}

/* ── Main content ──────────────────────────────────────────────────── */

function MembersContent() {
  const { user, logout } = useAuth();
  const { data: members, loading, error, reload } = useApiData<MemberResponse[]>("/api/v1/users");

  const [showInvite, setShowInvite] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");

  function handleInviteSuccess(msg: string) {
    setShowInvite(false);
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(""), 4000);
  }

  // Sort: active members first (left_at null), then left; within each group by joined_at asc
  const sorted = members
    ? [...members].sort((a, b) => {
        const aLeft = a.left_at !== null;
        const bLeft = b.left_at !== null;
        if (aLeft !== bLeft) return aLeft ? 1 : -1;
        return new Date(a.joined_at).getTime() - new Date(b.joined_at).getTime();
      })
    : [];

  const activeCount = members ? members.filter((m) => m.left_at === null).length : null;

  return (
    <AppShell>
      <div className="p-6 md:p-8 max-w-5xl">

        {/* Page header */}
        <div className="flex items-start justify-between gap-4 mb-6 animate-fade-up">
          <div>
            <h1 className="font-display text-2xl font-bold text-fg tracking-tight">Members</h1>
            {activeCount !== null && (
              <p className="text-sm text-fg-muted mt-0.5">
                {activeCount} active member{activeCount !== 1 ? "s" : ""}
              </p>
            )}
          </div>
          {user?.is_admin && !showInvite && (
            <Button size="sm" onClick={() => setShowInvite(true)}>
              Invite Member
            </Button>
          )}
        </div>

        {/* Success toast */}
        {successMsg && (
          <p className="text-sm text-success mb-4 animate-fade-up">{successMsg}</p>
        )}

        {/* Invite form — admin only */}
        {showInvite && (
          <InviteForm
            onSuccess={handleInviteSuccess}
            onCancel={() => setShowInvite(false)}
            onReload={reload}
            onUnauthorized={logout}
          />
        )}

        {/* Loading — only on initial fetch (no data yet) */}
        {loading && !members && (
          <StatusMessage
            kind="loading"
            message="Loading members — first load may take up to 60 seconds…"
          />
        )}

        {/* Error state */}
        {error && (
          <StatusMessage kind="error" message={error} onRetry={reload} />
        )}

        {/* Empty state */}
        {!loading && !error && members && members.length === 0 && (
          <StatusMessage kind="empty" message="No members yet." />
        )}

        {/* Desktop table */}
        {members && members.length > 0 && !error && (
          <>
            <div className="hidden md:block rounded-xl bg-surface-1 border border-border overflow-hidden animate-fade-up delay-75" style={{ boxShadow: "var(--shadow-card)" }}>
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-surface-2/50">
                    <th className="text-left px-5 py-3 text-xs font-semibold text-fg-muted uppercase tracking-wider">
                      Name
                    </th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-fg-muted uppercase tracking-wider">
                      Email
                    </th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-fg-muted uppercase tracking-wider">
                      Role
                    </th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-fg-muted uppercase tracking-wider">
                      Joined
                    </th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-fg-muted uppercase tracking-wider">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((member, i) => (
                    <MemberRow
                      key={member.id}
                      member={member}
                      isYou={member.id === user?.id}
                      isLast={i === sorted.length - 1}
                    />
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile stacked cards */}
            <div className="md:hidden space-y-3 animate-fade-up delay-75">
              {sorted.map((member) => (
                <MemberCard
                  key={member.id}
                  member={member}
                  isYou={member.id === user?.id}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
