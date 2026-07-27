// Main App Component - Clean Architecture
import React, { useState } from 'react';
import { VRFTesting } from './components/features/vrf-testing/VRFTesting';
import { LootGenerator } from './components/features/loot-generator/LootGenerator';
import { TradingSystem } from './components/features/trading/TradingSystem';
import { OnlineTradingDemo } from './components/features/online-trading/OnlineTradingDemo';
import { DeterministicTradeDemo } from './components/features/deterministic-trade/DeterministicTradeDemo';
import { DungeonDemo } from './components/features/dungeon/DungeonDemo';
import { PlayerSession } from './components/layout/PlayerSession';
import { ToastContainer } from './components/ui/Toast/Toast';
import './styles/globals.css';

interface Tab {
  id: string;
  label: string;
  component: React.ComponentType;
}

/**
 * Main application component with tab navigation
 */
function App() {
  const [activeTab, setActiveTab] = useState<string>('vrf');

  const tabs: Tab[] = [
    { id: 'vrf', label: 'VRF Testing', component: VRFTesting },
    { id: 'loot', label: 'Loot Generator', component: LootGenerator },
    { id: 'dungeon', label: 'Dungeon Demo', component: DungeonDemo },
    { id: 'trade-demo', label: 'Trade Demo', component: DeterministicTradeDemo },
    { id: 'trading', label: 'Trading System', component: OnlineTradingDemo }
  ];

  const ActiveComponent = tabs.find(tab => tab.id === activeTab)?.component || VRFTesting;

  return (
    <div className="app">
      <header className="app-header">
        <h1>VRF Loot Generator</h1>
        <p>Verifiable Random Function-based loot generation and trading system</p>
      </header>

      <nav className="tab-navigation">
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={`tab-button ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <main className="app-main">
        <PlayerSession />
        <ActiveComponent />
      </main>
      <ToastContainer />
    </div>
  );
}

export default App;
