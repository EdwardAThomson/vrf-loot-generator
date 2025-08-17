# VRF Loot Generator - Clean Architecture Refactor Plan

## Overview
Rewrite the VRF loot generation and trading system with clean architecture principles, proper separation of concerns, and a WebSocket backend for cross-browser communication.

### Current Progress (Aug 17, 2025)

* __✅ Completed (Phase 1 - Core Infrastructure)__
  - **TypeScript Infrastructure**: Core type definitions implemented (`loot.types.ts`, `vrf.types.ts`, `websocket.types.ts`, `css.d.ts`)
  - **Zustand Store**: All stores with proper state management (`vrf.store.ts`, `inventory.store.ts`, `player.store.ts`, `players.store.ts`, `trading.store.ts`)
  - **Service Layer**: Clean loot service with VRF integration (`loot.service.ts`)
  - **VRF Service**: Consolidated TypeScript VRF service with all operations (`vrf.service.ts`)
  - **Folder Structure**: Proper organization (`components/features/`, `services/`, `hooks/`, `types/`, `store/`)
  - **Loot Generation**: Deterministic VRF-based loot generation with verification
  - **Complete TypeScript Migration**: All components converted to TypeScript (.tsx)
  - **CSS Modules Implementation**: All components using CSS modules (no inline styles)
  - **Custom Hooks**: VRF and loot generation hooks fully implemented (`useVRF.ts`, `useLootGeneration.ts`, `useInventory.ts`, `useTrading.ts`, `useWebSocket.ts`, `useOnlineTrading.ts`)
  - **UI Components**: Card/Button/Input components working with proper TypeScript interfaces

* __✅ Completed (Phase 2 - Component Architecture)__
  - **Component Architecture**: Clean separation with TypeScript interfaces
  - **Build System**: Successfully compiles with TypeScript (163.55 kB gzipped)
  - **Type Safety**: All major linting/TypeScript errors resolved, only minor ESLint warnings remain
  - **Import Resolution**: All import paths fixed, CSS modules working
  - **Feature Components**: Complete component structure (`features/vrf-testing/`, `features/loot-generator/`, `features/online-trading/`, `layout/`)

* __✅ Completed (Phase 2.5 - Testing Infrastructure)__
  - **Jest + TypeScript Setup**: @types/jest installed, TypeScript test configuration working
  - **Loot Service Tests**: Core loot generation logic fully tested with mocked VRF dependencies
  - **Hook Testing**: useVRF hook tests implemented with React Testing Library
  - **Test Environment**: TextEncoder polyfills and Jest setup files configured

* __✅ Completed (Phase 3 - Trading System Refactor)__
  - **Commit-Reveal Protocol**: Secure cryptographic trading service with SHA-256 hashing (`commit-reveal.service.ts`)
  - **Trading Service Layer**: Business logic for item validation, VRF integration, fairness assessment (`trading.service.ts`)
  - **Enhanced Trading Store**: Fully typed Zustand store with commit-reveal integration and validation
  - **Trading UI Components**: Complete set of components with consistent styling using LootItem component
  - **Custom Trading Hooks**: `useTrading`, `useInventory`, and `useOnlineTrading` hooks with clean APIs
  - **Trading Types**: Comprehensive TypeScript interfaces for all trading operations
  - **CSS Styling**: Modern, responsive UI with comprehensive trading system styles
  - **Security Features**: Cryptographic commitments prevent cheating, VRF verification ensures authentic items

* __✅ Completed (Phase 4 - WebSocket Backend & Online Trading)__
  - **WebSocket Backend**: Complete Node.js server with Socket.io (`server/` directory)
  - **Server Architecture**: Controllers, services, and types properly structured
  - **WebSocket Service**: Frontend WebSocket service with reconnection logic (`socket.service.ts`)
  - **Online Trading System**: Full online trading implementation with rooms and player management
  - **Player Session Management**: Player login/logout with persistent state
  - **Room Management**: Create/join rooms for trading sessions
  - **Real-time Communication**: Cross-browser player lists and trading coordination
  - **Type Safety**: Server and client types properly synchronized

* __✅ Completed (Phase 5 - UI/UX Improvements)__
  - **Consistent Inventory Display**: Trading system now uses same LootItem component as Loot Generator
  - **Debug Information**: Added player ID display and debug info for troubleshooting
  - **Responsive Design**: All components work across different screen sizes
  - **Loading States**: Proper loading indicators throughout the application

* __❌ Pending (Lower Priority)__
  - **Error Handling**: Replace remaining alert() calls with proper UI feedback
  - **VRF Service Tests**: Full VRF crypto tests (blocked by Jest/crypto library compatibility)
  - **Trading System Tests**: Unit tests for trading services and components

* __❌ Future Enhancements__
  - **Advanced Features**: Enhanced trading history, performance optimization
  - **Performance Optimization**: Code splitting, lazy loading
  - **Production Deployment**: Environment configuration and deployment setup

### Immediate Next Steps (Priority Order)
1. **Error Handling Improvements** - Replace remaining alert() calls with proper error UI components
2. **Trading System Tests** - Unit tests for trading services and components
3. **VRF Service Testing** - Resolve Jest/crypto compatibility issues for full test coverage
4. **Production Deployment** - Configure environment variables and deployment setup

### Remaining Issues to Address
1. **Error handling** - Some alert() calls still present in components
2. **VRF crypto testing** - Jest compatibility issues with elliptic/crypto libraries
3. **Trading tests** - Need comprehensive test coverage for new trading system
4. **Performance** - Could benefit from code splitting and optimization

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
- [x] All original functionality preserved
- [x] Cross-browser trading works
- [x] No inline CSS in components
- [x] Single VRF service used everywhere
- [ ] Proper error handling (no alerts)
- [x] TypeScript coverage
- [ ] Unit tests for core logic
- [x] Clean component separation
- [x] WebSocket backend working

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
