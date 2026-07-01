# WebSocket Integration Testing Guide

## Overview
This guide explains how to test the complete WebSocket integration for the VRF loot generator trading system.

## Prerequisites
- Node.js installed
- All dependencies installed (`npm install` in both root and `/server` directories)

## Testing Steps

### 1. Start the Backend Server
```bash
cd server
npm run dev
```
The server will start on port 3001 and show:
- 🚀 VRF Loot Trading Server running on port 3001
- 📡 WebSocket endpoint: ws://localhost:3001
- 🌐 CORS origin: http://localhost:3000

### 2. Start the Frontend
```bash
# In the project root directory
npm start
```
The React app will start on port 3000.

### 3. Test Session Management
1. Open the app in your browser (http://localhost:3000)
2. You should see a "Player Session" section at the top
3. Enter a player name and click "Connect"
4. Verify the connection status shows "🟢 Connected"
5. Open the same URL in a new tab - you should remain connected without re-entering your name

### 4. Test Online Trading Demo
1. Navigate to the "Trading System" tab
2. Verify you see the trading interface without needing to enter your name again
3. Test room creation:
   - Enter a room name and click "Create Room"
   - Verify you join the room successfully
4. Test multi-user functionality:
   - Open the app in a different browser or incognito window
   - Connect with a different player name
   - Join the same room or create a new one
   - Verify both players appear in the online players list

### 5. Test Trading Features
1. With two players connected:
   - Click "Trade" next to another player's name
   - Verify trade initiation works
   - Test trade cancellation
2. Test room management:
   - Create and join different rooms
   - Leave rooms
   - Refresh player and room lists

### 6. Test Cross-Tab Persistence
1. With a connected session, open multiple tabs
2. Verify the session persists across all tabs
3. Disconnect in one tab and verify it affects all tabs
4. Reconnect and verify session restoration

## Expected Behavior

### ✅ Working Features
- **Global Session Management**: Single login persists across tabs
- **WebSocket Connection**: Real-time communication with server
- **Room Management**: Create, join, leave rooms
- **Player Discovery**: See other online players
- **Trade Initiation**: Start trades with other players
- **Session Persistence**: Maintain connection across browser tabs
- **Clean UI**: No duplicate login forms

### 🔧 Known Limitations
- Trade completion flow is basic (demo level)
- No actual item transfer (uses mock data)
- Limited error handling for network issues
- No user authentication (names only)

## Troubleshooting

### Server Won't Start
- Check if port 3001 is available
- Verify all server dependencies are installed
- Check for TypeScript compilation errors

### Frontend Won't Connect
- Ensure server is running on port 3001
- Check browser console for WebSocket connection errors
- Verify CORS settings allow localhost:3000

### Session Issues
- Clear localStorage if session state becomes corrupted
- Check browser console for Zustand persistence errors
- Verify PlayerSession component is properly integrated

## Architecture Notes

### Key Components
- **PlayerSession**: Global session management UI
- **OnlineTradingDemo**: Main trading interface
- **useWebSocket**: Connection and room management
- **useOnlineTrading**: Trade-specific functionality
- **SocketService**: Low-level WebSocket handling
- **Player Store**: Persistent session state with Zustand

### Data Flow
1. User logs in via PlayerSession component
2. Global player store manages session state
3. WebSocket hooks connect to server using stored credentials
4. Real-time events update UI components
5. Session persists across tabs via localStorage

## Next Steps
- Deploy to public hosting for cross-internet testing
- Add comprehensive error boundaries
- Implement full trade completion workflow
- Add user authentication and security
- Performance optimization and code splitting
