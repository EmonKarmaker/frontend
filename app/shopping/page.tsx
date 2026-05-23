"use client";

import { ChangeEvent, ReactNode, useEffect, useRef, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import {
  apiAuthPost,
  apiAuthPostForm,
  apiAuthPatchForm,
  apiAuthPatch,
  apiAuthDelete,
  UnauthorizedError,
} from "../../lib/api";
import { useApiData } from "../../lib/useApiData";
import { useConfirm } from "../../lib/useConfirm";
import { ProtectedRoute } from "../../components/ProtectedRoute";
import { AppShell } from "../../components/AppShell";
import { StatusMessage } from "../../components/ui/StatusMessage";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Card } from "../../components/ui/Card";
import { Money } from "../../components/ui/Money";
import { ConfirmModal } from "../../components/ui/ConfirmModal";

/* ── Types ──────────────────────────────────────────────────────────── */

interface UserMini {
  id: number;
  name: string;
}

interface UserResponse {
  id: number;
  name: string;
  is_admin: boolean;
  left_at: string | null;
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

type EntryFormMode = { kind: "add" } | { kind: "edit"; entry: ShoppingEntryResponse } | null;
type ItemFormMode = { kind: "add"; entryId: number } | { kind: "edit"; item: ShoppingItemResponse } | null;

/* ── Helpers ────────────────────────────────────────────────────────── */

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

function sumLineItems(items: ShoppingItemResponse[]): string {
  return items.reduce((acc, item) => addDecimalStrings(acc, item.line_total), "0.00");
}

function formatMonth(m: string): string {
  const [y, mo] = m.split("-");
  return new Date(Date.UTC(+y, +mo - 1, 1)).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    timeZone: "UTC",
  });
}

