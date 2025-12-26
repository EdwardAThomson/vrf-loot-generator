import React, { useState, useEffect, useMemo, useRef } from 'react';
import { generateAliceData, generateBobData, verifyDemoItem, DemoPlayer, DemoItem } from './generateDemoData';
import styles from './DeterministicTradeDemo.module.css';

/**
 * Deterministic Trade Demo
 * 
 * Fixed setup for debugging with REAL VRF cryptography:
 * - Player 1: Alice (fixed keypair, real VRF)
 * - Player 2: Bob (fixed keypair, real VRF)
 * - Deterministic items (same every time, but cryptographically valid)
 * - Step-by-step controls for commit-reveal protocol
 */

type TradeStep = 
  | 'SETUP'
  | 'INITIATED'
  | 'ALICE_COMMITTED'
  | 'BOB_COMMITTED'
  | 'ALICE_REVEALED'
  | 'BOB_REVEALED'
  | 'COMPLETED';

export const DeterministicTradeDemo: React.FC = () => {
  const [currentStep, setCurrentStep] = useState<TradeStep>('SETUP');
  const [tradeId, setTradeId] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  
  // Generate real VRF data deterministically - ONLY ONCE using useMemo
  // This ensures the same items are used throughout the entire demo session
  const aliceData = useMemo(() => generateAliceData(), []);
  const bobData = useMemo(() => generateBobData(), []);
  
  const alice: DemoPlayer = aliceData.player;
  const bob: DemoPlayer = bobData.player;
  const aliceItems: DemoItem[] = aliceData.items;
  const bobItems: DemoItem[] = bobData.items;
  
  // Inventory tracking - initialize with items
  const [aliceInventory, setAliceInventory] = useState<DemoItem[]>(aliceItems);
  const [bobInventory, setBobInventory] = useState<DemoItem[]>(bobItems);
  
  // Use refs to track values for auto-run (avoids React state timing issues)
  const tradeIdRef = useRef<string | null>(null);
  const aliceNonceRef = useRef<string>('');
  const aliceCommitmentRef = useRef<string>('');
  const bobNonceRef = useRef<string>('');
  const bobCommitmentRef = useRef<string>('');
  
  const [aliceCommitment, setAliceCommitment] = useState<string>('');
  const [aliceNonce, setAliceNonce] = useState<string>('');
  const [bobCommitment, setBobCommitment] = useState<string>('');
  const [bobNonce, setBobNonce] = useState<string>('');
  
  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, `[${timestamp}] ${message}`]);
    console.log(message);
  };
  
  // Step 1: Setup and join room
  const handleSetup = () => {
    addLog('🔧 Setting up deterministic trade demo with REAL VRF...');
    addLog(`👤 Player 1: ${alice.name} (${alice.id})`);
    addLog(`  Public Key: ${alice.publicKey.substring(0, 20)}...`);
    addLog(`👤 Player 2: ${bob.name} (${bob.id})`);
    addLog(`  Public Key: ${bob.publicKey.substring(0, 20)}...`);
    addLog('');
    addLog('📦 Generating Alice\'s items with VRF...');
    aliceItems.forEach((item, i) => {
      addLog(`  ${i + 1}. ${item.name} (${item.rarity})`);
      addLog(`     VRF Hash: ${item.vrfProof.hash.substring(0, 20)}...`);
    });
    addLog('');
    addLog('📦 Generating Bob\'s items with VRF...');
    bobItems.forEach((item, i) => {
      addLog(`  ${i + 1}. ${item.name} (${item.rarity})`);
      addLog(`     VRF Hash: ${item.vrfProof.hash.substring(0, 20)}...`);
    });
    addLog('');
    addLog('✅ Setup complete! All items are cryptographically generated and verifiable.');
    
    // Initialize inventories
    setAliceInventory([...aliceItems]);
    setBobInventory([...bobItems]);
    
    setCurrentStep('SETUP');
  };
  
  // Step 2: Alice initiates trade
  const handleInitiateTrade = () => {
    addLog('');
    addLog('📤 STEP 1: Alice initiates trade');
    addLog(`  Offering: ${aliceItems.map(i => i.name).join(', ')}`);
    
    // Simulate trade initiation
    const newTradeId = `trade-${Date.now()}`;
    setTradeId(newTradeId);
    
    addLog(`  Trade ID: ${newTradeId}`);
    addLog('  Status: INITIATED');
    setCurrentStep('INITIATED');
  };
  
  // Step 3: Alice commits
  const handleAliceCommit = () => {
    // Check both state and ref for tradeId (ref is for auto-run)
    if (!tradeId && !tradeIdRef.current) return;
    
    addLog('');
    addLog('🔒 STEP 2: Alice commits to her items');
    
    // Create commitment
    const CryptoJS = require('crypto-js');
    const nonce = 'alice-nonce-fixed-12345';
    const itemsString = JSON.stringify(aliceItems);
    const commitment = CryptoJS.SHA256(itemsString + nonce).toString();
    
    setAliceNonce(nonce);
    setAliceCommitment(commitment);
    aliceNonceRef.current = nonce;
    aliceCommitmentRef.current = commitment;
    
    addLog(`  Nonce: ${nonce.substring(0, 20)}...`);
    addLog(`  Commitment: ${commitment.substring(0, 20)}...`);
    addLog('  Status: ALICE_COMMITTED');
    setCurrentStep('ALICE_COMMITTED');
  };
  
  // Step 4: Bob commits
  const handleBobCommit = () => {
    if (!tradeId && !tradeIdRef.current) return;
    
    addLog('');
    addLog('🔒 STEP 3: Bob commits to his items');
    addLog(`  Offering: ${bobItems.map(i => i.name).join(', ')}`);
    
    // Create commitment
    const CryptoJS = require('crypto-js');
    const nonce = 'bob-nonce-fixed-67890';
    const itemsString = JSON.stringify(bobItems);
    const commitment = CryptoJS.SHA256(itemsString + nonce).toString();
    
    setBobNonce(nonce);
    setBobCommitment(commitment);
    bobNonceRef.current = nonce;
    bobCommitmentRef.current = commitment;
    
    addLog(`  Nonce: ${nonce.substring(0, 20)}...`);
    addLog(`  Commitment: ${commitment.substring(0, 20)}...`);
    addLog('  Status: BOB_COMMITTED (Both committed!)');
    setCurrentStep('BOB_COMMITTED');
  };
  
  // Step 5: Alice reveals
  const handleAliceReveal = () => {
    if (!tradeId && !tradeIdRef.current) return;
    
    // Use ref values if state hasn't updated yet
    const nonce = aliceNonce || aliceNonceRef.current;
    const commitment = aliceCommitment || aliceCommitmentRef.current;
    
    addLog('');
    addLog('🔓 STEP 4: Alice reveals her items');
    addLog(`  Nonce: ${nonce}`);
    addLog(`  Items: ${aliceItems.map(i => i.name).join(', ')}`);
    
    // Verify commitment
    const CryptoJS = require('crypto-js');
    const itemsString = JSON.stringify(aliceItems);
    const recomputedCommitment = CryptoJS.SHA256(itemsString + nonce).toString();
    
    if (recomputedCommitment === commitment) {
      addLog('  ✅ Commitment verified!');
    } else {
      addLog('  ❌ Commitment mismatch!');
    }
    
    addLog('  Status: ALICE_REVEALED');
    setCurrentStep('ALICE_REVEALED');
  };
  
  // Step 6: Bob reveals
  const handleBobReveal = () => {
    if (!tradeId && !tradeIdRef.current) return;
    
    // Use ref values if state hasn't updated yet
    const nonce = bobNonce || bobNonceRef.current;
    const commitment = bobCommitment || bobCommitmentRef.current;
    
    addLog('');
    addLog('🔓 STEP 5: Bob reveals his items');
    addLog(`  Nonce: ${nonce}`);
    addLog(`  Items: ${bobItems.map(i => i.name).join(', ')}`);
    
    // Verify commitment
    const CryptoJS = require('crypto-js');
    const itemsString = JSON.stringify(bobItems);
    const recomputedCommitment = CryptoJS.SHA256(itemsString + nonce).toString();
    
    if (recomputedCommitment === commitment) {
      addLog('  ✅ Commitment verified!');
    } else {
      addLog('  ❌ Commitment mismatch!');
    }
    
    addLog('  Status: BOB_REVEALED (Both revealed!)');
    setCurrentStep('BOB_REVEALED');
  };
  
  // Step 7: Complete trade
  const handleCompleteTrade = () => {
    if (!tradeId && !tradeIdRef.current) return;
    
    addLog('');
    addLog('✅ STEP 6: Completing trade');
    addLog('  Verifying items with REAL VRF proofs...');
    
    // REAL VRF verification
    let allValid = true;
    
    addLog('');
    addLog('  Verifying Alice\'s items:');
    aliceItems.forEach(item => {
      const isValid = verifyDemoItem(item, alice.publicKey);
      if (isValid) {
        addLog(`    ✅ ${item.name}: VRF proof VALID`);
      } else {
        addLog(`    ❌ ${item.name}: VRF proof INVALID`);
        allValid = false;
      }
    });
    
    addLog('');
    addLog('  Verifying Bob\'s items:');
    bobItems.forEach(item => {
      const isValid = verifyDemoItem(item, bob.publicKey);
      if (isValid) {
        addLog(`    ✅ ${item.name}: VRF proof VALID`);
      } else {
        addLog(`    ❌ ${item.name}: VRF proof INVALID`);
        allValid = false;
      }
    });
    
    if (!allValid) {
      addLog('');
      addLog('❌ Trade FAILED: Some items failed VRF verification!');
      setCurrentStep('SETUP');
      return;
    }
    
    addLog('');
    addLog('  ✅ All items verified successfully!');
    addLog('');
    addLog('  Exchanging items...');
    addLog(`    Alice receives: ${bobItems.map(i => i.name).join(', ')}`);
    addLog(`    Bob receives: ${aliceItems.map(i => i.name).join(', ')}`);
    
    // Update inventories
    setAliceInventory([...bobItems]);
    setBobInventory([...aliceItems]);
    
    addLog('');
    addLog('  📦 Inventory updated!');
    addLog(`    Alice now has: ${bobItems.map(i => i.name).join(', ')}`);
    addLog(`    Bob now has: ${aliceItems.map(i => i.name).join(', ')}`);
    
    addLog('');
    addLog('🎉 Trade completed successfully with cryptographic verification!');
    setCurrentStep('COMPLETED');
  };
  
  // Reset demo
  const handleReset = () => {
    setCurrentStep('SETUP');
    setTradeId(null);
    tradeIdRef.current = null;
    aliceNonceRef.current = '';
    aliceCommitmentRef.current = '';
    bobNonceRef.current = '';
    bobCommitmentRef.current = '';
    setAliceCommitment('');
    setAliceNonce('');
    setBobCommitment('');
    setBobNonce('');
    setLogs(['🔄 Demo reset. Click "Initiate Trade" or "Auto-Run" to start.']);
    setAliceInventory([...aliceItems]);
    setBobInventory([...bobItems]);
  };
  
  // Auto-run all steps
  const handleAutoRun = () => {
    // Reset first to ensure clean state
    setCurrentStep('SETUP');
    setAliceCommitment('');
    setAliceNonce('');
    setBobCommitment('');
    setBobNonce('');
    setLogs([]);
    setAliceInventory([...aliceItems]);
    setBobInventory([...bobItems]);
    
    // Run setup immediately
    handleSetup();
    
    // Create trade ID immediately and store in BOTH state and ref
    const newTradeId = `trade-${Date.now()}`;
    setTradeId(newTradeId);
    tradeIdRef.current = newTradeId;  // Ref updates immediately!
    
    // Then run steps with proper delays
    setTimeout(() => {
      addLog('');
      addLog('📤 STEP 1: Alice initiates trade');
      addLog(`  Offering: ${aliceItems.map(i => i.name).join(', ')}`);
      addLog(`  Trade ID: ${newTradeId}`);
      addLog('  Status: INITIATED');
      setCurrentStep('INITIATED');
    }, 800);
    
    setTimeout(() => handleAliceCommit(), 1600);
    setTimeout(() => handleBobCommit(), 2400);
    setTimeout(() => handleAliceReveal(), 3200);
    setTimeout(() => handleBobReveal(), 4000);
    setTimeout(() => handleCompleteTrade(), 4800);
  };
  
  useEffect(() => {
    // Just show initial message, don't run full setup
    setLogs(['🎯 Deterministic Trade Demo ready. Click "Initiate Trade" to start step-by-step, or "Auto-Run" to run all steps.']);
  }, []);
  
  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2>🎯 Deterministic Trade Demo</h2>
        <p>Step-by-step walkthrough of the commit-reveal protocol</p>
      </div>
      
      <div className={styles.content}>
        {/* Players Section */}
        <div className={styles.playersSection}>
          <div className={styles.player}>
            <h3>👤 Alice</h3>
            <div className={styles.playerInfo}>
              <p><strong>ID:</strong> {alice.id}</p>
              <p><strong>Public Key:</strong> {alice.publicKey}</p>
            </div>
            <div className={styles.items}>
              <h4>Items to Trade:</h4>
              {aliceItems.map(item => (
                <div key={item.id} className={`${styles.item} ${styles[item.rarity.toLowerCase()]}`}>
                  <span className={styles.itemName}>{item.name}</span>
                  <span className={styles.itemRarity}>{item.rarity}</span>
                </div>
              ))}
            </div>
          </div>
          
          <div className={styles.arrow}>⇄</div>
          
          <div className={styles.player}>
            <h3>👤 Bob</h3>
            <div className={styles.playerInfo}>
              <p><strong>ID:</strong> {bob.id}</p>
              <p><strong>Public Key:</strong> {bob.publicKey}</p>
            </div>
            <div className={styles.items}>
              <h4>Items to Trade:</h4>
              {bobItems.map(item => (
                <div key={item.id} className={`${styles.item} ${styles[item.rarity.toLowerCase()]}`}>
                  <span className={styles.itemName}>{item.name}</span>
                  <span className={styles.itemRarity}>{item.rarity}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        
        {/* Inventory Display */}
        <div className={styles.inventorySection}>
          <h3>📦 Current Inventories</h3>
          <div className={styles.inventories}>
            <div className={styles.inventoryColumn}>
              <h4>Alice's Inventory</h4>
              {aliceInventory.length === 0 ? (
                <p className={styles.emptyInventory}>Empty</p>
              ) : (
                aliceInventory.map(item => (
                  <div key={item.id} className={`${styles.inventoryItem} ${styles[item.rarity.toLowerCase()]}`}>
                    <span className={styles.itemName}>{item.name}</span>
                    <span className={styles.itemRarity}>{item.rarity}</span>
                  </div>
                ))
              )}
            </div>
            <div className={styles.inventoryColumn}>
              <h4>Bob's Inventory</h4>
              {bobInventory.length === 0 ? (
                <p className={styles.emptyInventory}>Empty</p>
              ) : (
                bobInventory.map(item => (
                  <div key={item.id} className={`${styles.inventoryItem} ${styles[item.rarity.toLowerCase()]}`}>
                    <span className={styles.itemName}>{item.name}</span>
                    <span className={styles.itemRarity}>{item.rarity}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
        
        {/* Current Step Indicator */}
        <div className={styles.stepIndicator}>
          <h3>Current Step: <span className={styles.stepName}>{currentStep}</span></h3>
          {tradeId && <p>Trade ID: {tradeId}</p>}
        </div>
        
        {/* Control Buttons */}
        <div className={styles.controls}>
          <h3>Step-by-Step Controls</h3>
          <div className={styles.buttonGrid}>
            <button 
              onClick={handleInitiateTrade}
              disabled={currentStep !== 'SETUP'}
              className={styles.stepButton}
            >
              1️⃣ Initiate Trade
            </button>
            
            <button 
              onClick={handleAliceCommit}
              disabled={currentStep !== 'INITIATED'}
              className={styles.stepButton}
            >
              2️⃣ Alice Commits
            </button>
            
            <button 
              onClick={handleBobCommit}
              disabled={currentStep !== 'ALICE_COMMITTED'}
              className={styles.stepButton}
            >
              3️⃣ Bob Commits
            </button>
            
            <button 
              onClick={handleAliceReveal}
              disabled={currentStep !== 'BOB_COMMITTED'}
              className={styles.stepButton}
            >
              4️⃣ Alice Reveals
            </button>
            
            <button 
              onClick={handleBobReveal}
              disabled={currentStep !== 'ALICE_REVEALED'}
              className={styles.stepButton}
            >
              5️⃣ Bob Reveals
            </button>
            
            <button 
              onClick={handleCompleteTrade}
              disabled={currentStep !== 'BOB_REVEALED'}
              className={styles.stepButton}
            >
              6️⃣ Complete Trade
            </button>
          </div>
          
          <div className={styles.utilityButtons}>
            <button onClick={handleAutoRun} className={styles.autoButton}>
              ▶️ Auto-Run All Steps
            </button>
            <button onClick={handleReset} className={styles.resetButton}>
              🔄 Reset Demo
            </button>
          </div>
        </div>
        
        {/* Logs Section */}
        <div className={styles.logsSection}>
          <h3>📋 Execution Log</h3>
          <div className={styles.logs}>
            {logs.length === 0 ? (
              <p className={styles.emptyLogs}>No logs yet. Click "Initiate Trade" to start.</p>
            ) : (
              logs.map((log, index) => (
                <div key={index} className={styles.logEntry}>
                  {log}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
