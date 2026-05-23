"use client";

import { useState, useRef } from "react";
import { useAuth } from "../../context/AuthContext";
import {
  apiAuthPost,
  apiAuthPostForm,
  apiAuthPatch,
  UnauthorizedError,
} from "../../lib/api";
import { useApiData } from "../../lib/useApiData";
import { addDecimalStrings } from "../../lib/money";
import { ProtectedRoute } from "../../components/ProtectedRoute";
import { AppShell } from "../../components/AppShell";
import { StatusMessage } from "../../components/ui/StatusMessage";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Money } from "../../components/ui/Money";

/* ── Types ─────────────────────────────────────────────────────────── */

interface UserMini { id: number; name: string; }

interface UserResponse {
  id: number;
  name: string;
  left_at: string | null;
}

interface AssetContributionResponse {
  id: number;
  asset_id: number;
  user: UserMini;
  amount: string;
  contributed_at: string;
  contribution_type: string;
  created_at: string;
}

interface AssetRefundResponse {
  id: number;
  asset_id: number;
  user: UserMini;
  amount: string;
  refunded_at: string;
  paid_by: UserMini | null;
  replaced_by: UserMini | null;
  created_at: string;
}

interface SharedAssetResponse {
  id: number;
  household_id: number;
  name: string;
  description: string | null;
  photo_url: string | null;
  purchase_date: string;
  total_cost: string;
  requires_buyin_from_new_members: boolean;
  status: "active" | "disposed";
  bought_by: UserMini;
  created_at: string;
  updated_at: string;
  contributions: AssetContributionResponse[];
  refunds: AssetRefundResponse[];
}

type FilterTab = "all" | "active" | "disposed";

interface ContribRow { _key: string; userId: string; amount: string; }

/* ── Helpers ──────────────────────────────────────────────────────── */

function priceToCents(s: string): bigint {
  const t = s.trim();
  const neg = t.startsWith("-");
  const abs = neg ? t.slice(1) : t;
  const [intStr = "0", fracStr = ""] = abs.split(".");
  const cents = BigInt(intStr) * 100n + BigInt((fracStr + "00").slice(0, 2));
  return neg ? -cents : cents;
}

