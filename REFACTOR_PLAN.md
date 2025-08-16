# VRF Loot Generator - Clean Architecture Refactor Plan

## Overview
Rewrite the VRF loot generation and trading system with clean architecture principles, proper separation of concerns, and a WebSocket backend for cross-browser communication.

## Current Progress (Aug 16, 2025)

* __Completed (JS-first)__
  - Single VRF service consolidated in `src/services/vrf/vrf.service.js` and consumed by hooks/services
  - Loot generation service in `src/services/loot/loot.service.js` with deterministic properties and verification
  - Feature tabs implemented: `VRF Testing` and `Loot Generator` using custom hooks (`useVRF.js`, `useLootGeneration.js`)
  - Cleaned folder structure (`components/features`, `services`, `hooks`, `utils`, `constants`)

* __In Progress__
  - Plan/documentation updates to reflect JS-first approach and phased TS migration

* __Pending__
  - Migrate inline styles to CSS Modules
  - Introduce Zustand stores for inventory and trading
  - Add Jest + RTL unit tests for `VRFService` and `LootService`
  - TypeScript migration of services, hooks, and components
  - Trading foundation and WebSocket backend

## Current Issues to Fix
1. **Inline CSS everywhere** - Makes components bloated and unmaintainable
2. **VRF code duplication** - `evaluate` function scattered across multiple files
3. **Mixed concerns** - UI, business logic, and data management intertwined
4. **BroadcastChannel limitation** - Only works within same browser instance
5. **Poor error handling** - Excessive use of `alert()` calls
6. **Overloaded Context** - TradeContext doing too much work
7. **No testing structure** - Hard to test mixed concerns
8. **No type safety** - JavaScript without proper typing

## New Architecture

### 1. Technology Stack
- **Frontend**: React 18 with TypeScript
- **Styling**: CSS Modules (clean separation from JS)
- **State Management**: Zustand (lightweight, modern)
- **Server State**: React Query (for WebSocket data)
- **Backend**: Node.js with WebSocket (Socket.io)
- **Testing**: Jest + React Testing Library
- **Build**: Vite (faster than Create React App)

### 2. Folder Structure
```
src/
├── components/
│   ├── ui/                 # Reusable UI components
│   │   ├── Button/
│   │   ├── Card/
│   │   ├── Input/
│   │   └── Modal/
│   ├── features/
│   │   ├── vrf-testing/    # VRF testing components
│   │   ├── loot-generator/ # Loot generation components
│   │   ├── inventory/      # Inventory management
│   │   ├── trading/        # Trading system components
│   │   └── player-list/    # Online players list
│   └── layout/             # Layout components
├── services/
│   ├── vrf/               # Single source for VRF operations
│   │   ├── vrf.service.ts
│   │   ├── vrf.types.ts
│   │   └── vrf.utils.ts
│   ├── trading/           # Trading business logic
│   │   ├── trading.service.ts
│   │   ├── commit-reveal.ts
│   │   └── trading.types.ts
│   ├── websocket/         # WebSocket communication
│   │   ├── socket.service.ts
│   │   └── socket.types.ts
│   └── loot/              # Loot generation logic
│       ├── loot.service.ts
│       └── loot.types.ts
├── hooks/                 # Custom React hooks
│   ├── useVRF.ts
│   ├── useTrading.ts
│   ├── useInventory.ts
│   └── useWebSocket.ts
├── store/                 # Zustand stores
│   ├── vrf.store.ts
│   ├── trading.store.ts
│   ├── inventory.store.ts
│   └── players.store.ts
├── styles/                # CSS Modules
│   ├── globals.css
│   ├── variables.css
│   └── components/
├── types/                 # TypeScript type definitions
│   ├── vrf.types.ts
│   ├── trading.types.ts
│   ├── loot.types.ts
│   └── api.types.ts
├── utils/                 # Helper functions
│   ├── crypto.utils.ts
│   ├── format.utils.ts
│   └── validation.utils.ts
└── constants/             # Application constants
    ├── loot.constants.ts
    └── trading.constants.ts
```

