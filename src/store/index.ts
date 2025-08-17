// Import for use in combined hook
import useInventoryStore from './inventory.store';
import useTradingStore from './trading.store';
import useVRFStore from './vrf.store';
import usePlayersStore from './players.store';

// Export all Zustand stores
export { default as useInventoryStore } from './inventory.store';
export { default as useTradingStore } from './trading.store';
export { default as useVRFStore } from './vrf.store';
export { default as usePlayersStore } from './players.store';

// Combined store hook for components that need multiple stores
export const useStores = () => {
  const inventory = useInventoryStore();
  const trading = useTradingStore();
  const vrf = useVRFStore();
  const players = usePlayersStore();
  
  return {
    inventory,
    trading,
    vrf,
    players
  };
};
