// Toast notification components
import React, { useEffect } from 'react';
import useNotificationsStore from '../../../store/notifications.store';
import type { Notification } from '../../../store/notifications.store';
import styles from './Toast.module.css';

interface ToastProps {
  notification: Notification;
  onDismiss: (id: string) => void;
}

/**
 * Single toast message with auto-dismiss and manual close
 */
export const Toast: React.FC<ToastProps> = ({ notification, onDismiss }) => {
  const { id, message, variant, duration } = notification;

  useEffect(() => {
    if (duration <= 0) {
      return;
    }
    const timer = setTimeout(() => onDismiss(id), duration);
    return () => clearTimeout(timer);
  }, [id, duration, onDismiss]);

  return (
    <div className={`${styles.toast} ${styles[variant]}`} role="status">
      <span className={styles.message}>{message}</span>
      <button
        className={styles.closeButton}
        onClick={() => onDismiss(id)}
        aria-label="Dismiss notification"
      >
        &times;
      </button>
    </div>
  );
};

/**
 * Renders all active toasts; mount once at the app level
 */
export const ToastContainer: React.FC = () => {
  const notifications = useNotificationsStore(state => state.notifications);
  const dismiss = useNotificationsStore(state => state.dismiss);

  if (notifications.length === 0) {
    return null;
  }

  return (
    <div className={styles.container} aria-live="polite">
      {notifications.map(notification => (
        <Toast key={notification.id} notification={notification} onDismiss={dismiss} />
      ))}
    </div>
  );
};
