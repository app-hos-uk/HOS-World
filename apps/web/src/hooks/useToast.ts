import { useMemo } from 'react';
import toast from 'react-hot-toast';
import { navIcon } from '@/lib/navIcons';

interface ToastOptions {
  id?: string;
  duration?: number;
}

const toastMethods = {
  success: (message: string, options?: ToastOptions) => {
    toast.success(message, {
      duration: 4000,
      ...options,
    });
  },
  error: (message: string, options?: ToastOptions) => {
    toast.error(message, {
      duration: 5000,
      ...options,
    });
  },
  info: (message: string, options?: ToastOptions) => {
    toast(message, {
      duration: 4000,
      icon: navIcon('info', 'w-5 h-5'),
      style: {
        border: '1px solid #6366f1',
      },
      ...options,
    });
  },
  warning: (message: string, options?: ToastOptions) => {
    toast(message, {
      duration: 5000,
      icon: navIcon('alert', 'w-5 h-5'),
      style: {
        border: '1px solid #f59e0b',
      },
      ...options,
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
