import toast from 'react-hot-toast';

// Custom toast service with predefined styles and behaviors
export class ToastService {
  // Success toast (green with checkmark)
  static success(message: string, options?: { duration?: number }) {
    return toast.success(message, {
      duration: options?.duration || 4000,
      position: 'top-right',
      style: {
        background: '#10B981',
        color: '#ffffff',
        fontWeight: '500',
        borderRadius: '12px',
        padding: '12px 16px',
        fontSize: '14px',
        maxWidth: '400px',
        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
      },
      iconTheme: {
        primary: '#ffffff',
        secondary: '#10B981',
      },
    });
  }

  // Error toast (red with X icon)
  static error(message: string, options?: { duration?: number }) {
    return toast.error(message, {
      duration: options?.duration || 5000,
      position: 'top-right',
      style: {
        background: '#EF4444',
        color: '#ffffff',
        fontWeight: '500',
        borderRadius: '12px',
        padding: '12px 16px',
        fontSize: '14px',
        maxWidth: '400px',
        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
      },
      iconTheme: {
        primary: '#ffffff',
        secondary: '#EF4444',
      },
    });
  }

  // Warning toast (orange with warning icon)
  static warning(message: string, options?: { duration?: number }) {
    return toast(message, {
      duration: options?.duration || 4000,
      position: 'top-right',
      icon: '⚠️',
      style: {
        background: '#F59E0B',
        color: '#ffffff',
        fontWeight: '500',
        borderRadius: '12px',
        padding: '12px 16px',
        fontSize: '14px',
        maxWidth: '400px',
        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
      },
    });
  }

  // Info toast (blue with info icon)
  static info(message: string, options?: { duration?: number }) {
    return toast(message, {
      duration: options?.duration || 4000,
      position: 'top-right',
      icon: 'ℹ️',
      style: {
        background: '#3B82F6',
        color: '#ffffff',
        fontWeight: '500',
        borderRadius: '12px',
        padding: '12px 16px',
        fontSize: '14px',
        maxWidth: '400px',
        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
      },
    });
  }

  // Loading toast (for async operations)
  static loading(message: string) {
    return toast.loading(message, {
      position: 'top-right',
      style: {
        background: '#6B7280',
        color: '#ffffff',
        fontWeight: '500',
        borderRadius: '12px',
        padding: '12px 16px',
        fontSize: '14px',
        maxWidth: '400px',
        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
      },
    });
  }

  // Custom toast with emoji icon
  static custom(message: string, emoji: string, options?: { duration?: number; color?: string }) {
    return toast(message, {
      duration: options?.duration || 4000,
      position: 'top-right',
      icon: emoji,
      style: {
        background: options?.color || '#6B7280',
        color: '#ffffff',
        fontWeight: '500',
        borderRadius: '12px',
        padding: '12px 16px',
        fontSize: '14px',
        maxWidth: '400px',
        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
      },
    });
  }

  // Promise toast (shows loading, then success/error)
  static promise<T>(
    promise: Promise<T>,
    messages: {
      loading: string;
      success: string;
      error: string;
    }
  ) {
    return toast.promise(promise, messages, {
      position: 'top-right',
      style: {
        borderRadius: '12px',
        padding: '12px 16px',
        fontSize: '14px',
        maxWidth: '400px',
        fontWeight: '500',
        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
      },
      success: {
        style: {
          background: '#10B981',
          color: '#ffffff',
        },
        iconTheme: {
          primary: '#ffffff',
          secondary: '#10B981',
        },
      },
      error: {
        style: {
          background: '#EF4444',
          color: '#ffffff',
        },
        iconTheme: {
          primary: '#ffffff',
          secondary: '#EF4444',
        },
      },
      loading: {
        style: {
          background: '#6B7280',
          color: '#ffffff',
        },
      },
    });
  }

  // Dismiss all toasts
  static dismiss() {
    toast.dismiss();
  }

  // Dismiss specific toast
  static dismissById(toastId: string) {
    toast.dismiss(toastId);
  }
}

// Export default for convenience
export default ToastService;