### 3. Backend Structure
```
server/
├── src/
│   ├── controllers/       # WebSocket event handlers
│   ├── services/          # Business logic
│   ├── models/            # Data models
│   ├── middleware/        # WebSocket middleware
│   └── utils/             # Server utilities
├── package.json
└── tsconfig.json
```

## Implementation Phases

### Phase 1: Core Infrastructure
1. **Setup new project structure**
   - Initialize TypeScript configuration
   - Setup CSS Modules
   - Configure Zustand stores
   - Create base types and interfaces

2. **VRF Service Consolidation**
   - Create single `vrf.service.ts` with all VRF operations
   - Define proper TypeScript types for VRF data
   - Add comprehensive error handling
   - Write unit tests for VRF functions

3. **UI Component Library**
   - Create reusable UI components with CSS Modules
   - Button, Card, Input, Modal components
   - Consistent styling system with CSS variables

### Phase 2: Feature Implementation
1. **VRF Testing Tab**
   - Clean component with proper separation
   - Custom hook for VRF operations
   - Proper error handling and loading states

2. **Loot Generator Tab**
   - Loot generation service
   - Inventory management with Zustand
   - Item display components

3. **Trading System Foundation**
   - Trading store and hooks
   - Commit-reveal protocol service
   - Trading UI components

### Phase 3: WebSocket Backend
1. **Node.js WebSocket Server**
   - Player presence management
   - Real-time messaging
   - Trade coordination
   - Cross-browser communication

2. **Frontend WebSocket Integration**
   - WebSocket service with reconnection
   - Real-time player list
   - Trading message handling

### Phase 4: Advanced Features
1. **Enhanced Trading**
   - Targeted trade requests
   - Trade history
   - Better UX with loading states

2. **Testing & Polish**
   - Comprehensive test coverage
   - Error boundary components
   - Performance optimization

## Key Improvements

### 1. Single VRF Source of Truth
```typescript
// services/vrf/vrf.service.ts
export class VRFService {
  static evaluate(privateKey: string, message: Uint8Array): VRFResult
  static proofToHash(publicKey: string, message: Uint8Array, proof: Uint8Array): Uint8Array
  static generateKeyPair(): KeyPair
}
```

### 2. Clean Component Separation
```typescript
// components/features/loot-generator/LootGenerator.tsx
export const LootGenerator: React.FC = () => {
  const { generateLoot, isLoading, error } = useLootGeneration();
  const { inventory, addItems } = useInventory();
  
  // Pure UI logic only
};
```

### 3. Proper State Management
```typescript
// store/trading.store.ts
export const useTradingStore = create<TradingState>((set, get) => ({
  isTradeActive: false,
  currentTrade: null,
  initiateTradeWith: (playerId: string) => { /* logic */ },
}));
```

### 4. WebSocket Communication
```typescript
// services/websocket/socket.service.ts
export class SocketService {
  static connect(): void
  static emit(event: string, data: any): void
  static on(event: string, callback: Function): void
  static disconnect(): void
}
```

## Migration Strategy
1. **Keep original code** in `temp/original-src/` as reference
2. **Build new features incrementally** - can test against original
3. **Maintain same external API** - same functionality, better code
4. **Add WebSocket gradually** - start with same-browser, then cross-browser

## Success Criteria
- [ ] All original functionality preserved
- [ ] Cross-browser trading works
- [ ] No inline CSS in components
- [ ] Single VRF service used everywhere
- [ ] Proper error handling (no alerts)
- [ ] TypeScript coverage
- [ ] Unit tests for core logic
- [ ] Clean component separation
- [ ] WebSocket backend working

## Timeline Estimate
- **Phase 1**: 2-3 hours (Infrastructure)
- **Phase 2**: 3-4 hours (Feature Implementation)
- **Phase 3**: 2-3 hours (WebSocket Backend)
- **Phase 4**: 1-2 hours (Polish & Testing)

**Total**: ~8-12 hours of focused development

## Next Steps
1. Start with Phase 1 - setup clean project structure
2. Migrate VRF functionality first (most critical)
3. Build UI components with proper styling
4. Implement features one by one
5. Add WebSocket backend
6. Test thoroughly against original implementation
