// Export all Zustand stores
export { default as useInventoryStore } from './inventory.store';
export { default as useTradingStore } from './trading.store';
export { default as useVRFStore } from './vrf.store';
export { default as usePlayersStore } from './players.store';

// Combined store hook for components that need multiple stores
export const useStores = () => ({
  inventory: useInventoryStore(),
  trading: useTradingStore(),
  vrf: useVRFStore(),
  players: usePlayersStore()
});