function currentYearMonth(): string {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function categoryLabel(cat: string): string {
  if (cat === "meal") return "Meal";
  if (cat === "household") return "Household";
  if (cat === "personal") return "Personal";
  return cat;
}

function categoryBadgeClass(cat: string): string {
  if (cat === "meal") return "bg-blue-500/15 text-blue-400";
  if (cat === "household") return "bg-green-500/15 text-green-400";
  if (cat === "personal") return "bg-purple-500/15 text-purple-400";
  return "bg-surface-2 text-fg-muted";
}

interface PendingItem {
  name: string;
  price: string;
  quantity: string;
  category: "meal" | "household" | "personal";
  targetUserId: string;
}

function blankItem(): PendingItem {
  return { name: "", price: "", quantity: "1", category: "meal", targetUserId: "" };
}

/* ── SelectField ────────────────────────────────────────────────────── */

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

/* ── ItemRowForm (inline row for building item list in create form) ─── */

interface ItemRowFormProps {
  item: PendingItem;
  index: number;
  users: UserResponse[];
  canRemove: boolean;
  disabled: boolean;
  onChange: (index: number, field: keyof PendingItem, value: string) => void;
  onRemove: (index: number) => void;
}

function ItemRowForm({ item, index, users, canRemove, disabled, onChange, onRemove }: ItemRowFormProps) {
  const activeUsers = users.filter((u) => u.left_at === null);
  return (
    <div className="grid grid-cols-12 gap-2 items-end">
      <div className="col-span-12 sm:col-span-4">
        <Input
          label={index === 0 ? "Item name" : ""}
          type="text"
          placeholder="e.g. Rice"
          required
          value={item.name}
          onChange={(e) => onChange(index, "name", e.target.value)}
          disabled={disabled}
        />
      </div>
      <div className="col-span-4 sm:col-span-2">
        <Input
          label={index === 0 ? "Price (৳)" : ""}
          type="text"
          placeholder="120.00"
          required
          value={item.price}
          onChange={(e) => onChange(index, "price", e.target.value)}
          disabled={disabled}
        />
      </div>
      <div className="col-span-4 sm:col-span-1">
        <Input
          label={index === 0 ? "Qty" : ""}
          type="text"
          placeholder="1"
          value={item.quantity}
          onChange={(e) => onChange(index, "quantity", e.target.value)}
          disabled={disabled}
        />
      </div>
      <div className="col-span-4 sm:col-span-2">
        <SelectField
          label={index === 0 ? "Category" : ""}
          value={item.category}
          onChange={(e) => onChange(index, "category", e.target.value)}
          disabled={disabled}
        >
          <option value="meal" className="bg-surface-2 text-fg">Meal</option>
          <option value="household" className="bg-surface-2 text-fg">Household</option>
          <option value="personal" className="bg-surface-2 text-fg">Personal</option>
        </SelectField>
      </div>
      {item.category === "personal" ? (
        <div className="col-span-8 sm:col-span-2">
          <SelectField
            label={index === 0 ? "For user" : ""}
            value={item.targetUserId}
            onChange={(e) => onChange(index, "targetUserId", e.target.value)}
            disabled={disabled}
          >
            <option value="" className="bg-surface-2 text-fg-muted">— pick user —</option>
            {activeUsers.map((u) => (
              <option key={u.id} value={String(u.id)} className="bg-surface-2 text-fg">
                {u.name}
              </option>
            ))}
          </SelectField>
        </div>
      ) : (
        <div className="col-span-8 sm:col-span-2" />
      )}
      <div className="col-span-4 sm:col-span-1 flex items-end pb-0.5">
        {canRemove && (
          <button
            type="button"
            onClick={() => onRemove(index)}
            disabled={disabled}
            className="h-10 w-10 flex items-center justify-center rounded-lg text-fg-muted hover:text-danger transition-colors disabled:opacity-40"
            aria-label="Remove item"
          >
            ×
          </button>
        )}
      </div>
    </div>
  );
}

/* ── CreateEntryForm ─────────────────────────────────────────────────── */

interface CreateEntryFormProps {
  users: UserResponse[];
  onSuccess: (msg: string) => void;
  onCancel: () => void;
  onReload: () => Promise<void>;
  onReloadUsers: () => Promise<void>;
  onUnauthorized: () => void;
}

function CreateEntryForm({ users, onSuccess, onCancel, onReload, onReloadUsers, onUnauthorized }: CreateEntryFormProps) {
  const [month, setMonth] = useState(currentYearMonth());
  const [note, setNote] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [items, setItems] = useState<PendingItem[]>([blankItem()]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (photoPreview) URL.revokeObjectURL(photoPreview);
    };
  }, [photoPreview]);

  function handlePhotoChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhoto(file);
    setPhotoPreview(file ? URL.createObjectURL(file) : null);
  }

  function handleItemChange(index: number, field: keyof PendingItem, value: string) {
    setItems((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      if (field === "category" && value !== "personal") {
        next[index].targetUserId = "";
      }
      return next;
    });
  }

  function addItem() {
    setItems((prev) => [...prev, blankItem()]);
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: { preventDefault(): void }) {
    e.preventDefault();
    setError("");

    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (!it.name.trim()) { setError(`Item ${i + 1}: name is required.`); return; }
      if (!it.price.trim()) { setError(`Item ${i + 1}: price is required.`); return; }
      if (it.category === "personal" && !it.targetUserId) {
        setError(`Item ${i + 1}: "For user" is required for personal items.`); return;
      }
    }

    setSubmitting(true);
    try {
      const items_json = JSON.stringify(
        items.map((i) => ({
          name: i.name.trim(),
          price: i.price.trim(),
          quantity: i.quantity.trim(),
          category: i.category,
          target_user_id: i.category === "personal" ? Number(i.targetUserId) : null,
        }))
      );
      const fd = new FormData();
      fd.append("month", month);
      fd.append("items_json", items_json);
      if (note.trim()) fd.append("note", note.trim());
      if (photo) fd.append("photo", photo);

      await apiAuthPostForm<ShoppingEntryResponse>("/api/v1/shopping", fd);
      await Promise.all([onReload(), onReloadUsers()]);
      onSuccess("Shopping entry added.");
    } catch (err: unknown) {
      if (err instanceof UnauthorizedError) { onUnauthorized(); return; }
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg.includes("422") ? "Please check your input — all required fields must be valid." : msg);
      setSubmitting(false);
    }
  }

  const runningTotal = items.reduce<string>((acc, item) => {
    const priceStr = item.price.trim() || "0";
    const qtyStr = item.quantity.trim() || "1";
    try {
      const priceToCents = (s: string): bigint => {
        const t = s.trim();
        const neg = t.startsWith("-");
        const abs = neg ? t.slice(1) : t;
        const [intStr = "0", fracStr = ""] = abs.split(".");
        const cents = BigInt(intStr) * 100n + BigInt((fracStr + "00").slice(0, 2));
        return neg ? -cents : cents;
      };
      const qtyToThousandths = (s: string): bigint => {
        const t = s.trim();
        const neg = t.startsWith("-");
        const abs = neg ? t.slice(1) : t;
        const [intStr = "0", fracStr = ""] = abs.split(".");
        const thou = BigInt(intStr) * 1000n + BigInt((fracStr + "000").slice(0, 3));
        return neg ? -thou : thou;
      };
      // price (cents) × qty (thousandths) / 1000 = line total in cents (2 decimals)
      const lineCents = (priceToCents(priceStr) * qtyToThousandths(qtyStr)) / 1000n;
      const neg = lineCents < 0n;
      const abs = neg ? -lineCents : lineCents;
      const lineStr = `${neg ? "-" : ""}${abs / 100n}.${(abs % 100n).toString().padStart(2, "0")}`;
      return addDecimalStrings(acc, lineStr);
    } catch {
      return acc;
    }
  }, "0.00");

  return (
    <div className="mb-6 animate-fade-up">
      <Card title="Add shopping entry">
        <form onSubmit={handleSubmit} className="pt-1 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Input
              label="Month"
              type="month"
              required
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              disabled={submitting}
            />
            <Input
              label="Note (optional)"
              type="text"
              placeholder="e.g. Weekly grocery run"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              disabled={submitting}
            />
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-fg-muted">Receipt photo (optional)</label>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                disabled={submitting}
                onChange={handlePhotoChange}
                className="h-10 text-sm text-fg-muted file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-medium file:bg-accent/15 file:text-accent hover:file:bg-accent/25 cursor-pointer"
              />
              {photoPreview && (
                <img src={photoPreview} alt="Preview" className="mt-1 h-20 w-auto rounded-lg object-cover border border-border" />
              )}
            </div>
          </div>

          {/* Item list */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-fg-muted">Items</span>
              {items.length > 0 && (
                <span className="text-xs text-fg-muted">
                  Total: <Money amount={runningTotal} size="sm" variant="emphasis" />
                </span>
              )}
            </div>
            <div className="space-y-2">
              {items.map((item, i) => (
                <ItemRowForm
                  key={i}
                  item={item}
                  index={i}
                  users={users}
                  canRemove={items.length > 1}
                  disabled={submitting}
                  onChange={handleItemChange}
                  onRemove={removeItem}
                />
              ))}
            </div>
            <button
              type="button"
              onClick={addItem}
              disabled={submitting}
              className="text-xs text-accent hover:text-accent/80 transition-colors disabled:opacity-40"
            >
              + Add item
            </button>
          </div>

          {error && <p className="text-sm text-danger">{error}</p>}
          <div className="flex items-center gap-3">
            <Button type="submit" loading={submitting}>
              {submitting ? "Adding…" : "Add Entry"}
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

/* ── EditEntryForm (note + photo only) ──────────────────────────────── */

interface EditEntryFormProps {
  entry: ShoppingEntryResponse;
  onSuccess: (msg: string) => void;
  onCancel: () => void;
  onReload: () => Promise<void>;
  onUnauthorized: () => void;
}

function EditEntryForm({ entry, onSuccess, onCancel, onReload, onUnauthorized }: EditEntryFormProps) {
  const [note, setNote] = useState(entry.note ?? "");
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (photoPreview) URL.revokeObjectURL(photoPreview);
    };
  }, [photoPreview]);

  function handlePhotoChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhoto(file);
    setPhotoPreview(file ? URL.createObjectURL(file) : null);
  }

  async function handleSubmit(e: { preventDefault(): void }) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append("note", note);
      if (photo) fd.append("photo", photo);
      await apiAuthPatchForm<ShoppingEntryResponse>(`/api/v1/shopping/${entry.id}`, fd);
      await onReload();
      onSuccess("Entry updated.");
    } catch (err: unknown) {
      if (err instanceof UnauthorizedError) { onUnauthorized(); return; }
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      setSubmitting(false);
    }
  }

  return (
    <div className="mb-6 animate-fade-up">
      <Card title="Edit entry">
        <form onSubmit={handleSubmit} className="pt-1 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Note (optional)"
              type="text"
              placeholder="e.g. Weekly grocery run"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              disabled={submitting}
            />
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-fg-muted">Replace receipt photo (optional)</label>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                disabled={submitting}
                onChange={handlePhotoChange}
                className="h-10 text-sm text-fg-muted file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-medium file:bg-accent/15 file:text-accent hover:file:bg-accent/25 cursor-pointer"
              />
              {(photoPreview ?? entry.photo_url) && (
                <img
                  src={photoPreview ?? entry.photo_url!}
                  alt="Receipt"
                  className="mt-1 h-20 w-auto rounded-lg object-cover border border-border"
                />
              )}
            </div>
          </div>
          {error && <p className="text-sm text-danger">{error}</p>}
          <div className="flex items-center gap-3">
            <Button type="submit" loading={submitting}>
              {submitting ? "Saving…" : "Save Changes"}
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

/* ── AddItemForm (inline add to existing entry) ──────────────────────── */

interface AddItemFormProps {
  entryId: number;
  users: UserResponse[];
  onSuccess: (msg: string) => void;
  onCancel: () => void;
  onReload: () => Promise<void>;
  onUnauthorized: () => void;
}

function AddItemForm({ entryId, users, onSuccess, onCancel, onReload, onUnauthorized }: AddItemFormProps) {
  const [item, setItem] = useState<PendingItem>(blankItem());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  function handleChange(_index: number, field: keyof PendingItem, value: string) {
    setItem((prev) => {
      const next = { ...prev, [field]: value };
      if (field === "category" && value !== "personal") next.targetUserId = "";
      return next;
    });
  }

  async function handleSubmit(e: { preventDefault(): void }) {
    e.preventDefault();
    setError("");
    if (!item.name.trim()) { setError("Name is required."); return; }
    if (!item.price.trim()) { setError("Price is required."); return; }
    if (item.category === "personal" && !item.targetUserId) {
      setError('"For user" is required for personal items.'); return;
    }
    setSubmitting(true);
    try {
      const body = [{
        name: item.name.trim(),
        price: item.price.trim(),
        quantity: item.quantity.trim() || "1",
        category: item.category,
        target_user_id: item.category === "personal" ? Number(item.targetUserId) : null,
      }];
      await apiAuthPost<ShoppingEntryResponse>(`/api/v1/shopping/${entryId}/items`, body);
      await onReload();
      onSuccess("Item added.");
    } catch (err: unknown) {
      if (err instanceof UnauthorizedError) { onUnauthorized(); return; }
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg.includes("422") ? "Please check your input." : msg);
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-3 p-3 rounded-lg bg-surface-2/50 border border-border space-y-2">
      <ItemRowForm
        item={item}
        index={0}
        users={users}
        canRemove={false}
        disabled={submitting}
        onChange={handleChange}
        onRemove={() => {}}
      />
      {error && <p className="text-xs text-danger">{error}</p>}
      <div className="flex items-center gap-2">
        <Button type="submit" size="sm" loading={submitting}>
          {submitting ? "Adding…" : "Add Item"}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onCancel} disabled={submitting}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

/* ── EditItemForm (inline edit existing item) ───────────────────────── */

interface EditItemFormProps {
  item: ShoppingItemResponse;
  users: UserResponse[];
  onSuccess: (msg: string) => void;
  onCancel: () => void;
  onReload: () => Promise<void>;
  onUnauthorized: () => void;
}

function EditItemForm({ item, users, onSuccess, onCancel, onReload, onUnauthorized }: EditItemFormProps) {
  const [name, setName] = useState(item.name);
  const [price, setPrice] = useState(item.price);
  const [quantity, setQuantity] = useState(item.quantity);
  const [category, setCategory] = useState<"meal" | "household" | "personal">(
    item.category as "meal" | "household" | "personal"
  );
  const [targetUserId, setTargetUserId] = useState(
    item.target_user ? String(item.target_user.id) : ""
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const activeUsers = users.filter((u) => u.left_at === null);

  async function handleSubmit(e: { preventDefault(): void }) {
    e.preventDefault();
    setError("");
    if (!name.trim()) { setError("Name is required."); return; }
    if (!price.trim()) { setError("Price is required."); return; }
    if (category === "personal" && !targetUserId) {
      setError('"For user" is required for personal items.'); return;
    }

    const patch: Record<string, unknown> = {};
    if (name.trim() !== item.name) patch.name = name.trim();
    if (price.trim() !== item.price) patch.price = price.trim();
    if (quantity.trim() !== item.quantity) patch.quantity = quantity.trim();
    if (category !== item.category) patch.category = category;
    const newTargetId = category === "personal" ? Number(targetUserId) : null;
    const oldTargetId = item.target_user?.id ?? null;
    if (newTargetId !== oldTargetId) patch.target_user_id = newTargetId;

    if (Object.keys(patch).length === 0) { onCancel(); return; }

    setSubmitting(true);
    try {
      await apiAuthPatch<ShoppingItemResponse>(`/api/v1/shopping/items/${item.id}`, patch);
      await onReload();
      onSuccess("Item updated.");
    } catch (err: unknown) {
      if (err instanceof UnauthorizedError) { onUnauthorized(); return; }
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg.includes("422") ? "Please check your input." : msg);
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-2 p-3 rounded-lg bg-surface-2/50 border border-border space-y-2">
      <div className="grid grid-cols-12 gap-2 items-end">
        <div className="col-span-12 sm:col-span-4">
          <Input label="Name" type="text" required value={name} onChange={(e) => setName(e.target.value)} disabled={submitting} />
        </div>
        <div className="col-span-4 sm:col-span-2">
          <Input label="Price (৳)" type="text" required value={price} onChange={(e) => setPrice(e.target.value)} disabled={submitting} />
        </div>
        <div className="col-span-4 sm:col-span-1">
          <Input label="Qty" type="text" value={quantity} onChange={(e) => setQuantity(e.target.value)} disabled={submitting} />
        </div>
        <div className="col-span-4 sm:col-span-2">
          <SelectField
            label="Category"
            value={category}
            onChange={(e) => {
              const v = e.target.value as "meal" | "household" | "personal";
              setCategory(v);
              if (v !== "personal") setTargetUserId("");
            }}
            disabled={submitting}
          >
            <option value="meal" className="bg-surface-2 text-fg">Meal</option>
            <option value="household" className="bg-surface-2 text-fg">Household</option>
            <option value="personal" className="bg-surface-2 text-fg">Personal</option>
          </SelectField>
        </div>
        {category === "personal" ? (
          <div className="col-span-8 sm:col-span-3">
            <SelectField
              label="For user"
              value={targetUserId}
              onChange={(e) => setTargetUserId(e.target.value)}
              disabled={submitting}
            >
              <option value="" className="bg-surface-2 text-fg-muted">— pick user —</option>
              {activeUsers.map((u) => (
                <option key={u.id} value={String(u.id)} className="bg-surface-2 text-fg">{u.name}</option>
              ))}
            </SelectField>
          </div>
        ) : (
          <div className="col-span-8 sm:col-span-3" />
        )}
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
      <div className="flex items-center gap-2">
        <Button type="submit" size="sm" loading={submitting}>
          {submitting ? "Saving…" : "Save"}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onCancel} disabled={submitting}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

/* ── EntryCard ───────────────────────────────────────────────────────── */

interface EntryCardProps {
  entry: ShoppingEntryResponse;
  isAdmin: boolean;
  users: UserResponse[];
  itemFormMode: ItemFormMode;
  onSetItemForm: (mode: ItemFormMode) => void;
  onEditEntry: (entry: ShoppingEntryResponse) => void;
  onDeleteEntry: (entry: ShoppingEntryResponse) => void;
  onItemSuccess: (msg: string) => void;
  onReload: () => Promise<void>;
  onUnauthorized: () => void;
}

function EntryCard({
  entry, isAdmin, users, itemFormMode,
  onSetItemForm, onEditEntry, onDeleteEntry,
  onItemSuccess, onReload, onUnauthorized,
}: EntryCardProps) {
  const [expanded, setExpanded] = useState(true);
  const total = sumLineItems(entry.items);

  return (
    <div className="rounded-xl bg-surface-1 border border-border overflow-hidden" style={{ boxShadow: "var(--shadow-card)" }}>
      {/* Header */}
      <div
        className="flex items-center justify-between gap-3 px-4 py-3 cursor-pointer hover:bg-surface-2/30 transition-colors"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="flex items-center gap-3 min-w-0">
          <svg
            width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
            className={`shrink-0 text-fg-muted transition-transform ${expanded ? "rotate-180" : ""}`}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-fg truncate">
              Paid by {entry.paid_by.name}
            </div>
            {entry.note && (
              <div className="text-xs text-fg-muted truncate">{entry.note}</div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <Money amount={total} size="sm" variant="emphasis" />
          {isAdmin && (
            <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
              <button
                onClick={() => onEditEntry(entry)}
                className="text-xs text-fg-muted hover:text-accent transition-colors"
              >
                Edit
              </button>
              <span className="text-border">·</span>
              <button
                onClick={() => onDeleteEntry(entry)}
                className="text-xs text-fg-muted hover:text-danger transition-colors"
              >
                Delete
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Items list */}
      {expanded && (
        <div className="border-t border-border px-4 py-3 space-y-1">
          {entry.items.map((si) => {
            const isEditingThis = itemFormMode?.kind === "edit" && itemFormMode.item.id === si.id;
            return (
              <div key={si.id}>
                {isEditingThis ? (
                  <EditItemForm
                    item={si}
                    users={users}
                    onSuccess={(msg) => { onSetItemForm(null); onItemSuccess(msg); }}
                    onCancel={() => onSetItemForm(null)}
                    onReload={onReload}
                    onUnauthorized={onUnauthorized}
                  />
                ) : (
                  <div className="flex items-center justify-between gap-2 py-1.5 group">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`shrink-0 px-1.5 py-0.5 rounded text-xs font-medium ${categoryBadgeClass(si.category)}`}>
                        {categoryLabel(si.category)}
                      </span>
                      <span className="text-sm text-fg truncate">{si.name}</span>
                      {si.quantity !== "1.00" && si.quantity !== "1" && (
                        <span className="text-xs text-fg-muted shrink-0">×{si.quantity}</span>
                      )}
                      {si.target_user && (
                        <span className="text-xs text-fg-muted shrink-0">→ {si.target_user.name}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Money amount={si.line_total} size="sm" />
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1.5">
                        <button
                          onClick={() => onSetItemForm({ kind: "edit", item: si })}
                          className="text-xs text-fg-muted hover:text-accent transition-colors"
                        >
                          Edit
                        </button>
                        <span className="text-border">·</span>
                        <DeleteItemButton
                          item={si}
                          entryItemCount={entry.items.length}
                          onSuccess={(msg) => { onSetItemForm(null); onItemSuccess(msg); }}
                          onReload={onReload}
                          onUnauthorized={onUnauthorized}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {/* Inline add item form or button */}
          {itemFormMode?.kind === "add" && itemFormMode.entryId === entry.id ? (
            <AddItemForm
              entryId={entry.id}
              users={users}
              onSuccess={(msg) => { onSetItemForm(null); onItemSuccess(msg); }}
              onCancel={() => onSetItemForm(null)}
              onReload={onReload}
              onUnauthorized={onUnauthorized}
            />
          ) : (
            <button
              onClick={() => onSetItemForm({ kind: "add", entryId: entry.id })}
              className="mt-2 text-xs text-accent hover:text-accent/80 transition-colors"
            >
              + Add item
            </button>
          )}

          {/* Receipt photo */}
          {entry.photo_url && (
            <div className="mt-2 pt-2 border-t border-border">
              <a href={entry.photo_url} target="_blank" rel="noopener noreferrer">
                <img
                  src={entry.photo_url}
                  alt="Receipt"
                  className="h-24 w-auto rounded-lg object-cover border border-border hover:opacity-90 transition-opacity"
                />
              </a>
            </div>
          )}

          {/* Footer totals */}
          <div className="mt-2 pt-2 border-t border-border flex justify-end">
            <div className="text-xs text-fg-muted">
              Total: <Money amount={total} size="sm" variant="emphasis" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── DeleteItemButton ────────────────────────────────────────────────── */

interface DeleteItemButtonProps {
  item: ShoppingItemResponse;
  entryItemCount: number;
  onSuccess: (msg: string) => void;
  onReload: () => Promise<void>;
  onUnauthorized: () => void;
}

function DeleteItemButton({ item, entryItemCount, onSuccess, onReload, onUnauthorized }: DeleteItemButtonProps) {
  const [deleting, setDeleting] = useState(false);
  const [btnError, setBtnError] = useState<string | null>(null);
  const { confirm, modalProps } = useConfirm();

  async function handleDelete() {
    if (entryItemCount <= 1) {
      setBtnError("Cannot delete the last item in a shopping entry. Delete the whole entry instead.");
      setTimeout(() => setBtnError(null), 4000);
      return;
    }
    if (!(await confirm({ title: "Delete item?", message: `Delete "${item.name}" from this entry?`, variant: "danger", confirmLabel: "Delete" }))) return;
    setDeleting(true);
    try {
      await apiAuthDelete(`/api/v1/shopping/items/${item.id}`);
      await onReload();
      onSuccess("Item deleted.");
    } catch (err: unknown) {
      if (err instanceof UnauthorizedError) { onUnauthorized(); return; }
      const msg = err instanceof Error ? err.message : String(err);
      setBtnError(msg);
      setTimeout(() => setBtnError(null), 4000);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <button
        onClick={handleDelete}
        disabled={deleting}
        className="text-xs text-fg-muted hover:text-danger transition-colors disabled:opacity-40"
      >
        {deleting ? "…" : "Delete"}
      </button>
      {btnError && (
        <span className="text-xs text-danger">{btnError}</span>
      )}
      <ConfirmModal {...modalProps} />
    </>
  );
}

/* ── DeleteEntryConfirm ──────────────────────────────────────────────── */

interface DeleteEntryConfirmProps {
  entry: ShoppingEntryResponse;
  onConfirm: () => void;
  onCancel: () => void;
  deleting: boolean;
}

function DeleteEntryConfirm({ entry, onConfirm, onCancel, deleting }: DeleteEntryConfirmProps) {
  const total = sumLineItems(entry.items);
  return (
    <div className="mb-6 animate-fade-up">
      <Card title="Delete entry?">
        <p className="text-sm text-fg-muted pt-1 pb-4">
          Delete the entry by{" "}
          <span className="text-fg font-medium">{entry.paid_by.name}</span> with{" "}
          <span className="text-fg font-medium">{entry.items.length} item{entry.items.length !== 1 ? "s" : ""}</span>{" "}
          totalling <Money amount={total} size="sm" variant="emphasis" />? This cannot be undone.
        </p>
        <div className="flex items-center gap-3">
          <Button variant="danger" loading={deleting} onClick={onConfirm}>
            {deleting ? "Deleting…" : "Delete Entry"}
          </Button>
          <Button type="button" variant="ghost" onClick={onCancel} disabled={deleting}>
            Cancel
          </Button>
        </div>
      </Card>
    </div>
  );
}

/* ── ShoppingContent ────────────────────────────────────────────────── */

function ShoppingContent() {
  const { user, logout } = useAuth();
  const [selectedMonth, setSelectedMonth] = useState(currentYearMonth());
  const { data: entries, loading, error, reload } = useApiData<ShoppingEntryResponse[]>(
    `/api/v1/shopping?month=${selectedMonth}`
  );
  const { data: usersData, reload: reloadUsers } = useApiData<UserResponse[]>("/api/v1/users");

  const users = usersData ?? [];
  const isAdmin = user?.is_admin ?? false;

  const [entryFormMode, setEntryFormMode] = useState<EntryFormMode>(null);
  const [deleteTarget, setDeleteTarget] = useState<ShoppingEntryResponse | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [itemFormMode, setItemFormMode] = useState<ItemFormMode>(null);
  const [successMsg, setSuccessMsg] = useState("");
  const [deleteError, setDeleteError] = useState("");

  function handleSuccess(msg: string) {
    setEntryFormMode(null);
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(""), 4000);
  }

  function handleItemSuccess(msg: string) {
    setItemFormMode(null);
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(""), 4000);
  }

  async function handleDeleteConfirm() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await apiAuthDelete(`/api/v1/shopping/${deleteTarget.id}`);
      await reload();
      setDeleteTarget(null);
      setSuccessMsg("Entry deleted.");
      setTimeout(() => setSuccessMsg(""), 4000);
    } catch (err: unknown) {
      if (err instanceof UnauthorizedError) { logout(); return; }
      const msg = err instanceof Error ? err.message : String(err);
      setDeleteError(msg);
      setTimeout(() => setDeleteError(""), 4000);
    } finally {
      setDeleting(false);
    }
  }

  const monthTotal = entries ? sumLineItems(entries.flatMap((e) => e.items)) : "0.00";

  return (
    <AppShell>
      <div className="p-6 md:p-8 max-w-4xl">

        {/* Page header */}
        <div className="flex items-start justify-between gap-4 mb-6 animate-fade-up">
          <div>
            <h1 className="font-display text-2xl font-bold text-fg tracking-tight">Shopping</h1>
            {entries !== null && (
              <p className="text-sm text-fg-muted mt-0.5">
                {entries.length} entr{entries.length !== 1 ? "ies" : "y"} · <Money amount={monthTotal} size="sm" />
              </p>
            )}
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => {
                setSelectedMonth(e.target.value);
                setEntryFormMode(null);
                setDeleteTarget(null);
                setItemFormMode(null);
              }}
              className="h-9 rounded-lg px-3 text-sm bg-surface-2 text-fg border border-border focus:outline-none focus:ring-2 focus:ring-accent/40"
            />
            {!entryFormMode && !deleteTarget && (
              <Button size="sm" onClick={() => setEntryFormMode({ kind: "add" })}>
                Add Entry
              </Button>
            )}
          </div>
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
          <DeleteEntryConfirm
            entry={deleteTarget}
            onConfirm={handleDeleteConfirm}
            onCancel={() => setDeleteTarget(null)}
            deleting={deleting}
          />
        )}

        {/* Add form */}
        {entryFormMode?.kind === "add" && (
          <CreateEntryForm
            users={users}
            onSuccess={handleSuccess}
            onCancel={() => setEntryFormMode(null)}
            onReload={reload}
            onReloadUsers={reloadUsers}
            onUnauthorized={logout}
          />
        )}

        {/* Edit form */}
        {entryFormMode?.kind === "edit" && (
          <EditEntryForm
            entry={entryFormMode.entry}
            onSuccess={handleSuccess}
            onCancel={() => setEntryFormMode(null)}
            onReload={reload}
            onUnauthorized={logout}
          />
        )}

        {/* Loading */}
        {loading && !entries && (
          <StatusMessage kind="loading" message="Loading shopping entries — first load may take up to 60 seconds…" />
        )}

        {/* Error */}
        {error && <StatusMessage kind="error" message={error} onRetry={reload} />}

        {/* Empty */}
        {!loading && !error && entries && entries.length === 0 && (
          <StatusMessage kind="empty" message={`No shopping entries for ${formatMonth(selectedMonth)}.`} />
        )}

        {/* Entry cards */}
        {entries && entries.length > 0 && !error && (
          <div className="space-y-4 animate-fade-up delay-75">
            {entries.map((entry) => (
              <EntryCard
                key={entry.id}
                entry={entry}
                isAdmin={isAdmin}
                users={users}
                itemFormMode={itemFormMode}
                onSetItemForm={(mode) => {
                  setEntryFormMode(null);
                  setDeleteTarget(null);
                  setItemFormMode(mode);
                }}
                onEditEntry={(e) => {
                  setDeleteTarget(null);
                  setItemFormMode(null);
                  setEntryFormMode({ kind: "edit", entry: e });
                }}
                onDeleteEntry={(e) => {
                  setEntryFormMode(null);
                  setItemFormMode(null);
                  setDeleteTarget(e);
                }}
                onItemSuccess={handleItemSuccess}
                onReload={reload}
                onUnauthorized={logout}
              />
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}

/* ── Page ────────────────────────────────────────────────────────────── */

export default function ShoppingPage() {
  return (
    <ProtectedRoute>
      <ShoppingContent />
    </ProtectedRoute>
  );
}
