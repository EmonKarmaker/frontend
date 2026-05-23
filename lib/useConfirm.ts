"use client";

import { useRef, useState } from "react";
import type { ConfirmModalProps } from "../components/ui/ConfirmModal";

type ConfirmOptions = Pick<
  ConfirmModalProps,
  "title" | "message" | "confirmLabel" | "cancelLabel" | "variant"
>;

export function useConfirm(): {
  confirm: (opts: ConfirmOptions) => Promise<boolean>;
  modalProps: ConfirmModalProps;
} {
  const [open, setOpen] = useState(false);
  const [opts, setOpts] = useState<ConfirmOptions>({ title: "", message: "" });
  const resolverRef = useRef<((ok: boolean) => void) | null>(null);

  function confirm(options: ConfirmOptions): Promise<boolean> {
    setOpts(options);
    setOpen(true);
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
    });
  }

  function handleConfirm() {
    setOpen(false);
    resolverRef.current?.(true);
    resolverRef.current = null;
  }

  function handleCancel() {
    setOpen(false);
    resolverRef.current?.(false);
    resolverRef.current = null;
  }

  const modalProps: ConfirmModalProps = {
    open,
    ...opts,
    onConfirm: handleConfirm,
    onCancel: handleCancel,
  };

  return { confirm, modalProps };
}