function centsToDecStr(c: bigint): string {
  const neg = c < 0n;
  const abs = neg ? -c : c;
  return `${neg ? "-" : ""}${abs / 100n}.${(abs % 100n).toString().padStart(2, "0")}`;
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

function formatDate(s: string): string {
  const [y, m, d] = s.split("-");
  return new Date(Date.UTC(+y, +m - 1, +d)).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function todayIso(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

const DECIMAL_RE = /^\d+(\.\d{1,2})?$/;

function sumContribs(contributions: AssetContributionResponse[]): string {
  return contributions.reduce<string>(
    (acc, c) => addDecimalStrings(acc, c.amount),
    "0.00"
  );
}

/* ── Page shell ────────────────────────────────────────────────────── */

export default function AssetsPage() {
  return (
    <ProtectedRoute>
      <AssetsContent />
    </ProtectedRoute>
  );
}

/* ── Main content ──────────────────────────────────────────────────── */

function AssetsContent() {
  const { user, logout } = useAuth();
  const isAdmin = user?.is_admin ?? false;

  const {
    data: assets,
    loading: assetsLoading,
    error: assetsError,
    reload: reloadAssets,
  } = useApiData<SharedAssetResponse[]>("/api/v1/assets");

  const { data: usersData } = useApiData<UserResponse[]>("/api/v1/users");
  const activeUsers = (usersData ?? []).filter((u) => u.left_at === null);

  const [filter, setFilter] = useState<FilterTab>("active");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [disposingId, setDisposingId] = useState<number | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  async function handleDispose(asset: SharedAssetResponse) {
    if (
      !window.confirm(
        `Mark "${asset.name}" as disposed? This is reversible via editing.`
      )
    ) return;
    setActionError(null);
    setActionSuccess(null);
    setDisposingId(asset.id);
    try {
      await apiAuthPost(`/api/v1/assets/${asset.id}/dispose`, {});
      await reloadAssets();
      setActionSuccess(`"${asset.name}" marked as disposed.`);
    } catch (err: unknown) {
      if (err instanceof UnauthorizedError) { logout(); return; }
      const msg = err instanceof Error ? err.message : String(err);
      setActionError(extractErrorMessage(msg));
    } finally {
      setDisposingId(null);
    }
  }

  const filtered = assets
    ? filter === "all"
      ? assets
      : assets.filter((a) => a.status === filter)
    : [];

  const filterTabs: { key: FilterTab; label: string }[] = [
    { key: "active", label: "Active" },
    { key: "disposed", label: "Disposed" },
    { key: "all", label: "All" },
  ];

  return (
    <AppShell>
      <div className="p-6 md:p-8 max-w-4xl space-y-8">

        {/* Header */}
        <div className="animate-fade-up">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="font-display text-2xl font-bold text-fg tracking-tight">
                Shared Assets
              </h1>
              <p className="text-sm text-fg-muted mt-0.5">
                Furniture, appliances, and shared belongings
              </p>
            </div>
            {isAdmin && !showCreate && (
              <Button
                size="sm"
                onClick={() => {
                  setShowCreate(true);
                  setActionError(null);
                  setActionSuccess(null);
                }}
              >
                + Add Asset
              </Button>
            )}
          </div>

          {/* Filter tabs */}
          <div className="flex gap-2 mt-4">
            {filterTabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setFilter(tab.key)}
                className={[
                  "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                  filter === tab.key
                    ? "bg-accent text-bg"
                    : "bg-surface-2 text-fg-muted hover:text-fg hover:bg-surface-3",
                ].join(" ")}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Create form */}
        {showCreate && (
          <CreateAssetForm
            activeUsers={activeUsers}
            onSuccess={async () => {
              await reloadAssets();
              setShowCreate(false);
              setActionSuccess("Asset added.");
            }}
            onCancel={() => setShowCreate(false)}
          />
        )}

        {/* Action feedback */}
        {actionSuccess && (
          <p className="text-sm text-success animate-fade-up">{actionSuccess}</p>
        )}
        {actionError && (
          <p className="text-sm text-danger animate-fade-up">{actionError}</p>
        )}

        {/* Loading / error */}
        {assetsLoading && !assets && (
          <StatusMessage kind="loading" message="Loading assets…" />
        )}
        {assetsError && (
          <StatusMessage kind="error" message={assetsError} onRetry={reloadAssets} />
        )}

        {/* Empty state */}
        {!assetsLoading && !assetsError && assets && filtered.length === 0 && (
          <StatusMessage
            kind="empty"
            message={
              filter === "all"
                ? "No assets recorded yet."
                : filter === "active"
                ? "No active assets."
                : "No disposed assets."
            }
          />
        )}

        {/* Asset list */}
        {filtered.map((asset) => (
          <AssetCard
            key={asset.id}
            asset={asset}
            isAdmin={isAdmin}
            expanded={expandedId === asset.id}
            onToggleExpand={() =>
              setExpandedId((prev) => (prev === asset.id ? null : asset.id))
            }
            editingId={editingId}
            onStartEdit={() => setEditingId(asset.id)}
            onCancelEdit={() => setEditingId(null)}
            onEditSuccess={async () => {
              await reloadAssets();
              setEditingId(null);
              setActionSuccess("Asset updated.");
            }}
            onDispose={handleDispose}
            disposingId={disposingId}
          />
        ))}

      </div>
    </AppShell>
  );
}

/* ── Asset card ────────────────────────────────────────────────────── */

interface AssetCardProps {
  asset: SharedAssetResponse;
  isAdmin: boolean;
  expanded: boolean;
  onToggleExpand: () => void;
  editingId: number | null;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onEditSuccess: () => Promise<void>;
  onDispose: (asset: SharedAssetResponse) => Promise<void>;
  disposingId: number | null;
}

function AssetCard({
  asset,
  isAdmin,
  expanded,
  onToggleExpand,
  editingId,
  onStartEdit,
  onCancelEdit,
  onEditSuccess,
  onDispose,
  disposingId,
}: AssetCardProps) {
  const sum = sumContribs(asset.contributions);
  const sumMatchesTotal = priceToCents(sum) === priceToCents(asset.total_cost);
  const isEditing = editingId === asset.id;
  const isDisposing = disposingId === asset.id;

  return (
    <div
      className="rounded-xl bg-surface-1 border border-border animate-fade-up"
      style={{ boxShadow: "var(--shadow-card)" }}
    >
      {/* Collapsed header — always visible */}
      <button
        className="w-full text-left p-5 flex items-start gap-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 rounded-xl"
        onClick={onToggleExpand}
      >
        {/* Photo thumbnail */}
        {asset.photo_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={asset.photo_url}
            alt={asset.name}
            className="w-12 h-12 rounded-lg object-cover shrink-0 border border-border"
          />
        )}

        {/* Main info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-display font-bold text-fg">{asset.name}</span>
            <span
              className={[
                "text-xs px-2 py-0.5 rounded-full font-medium shrink-0",
                asset.status === "active"
                  ? "bg-success/10 text-success"
                  : "bg-surface-2 text-fg-muted",
              ].join(" ")}
            >
              {asset.status === "active" ? "Active" : "Disposed"}
            </span>
          </div>
          <p className="text-xs text-fg-muted mt-0.5">
            Bought by {asset.bought_by.name} on {formatDate(asset.purchase_date)}
          </p>
        </div>

        {/* Right: cost + contributor count */}
        <div className="text-right shrink-0">
          <Money amount={asset.total_cost} size="md" />
          <p className="text-xs text-fg-muted mt-0.5">
            {asset.contributions.length}{" "}
            contributor{asset.contributions.length !== 1 ? "s" : ""}
          </p>
        </div>

        <span className="text-fg-muted text-xs shrink-0 mt-1 select-none">
          {expanded ? "▲" : "▼"}
        </span>
      </button>

      {/* Expanded section */}
      {expanded && (
        <div className="border-t border-border px-5 pb-5 pt-4 space-y-5">

          {/* Description */}
          {asset.description && (
            <p className="text-sm text-fg-muted">{asset.description}</p>
          )}

          {/* Contributions */}
          <div>
            <h3 className="text-xs font-semibold text-fg-muted uppercase tracking-wider mb-2">
              Contributions
            </h3>
            {asset.contributions.length === 0 ? (
              <p className="text-sm text-fg-muted">No contributions recorded.</p>
            ) : (
              <div className="space-y-1.5">
                {asset.contributions.map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center justify-between gap-2 text-sm"
                  >
                    <span className="text-fg">
                      {c.user.name}
                      <span className="text-xs text-fg-muted ml-1.5">
                        {c.contribution_type}
                      </span>
                    </span>
                    <Money amount={c.amount} size="sm" />
                  </div>
                ))}
                <div className="flex items-center justify-between gap-2 pt-2 mt-1 border-t border-border">
                  <span className="text-xs text-fg-muted font-medium">Total</span>
                  <div className="flex items-center gap-2">
                    <Money amount={sum} size="sm" />
                    {!sumMatchesTotal && (
                      <span className="text-xs text-danger">
                        ⚠ doesn&apos;t match total cost
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Refunds */}
          {asset.refunds.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-fg-muted uppercase tracking-wider mb-1">
                Refunds
              </h3>
              <p className="text-xs text-fg-muted mb-2">
                Generated when a member leaves with active contributions
              </p>
              <div className="space-y-1.5">
                {asset.refunds.map((r) => (
                  <p key={r.id} className="text-sm text-fg-muted">
                    <span className="text-fg">{r.user.name}</span>
                    {" got back "}
                    <Money amount={r.amount} size="sm" />
                    {" on "}
                    {formatDate(r.refunded_at)}
                    {r.paid_by && ` (paid by ${r.paid_by.name})`}
                    {r.replaced_by && ` (replaced by ${r.replaced_by.name})`}
                  </p>
                ))}
              </div>
            </div>
          )}

          {/* Edit form */}
          {isEditing && (
            <EditAssetForm
              asset={asset}
              onSuccess={onEditSuccess}
              onCancel={onCancelEdit}
            />
          )}

          {/* Admin actions */}
          {isAdmin && !isEditing && (
            <div className="flex items-center gap-3 pt-1">
              <Button variant="secondary" size="sm" onClick={onStartEdit}>
                Edit
              </Button>
              {asset.status === "active" && (
                <Button
                  variant="danger"
                  size="sm"
                  loading={isDisposing}
                  onClick={() => onDispose(asset)}
                >
                  {isDisposing ? "Disposing…" : "Dispose"}
                </Button>
              )}
            </div>
          )}

        </div>
      )}
    </div>
  );
}

/* ── Create form ───────────────────────────────────────────────────── */

interface CreateAssetFormProps {
  activeUsers: UserResponse[];
  onSuccess: () => Promise<void>;
  onCancel: () => void;
}

function CreateAssetForm({ activeUsers, onSuccess, onCancel }: CreateAssetFormProps) {
  const { logout } = useAuth();
  const keyCounter = useRef(1);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [purchaseDate, setPurchaseDate] = useState(todayIso());
  const [totalCost, setTotalCost] = useState("");
  const [requiresBuyin, setRequiresBuyin] = useState(true);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [contributions, setContributions] = useState<ContribRow[]>([
    { _key: "0", userId: "", amount: "" },
  ]);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  function addContribRow() {
    setContributions((prev) => [
      ...prev,
      { _key: String(keyCounter.current++), userId: "", amount: "" },
    ]);
  }

  function removeContribRow(key: string) {
    setContributions((prev) => prev.filter((r) => r._key !== key));
  }

  function updateContrib(key: string, field: "userId" | "amount", value: string) {
    setContributions((prev) =>
      prev.map((r) => (r._key === key ? { ...r, [field]: value } : r))
    );
  }

  // Running total — only sum valid, non-empty amounts
  const contribRunningTotal = contributions.reduce<string>((acc, row) => {
    const amt = row.amount.trim();
    if (!amt || !DECIMAL_RE.test(amt)) return acc;
    try { return addDecimalStrings(acc, amt); } catch { return acc; }
  }, "0.00");

  const totalCostValid =
    DECIMAL_RE.test(totalCost.trim()) && priceToCents(totalCost) > 0n;
  const runningCents = priceToCents(contribRunningTotal);
  const totalCents = totalCostValid ? priceToCents(totalCost) : 0n;
  const diffCents = totalCents - runningCents;

  const canSubmit =
    !submitting &&
    name.trim() !== "" &&
    purchaseDate !== "" &&
    totalCostValid &&
    contributions.length > 0 &&
    contributions.every(
      (r) => r.userId !== "" && DECIMAL_RE.test(r.amount.trim())
    ) &&
    new Set(contributions.map((r) => r.userId)).size === contributions.length &&
    priceToCents(contribRunningTotal) === priceToCents(totalCost);

  async function handleSubmit(e: { preventDefault(): void }) {
    e.preventDefault();
    setFormError(null);

    if (!name.trim()) { setFormError("Name is required."); return; }
    if (!purchaseDate) { setFormError("Purchase date is required."); return; }
    if (!totalCostValid) {
      setFormError("Total cost must be a valid decimal number greater than zero.");
      return;
    }
    if (contributions.length === 0) {
      setFormError("At least one contributor is required.");
      return;
    }
    for (const row of contributions) {
      if (!row.userId) {
        setFormError("All contributors must have a user selected.");
        return;
      }
      if (!DECIMAL_RE.test(row.amount.trim())) {
        setFormError("All contribution amounts must be valid decimal numbers.");
        return;
      }
    }
    const userIds = contributions.map((r) => r.userId);
    if (new Set(userIds).size !== userIds.length) {
      setFormError("Each contributor can only appear once.");
      return;
    }
    if (priceToCents(contribRunningTotal) !== priceToCents(totalCost)) {
      const diff = priceToCents(totalCost) - priceToCents(contribRunningTotal);
      const diffStr = centsToDecStr(diff < 0n ? -diff : diff);
      setFormError(
        diff > 0n
          ? `Contributions are ৳${diffStr} short of the total cost.`
          : `Contributions exceed total cost by ৳${diffStr}.`
      );
      return;
    }

    setSubmitting(true);
    try {
      // contributions_json: snake_case field names, Number() only for the int cast of userId
      const contributionsJson = JSON.stringify(
        contributions.map((c) => ({
          user_id: Number(c.userId),
          amount: c.amount.trim(),
          contribution_type: "initial",
        }))
      );

      const fd = new FormData();
      fd.append("name", name.trim());
      if (description.trim()) fd.append("description", description.trim());
      fd.append("purchase_date", purchaseDate);
      fd.append("total_cost", totalCost.trim());
      fd.append("requires_buyin_from_new_members", String(requiresBuyin));
      fd.append("contributions_json", contributionsJson);
      if (photoFile) fd.append("photo", photoFile);

      await apiAuthPostForm<SharedAssetResponse>("/api/v1/assets", fd);
      await onSuccess();
    } catch (err: unknown) {
      if (err instanceof UnauthorizedError) { logout(); return; }
      const msg = err instanceof Error ? err.message : String(err);
      setFormError(extractErrorMessage(msg));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-xl bg-surface-1 border border-border p-6 space-y-5 animate-fade-up"
      style={{ boxShadow: "var(--shadow-card)" }}
    >
      <h2 className="text-sm font-semibold text-fg-muted uppercase tracking-wider">
        New Asset
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input
          label="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Refrigerator"
          required
        />
        <Input
          label="Description (optional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Brief notes"
        />
        <Input
          label="Purchase Date"
          type="date"
          value={purchaseDate}
          onChange={(e) => setPurchaseDate(e.target.value)}
          required
        />
        <Input
          label="Total Cost"
          value={totalCost}
          onChange={(e) => setTotalCost(e.target.value)}
          placeholder="0.00"
          inputMode="decimal"
        />
      </div>

      {/* Requires buy-in */}
      <label className="flex items-center gap-2 text-sm text-fg-muted cursor-pointer select-none">
        <input
          type="checkbox"
          checked={requiresBuyin}
          onChange={(e) => setRequiresBuyin(e.target.checked)}
          className="w-4 h-4 rounded border-border accent-accent"
        />
        Requires buy-in from new members
      </label>

      {/* Photo */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-fg-muted">Photo (optional)</label>
        <input
          type="file"
          accept="image/*"
          onChange={(e) => {
            const file = e.target.files?.[0] ?? null;
            setPhotoFile(file);
            setPhotoPreview(file ? URL.createObjectURL(file) : null);
          }}
          className="text-sm text-fg-muted file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-surface-2 file:text-fg hover:file:bg-surface-3 cursor-pointer"
        />
        {photoPreview && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photoPreview}
            alt="Preview"
            className="mt-1 w-20 h-20 rounded-lg object-cover border border-border"
          />
        )}
      </div>

      {/* Contributions */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm font-medium text-fg-muted">Contributors</span>
          {totalCostValid && (
            <span
              className={[
                "text-xs font-medium",
                diffCents === 0n
                  ? "text-success"
                  : diffCents > 0n
                  ? "text-accent"
                  : "text-danger",
              ].join(" ")}
            >
              {diffCents === 0n ? (
                "✓ Matches total"
              ) : diffCents > 0n ? (
                <>
                  <Money amount={centsToDecStr(diffCents)} size="sm" /> remaining
                </>
              ) : (
                <>
                  <Money amount={centsToDecStr(-diffCents)} size="sm" /> over
                </>
              )}
            </span>
          )}
        </div>

        {/* Running total line */}
        <p className="flex items-center gap-1 text-xs text-fg-muted mb-3">
          Contributions:{" "}
          <Money amount={contribRunningTotal} size="sm" />
          {totalCostValid && (
            <>
              {" "}of{" "}
              <Money amount={totalCost.trim()} size="sm" />
            </>
          )}
        </p>

        <div className="space-y-2">
          {contributions.map((row) => (
            <div key={row._key} className="flex items-center gap-2">
              <select
                value={row.userId}
                onChange={(e) => updateContrib(row._key, "userId", e.target.value)}
                className="flex-1 h-10 rounded-lg px-3 text-sm bg-surface-2 text-fg border border-border focus:outline-none focus:ring-2 focus:ring-accent/40"
              >
                <option value="">Select member…</option>
                {activeUsers.map((u) => (
                  <option key={u.id} value={String(u.id)}>
                    {u.name}
                  </option>
                ))}
              </select>
              <input
                type="text"
                value={row.amount}
                onChange={(e) => updateContrib(row._key, "amount", e.target.value)}
                placeholder="0.00"
                inputMode="decimal"
                className="w-28 h-10 rounded-lg px-3 text-sm bg-surface-2 text-fg border border-border focus:outline-none focus:ring-2 focus:ring-accent/40"
              />
              {contributions.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeContribRow(row._key)}
                  className="text-fg-muted hover:text-danger transition-colors text-sm px-1"
                  aria-label="Remove contributor"
                >
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={addContribRow}
          className="mt-2 text-xs text-accent hover:text-accent/80 transition-colors"
        >
          + Add contributor
        </button>
      </div>

      {formError && <p className="text-sm text-danger">{formError}</p>}

      <div className="flex items-center gap-3">
        <Button type="submit" loading={submitting} disabled={!canSubmit}>
          {submitting ? "Saving…" : "Add Asset"}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

/* ── Edit form ─────────────────────────────────────────────────────── */

interface EditAssetFormProps {
  asset: SharedAssetResponse;
  onSuccess: () => Promise<void>;
  onCancel: () => void;
}

function EditAssetForm({ asset, onSuccess, onCancel }: EditAssetFormProps) {
  const { logout } = useAuth();

  const [name, setName] = useState(asset.name);
  const [description, setDescription] = useState(asset.description ?? "");
  const [status, setStatus] = useState<"active" | "disposed">(asset.status);
  const [requiresBuyin, setRequiresBuyin] = useState(
    asset.requires_buyin_from_new_members
  );
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function handleSubmit(e: { preventDefault(): void }) {
    e.preventDefault();
    setFormError(null);

    // Build diff — only send changed fields
    const patch: Record<string, unknown> = {};
    if (name.trim() !== asset.name) patch.name = name.trim();
    const newDesc = description.trim() || null;
    if (newDesc !== asset.description) patch.description = newDesc;
    if (status !== asset.status) patch.status = status;
    if (requiresBuyin !== asset.requires_buyin_from_new_members) {
      patch.requires_buyin_from_new_members = requiresBuyin;
    }

    if (Object.keys(patch).length === 0) { onCancel(); return; }

    setSubmitting(true);
    try {
      await apiAuthPatch<SharedAssetResponse>(`/api/v1/assets/${asset.id}`, patch);
      await onSuccess();
    } catch (err: unknown) {
      if (err instanceof UnauthorizedError) { logout(); return; }
      const msg = err instanceof Error ? err.message : String(err);
      setFormError(extractErrorMessage(msg));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 pt-2 border-t border-border mt-2">
      <h3 className="text-xs font-semibold text-fg-muted uppercase tracking-wider pt-2">
        Edit Asset
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Input
          label="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <Input
          label="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="(leave blank to clear)"
        />
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-fg-muted">Status</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as "active" | "disposed")}
            className="h-10 rounded-lg px-3 text-sm bg-surface-2 text-fg border border-border focus:outline-none focus:ring-2 focus:ring-accent/40"
          >
            <option value="active">Active</option>
            <option value="disposed">Disposed</option>
          </select>
        </div>

        <label className="flex items-center gap-2 text-sm text-fg-muted cursor-pointer select-none pb-0.5">
          <input
            type="checkbox"
            checked={requiresBuyin}
            onChange={(e) => setRequiresBuyin(e.target.checked)}
            className="w-4 h-4 rounded border-border accent-accent"
          />
          Requires buy-in from new members
        </label>
      </div>

      {formError && <p className="text-sm text-danger">{formError}</p>}

      <div className="flex items-center gap-3">
        <Button type="submit" loading={submitting}>
          {submitting ? "Saving…" : "Save Changes"}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
