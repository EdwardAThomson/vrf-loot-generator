// Notification (toast) store - lightweight UI feedback instead of alert()
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

export type NotificationVariant = 'success' | 'error' | 'info';

export interface Notification {
  id: string;
  message: string;
  variant: NotificationVariant;
  /** Auto-dismiss delay in ms. 0 disables auto-dismiss. */
  duration: number;
}

interface NotificationsState {
  notifications: Notification[];
}

interface NotificationsActions {
  notify: (message: string, variant?: NotificationVariant, duration?: number) => string;
  dismiss: (id: string) => void;
  clearAll: () => void;
}

type NotificationsStore = NotificationsState & NotificationsActions;

const DEFAULT_DURATION = 4000;

let counter = 0;

const useNotificationsStore = create<NotificationsStore>()(
  devtools(
    (set) => ({
      notifications: [],

      notify: (message, variant = 'info', duration = DEFAULT_DURATION) => {
        counter += 1;
        const id = `toast-${Date.now()}-${counter}`;
        set((state) => ({
          notifications: [...state.notifications, { id, message, variant, duration }]
        }));
        return id;
      },

      dismiss: (id) => set((state) => ({
        notifications: state.notifications.filter(n => n.id !== id)
      })),

      clearAll: () => set({ notifications: [] })
    }),
    {
      name: 'notifications-store'
    }
  )
);

export default useNotificationsStore;
