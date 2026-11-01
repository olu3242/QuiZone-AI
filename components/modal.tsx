"use client";
import { useEffect, useRef, type ReactNode } from "react";
export function Modal({
  children,
  onClose,
  labelledBy = "launch-title",
}: {
  children: ReactNode;
  onClose: () => void;
  labelledBy?: string;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = dialog.current;
    const previous = document.activeElement as HTMLElement | null;
    el?.showModal();
    return () => {
      el?.close();
      previous?.focus();
    };
  }, []);
  return (
    <dialog
      ref={dialog}
      className="modal-dialog"
      aria-labelledby={labelledBy}
      onCancel={onClose}
    >
      <div>{children}</div>
    </dialog>
  );
}
