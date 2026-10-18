"use client";
import { useEffect, useRef, type ReactNode } from "react";
export function Modal({
  children,
  onClose,
}: {
  children: ReactNode;
  onClose: () => void;
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
      aria-labelledby="launch-title"
      onCancel={onClose}
    >
      <div>{children}</div>
    </dialog>
  );
}
