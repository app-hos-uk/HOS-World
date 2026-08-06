'use client';

import { useState, useCallback, type ReactNode } from 'react';

interface ConfirmDialogState {
  title: string;
  description?: ReactNode;
  variant?: 'confirm' | 'alert' | 'prompt';
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'default' | 'danger';
  inputLabel?: string;
  inputPlaceholder?: string;
  inputDefaultValue?: string;
  inputRequired?: boolean;
  inputMultiline?: boolean;
  onConfirm: (value?: string) => void;
}

export function useConfirmDialog() {
  const [state, setState] = useState<ConfirmDialogState | null>(null);

  const confirm = useCallback(
    (opts: Omit<ConfirmDialogState, 'variant' | 'onConfirm'> & {
      variant?: 'confirm';
      onConfirm?: () => void;
    }) => {
      return new Promise<boolean>((resolve) => {
        setState({
          ...opts,
          variant: 'confirm',
          onConfirm: () => {
            resolve(true);
            setState(null);
            opts.onConfirm?.();
          },
        });
      });
    },
    [],
  );

  // Simpler imperative API: returns void for fire-and-forget
  const open = useCallback((opts: ConfirmDialogState) => {
    setState(opts);
  }, []);

  const close = useCallback(() => setState(null), []);

  const dialogProps = state
    ? {
        open: true as const,
        title: state.title,
        description: state.description,
        variant: state.variant,
        confirmLabel: state.confirmLabel,
        cancelLabel: state.cancelLabel,
        tone: state.tone,
        inputLabel: state.inputLabel,
        inputPlaceholder: state.inputPlaceholder,
        inputDefaultValue: state.inputDefaultValue,
        inputRequired: state.inputRequired,
        inputMultiline: state.inputMultiline,
        onConfirm: state.onConfirm,
        onCancel: close,
      }
    : {
        open: false as const,
        title: '',
        onConfirm: (_value?: string) => {},
        onCancel: () => {},
      };

  return { isOpen: !!state, open, close, confirm, dialogProps };
}
