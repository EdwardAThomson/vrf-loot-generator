// Main App Component - Clean Architecture
import React, { useState } from 'react';
import { VRFTesting } from './components/features/vrf-testing/VRFTesting.js';
import { LootGenerator } from './components/features/loot-generator/LootGenerator.js';
import { TradingSystem } from './components/features/trading/TradingSystem.js';
import './styles/globals.css';

/**
 * Main application component with tab navigation
 */
function App() {
  const [activeTab, setActiveTab] = useState('vrf');

  const tabs = [
    { id: 'vrf', label: 'VRF Testing', component: VRFTesting },
    { id: 'loot', label: 'Loot Generator', component: LootGenerator },
    { id: 'trading', label: 'Trading System', component: TradingSystem }
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
        <ActiveComponent />
      </main>
    </div>
  );
}

export default App;
