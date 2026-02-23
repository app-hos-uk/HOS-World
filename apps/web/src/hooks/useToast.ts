import { useMemo } from 'react';
import toast from 'react-hot-toast';

const toastMethods = {
  success: (message: string) => {
    toast.success(message, {
      duration: 4000,
    });
  },
  error: (message: string) => {
    toast.error(message, {
      duration: 5000,
    });
  },
  info: (message: string) => {
    toast(message, {
      duration: 4000,
      icon: 'ℹ️',
      style: {
        border: '1px solid #6366f1',
      },
    });
  },
  warning: (message: string) => {
    toast(message, {
      duration: 5000,
      icon: '⚠️',
      style: {
        border: '1px solid #f59e0b',
      },
    });
  },
  loading: (message: string) => {
    return toast.loading(message);
  },
  promise: <T,>(
    promise: Promise<T>,
    messages: {
      loading: string;
      success: string | ((data: T) => string);
      error: string | ((error: any) => string);
    }
  ) => {
    return toast.promise(
      promise,
      {
        loading: messages.loading,
        success: messages.success,
        error: messages.error,
      },
      {
        duration: 4000,
      }
    );
  },
  dismiss: (toastId?: string) => {
    toast.dismiss(toastId);
  },
};

export const useToast = () => {
  return useMemo(() => toastMethods, []);
};
