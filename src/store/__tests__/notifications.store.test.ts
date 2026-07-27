import { renderHook, act } from '@testing-library/react';
import useNotificationsStore from '../notifications.store';

describe('useNotificationsStore', () => {
  beforeEach(() => {
    // Reset store before each test
    act(() => {
      useNotificationsStore.getState().clearAll();
    });
  });

  test('should initialize with no notifications', () => {
    const { result } = renderHook(() => useNotificationsStore());

    expect(result.current.notifications).toEqual([]);
  });

  test('should add a notification with default variant and duration', () => {
    const { result } = renderHook(() => useNotificationsStore());

    act(() => {
      result.current.notify('Hello');
    });

    expect(result.current.notifications).toHaveLength(1);
    expect(result.current.notifications[0]).toMatchObject({
      message: 'Hello',
      variant: 'info',
      duration: 4000
    });
    expect(result.current.notifications[0].id).toBeTruthy();
  });

  test('should support success and error variants', () => {
    const { result } = renderHook(() => useNotificationsStore());

    act(() => {
      result.current.notify('Saved', 'success');
      result.current.notify('Failed', 'error', 0);
    });

    expect(result.current.notifications).toHaveLength(2);
    expect(result.current.notifications[0].variant).toBe('success');
    expect(result.current.notifications[1].variant).toBe('error');
    expect(result.current.notifications[1].duration).toBe(0);
  });

  test('should assign unique ids to notifications', () => {
    const { result } = renderHook(() => useNotificationsStore());
    let firstId = '';
    let secondId = '';

    act(() => {
      firstId = result.current.notify('One');
      secondId = result.current.notify('Two');
    });

    expect(firstId).not.toBe(secondId);
  });

  test('should dismiss a notification by id', () => {
    const { result } = renderHook(() => useNotificationsStore());
    let id = '';

    act(() => {
      id = result.current.notify('Dismiss me');
      result.current.notify('Keep me');
    });

    act(() => {
      result.current.dismiss(id);
    });

    expect(result.current.notifications).toHaveLength(1);
    expect(result.current.notifications[0].message).toBe('Keep me');
  });

  test('should clear all notifications', () => {
    const { result } = renderHook(() => useNotificationsStore());

    act(() => {
      result.current.notify('One');
      result.current.notify('Two');
    });

    act(() => {
      result.current.clearAll();
    });

    expect(result.current.notifications).toHaveLength(0);
  });
});
