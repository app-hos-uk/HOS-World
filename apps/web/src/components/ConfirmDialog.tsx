'use client';

import { useEffect, useId, useRef, useState, type ReactNode } from 'react';

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  description?: ReactNode;
  variant?: 'confirm' | 'alert' | 'prompt';
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'default' | 'danger';
  busy?: boolean;
  inputLabel?: string;
  inputPlaceholder?: string;
  inputDefaultValue?: string;
  inputRequired?: boolean;
  inputMultiline?: boolean;
  onConfirm: (value?: string) => void;
  onCancel: () => void;
};

/**
 * Accessible in-app replacement for window.confirm / window.alert / window.prompt.
 * Matches the dashboard dark theme instead of the browser chrome dialog.
 */
export function ConfirmDialog({
  open,
  title,
  description,
  variant = 'confirm',
  confirmLabel,
  cancelLabel = 'Cancel',
  tone = 'default',
  busy = false,
  inputLabel,
  inputPlaceholder,
  inputDefaultValue = '',
  inputRequired = false,
  inputMultiline = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const titleId = useId();
  const descId = useId();
  const inputId = useId();
  const confirmRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [inputValue, setInputValue] = useState(inputDefaultValue);

  const resolvedConfirmLabel =
    confirmLabel ?? (variant === 'alert' ? 'OK' : 'Confirm');

  const isPrompt = variant === 'prompt';
  const isAlert = variant === 'alert';
  const confirmDisabled =
    busy || (isPrompt && inputRequired && !inputValue.trim());

  useEffect(() => {
    if (!open) return;
    setInputValue(inputDefaultValue);
  }, [open, inputDefaultValue]);

  useEffect(() => {
    if (!open) return;
    if (isPrompt) {
      (inputMultiline ? textareaRef : inputRef).current?.focus();
    } else {
      confirmRef.current?.focus();
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, busy, onCancel, isPrompt, inputMultiline]);

  if (!open) return null;

  const handleConfirm = () => {
    if (confirmDisabled) return;
    if (isPrompt) {
      onConfirm(inputValue);
    } else {
      onConfirm();
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4"
      role="presentation"
      onClick={() => {
        if (!busy) onCancel();
      }}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        className="w-full max-w-md rounded-xl border border-hos-border bg-hos-bg-secondary p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id={titleId} className="text-lg font-semibold text-hos-text-primary">
          {title}
        </h2>
        {description ? (
          <div id={descId} className="mt-2 text-sm text-hos-text-muted">
            {description}
          </div>
        ) : null}
        {isPrompt ? (
          <div className="mt-4">
            {inputLabel ? (
              <label
                htmlFor={inputId}
                className="mb-1.5 block text-sm font-medium text-hos-text-secondary"
              >
                {inputLabel}
              </label>
            ) : null}
            {inputMultiline ? (
              <textarea
                ref={textareaRef}
                id={inputId}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder={inputPlaceholder}
                required={inputRequired}
                disabled={busy}
                rows={4}
                className="w-full rounded-lg border border-hos-border bg-hos-bg-tertiary px-3 py-2 text-sm text-hos-text-primary placeholder:text-hos-text-muted focus:border-hos-gold focus:outline-none focus:ring-1 focus:ring-hos-gold disabled:opacity-50"
              />
            ) : (
              <input
                ref={inputRef}
                id={inputId}
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder={inputPlaceholder}
                required={inputRequired}
                disabled={busy}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !confirmDisabled) {
                    e.preventDefault();
                    handleConfirm();
                  }
                }}
                className="w-full rounded-lg border border-hos-border bg-hos-bg-tertiary px-3 py-2 text-sm text-hos-text-primary placeholder:text-hos-text-muted focus:border-hos-gold focus:outline-none focus:ring-1 focus:ring-hos-gold disabled:opacity-50"
              />
            )}
          </div>
        ) : null}
        <div className="mt-5 flex justify-end gap-2">
          {!isAlert ? (
            <button
              type="button"
              onClick={onCancel}
              disabled={busy}
              className="rounded-lg border border-hos-border px-3 py-2 text-sm text-hos-text-secondary hover:bg-hos-bg-tertiary disabled:opacity-50"
            >
              {cancelLabel}
            </button>
          ) : null}
          <button
            ref={confirmRef}
            type="button"
            onClick={handleConfirm}
            disabled={confirmDisabled}
            className={`rounded-lg px-3 py-2 text-sm font-medium disabled:opacity-50 ${
              tone === 'danger'
                ? 'bg-red-600 text-white hover:bg-red-500'
                : 'bg-hos-gold text-[#1a1406] hover:opacity-90'
            }`}
          >
            {busy ? 'Working…' : resolvedConfirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
