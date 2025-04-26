// DOM Elements
const app = document.getElementById('app');
const loading = document.getElementById('loading');
const headerContent = document.getElementById('header-content');

// Templates
const homeTemplate = document.getElementById('home-template');
const createGameTemplate = document.getElementById('create-game-template');
const joinGameTemplate = document.getElementById('join-game-template');
const gameTemplate = document.getElementById('game-template');

// State
let currentPage = 'home';
let currentGame = null;
let currentPlayerSteamId = null;
let refreshInterval = null;

// Helper Functions
function generateRandomCode(length = 6) {
  const characters = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
}

function formatDate(date) {
  if (!date) return '-';
  
  const d = new Date(date);
  if (isNaN(d.getTime())) return '-';
  
  return d.toLocaleString();
}

function getTimeSince(date) {
  if (!date) return '-';
  
  const d = new Date(date);
  if (isNaN(d.getTime())) return '-';
  
  const now = new Date();
  const seconds = Math.floor((now - d) / 1000);
  
  if (seconds < 60) return 'just now';
  
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

// API Functions
async function createGameSession(gameData) {
  try {
    const response = await fetch('/api/game', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(gameData)
    });
    
    if (!response.ok) {
      throw new Error('Failed to create game session');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error creating game session:', error);
    showNotification('Failed to create game session', 'error');
    throw error;
  }
}

async function joinGame(joinData) {
  try {
    const response = await fetch('/api/game/join', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(joinData)
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to join game');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error joining game:', error);
    showNotification(error.message || 'Failed to join game', 'error');
    throw error;
  }
}

async function getGameByCode(code) {
  try {
    const response = await fetch(`/api/game/code/${code}`);
    
    if (!response.ok) {
      throw new Error('Failed to fetch game session');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error fetching game by code:', error);
    showNotification('Failed to fetch game session', 'error');
    throw error;
  }
}

async function updatePlayerStatus(gameSessionId, steamId, status, message) {
  try {
    const response = await fetch('/api/game/status', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        gameSessionId,
        steamId,
        status,
        message
      })
    });
    
    if (!response.ok) {
      throw new Error('Failed to update player status');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error updating player status:', error);
    showNotification('Failed to update player status', 'error');
    throw error;
  }
}

async function completeTurn(gameSessionId, steamId) {
  try {
    const response = await fetch('/api/game/complete-turn', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        gameSessionId,
        steamId
      })
    });
    
    if (!response.ok) {
      throw new Error('Failed to complete turn');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error completing turn:', error);
    showNotification('Failed to complete turn', 'error');
    throw error;
  }
}

async function generateGameCode() {
  try {
    const response = await fetch('/api/generate-code');
    
    if (!response.ok) {
      throw new Error('Failed to generate game code');
    }
    
    const data = await response.json();
    return data.code;
  } catch (error) {
    console.error('Error generating game code:', error);
    return generateRandomCode(); // Fallback to client-side generation
  }
}

// UI Rendering Functions
function showLoading() {
  loading.style.display = 'flex';
}

function hideLoading() {
  loading.style.display = 'none';
}

function clearContent() {
  app.innerHTML = '';
  app.appendChild(loading);
  headerContent.innerHTML = '';
}

function renderHome() {
  clearContent();
  currentPage = 'home';
  
  // Clone template
  const homeContent = homeTemplate.content.cloneNode(true);
  
  // Event listeners
  homeContent.querySelector('#create-game-btn').addEventListener('click', () => renderCreateGame());
  homeContent.querySelector('#join-game-btn').addEventListener('click', () => renderJoinGame());
  
  // Add to app
  hideLoading();
  app.appendChild(homeContent);
}

async function renderCreateGame() {
  clearContent();
  currentPage = 'create';
  
  // Clone template
  const createGameContent = createGameTemplate.content.cloneNode(true);
  
  // Generate code
  const gameCodeInput = createGameContent.querySelector('#game-code');
  const code = await generateGameCode();
  gameCodeInput.value = code;
  
  // Event listeners
  createGameContent.querySelector('#refresh-code').addEventListener('click', async () => {
    const newCode = await generateGameCode();
    gameCodeInput.value = newCode;
  });
  
  createGameContent.querySelector('#copy-code').addEventListener('click', () => {
    gameCodeInput.select();
    document.execCommand('copy');
    showNotification('Game code copied to clipboard', 'success');
  });
  
  createGameContent.querySelector('#cancel-create').addEventListener('click', () => renderHome());
  
  createGameContent.querySelector('#create-game-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const gameNameInput = createGameContent.querySelector('#game-name');
    const player1SteamIdInput = createGameContent.querySelector('#player1-steam-id');
    const player2SteamIdInput = createGameContent.querySelector('#player2-steam-id');
    
    const gameData = {
      name: gameNameInput.value,
      code: gameCodeInput.value,
      player1SteamId: player1SteamIdInput.value,
      player2SteamId: player2SteamIdInput.value,
      currentTurn: player1SteamIdInput.value
    };
    
    showLoading();
    
    try {
      const game = await createGameSession(gameData);
      
      // Create player status for first player
      await storage.createPlayerStatus({
        gameSessionId: game.id,
        steamId: game.player1SteamId,
        status: 'ready'
      });
      
      currentGame = game;
      currentPlayerSteamId = game.player1SteamId;
      
      renderGame(game, game.player1SteamId);
    } catch (error) {
      hideLoading();
    }
  });
  
  // Add to app
  hideLoading();
  app.appendChild(createGameContent);
}

function renderJoinGame() {
  clearContent();
  currentPage = 'join';
  
  // Clone template
  const joinGameContent = joinGameTemplate.content.cloneNode(true);
  
  // Event listeners
  joinGameContent.querySelector('#cancel-join').addEventListener('click', () => renderHome());
  
  joinGameContent.querySelector('#join-game-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const gameCodeInput = joinGameContent.querySelector('#join-game-code');
    const steamIdInput = joinGameContent.querySelector('#join-steam-id');
    
    const joinData = {
      code: gameCodeInput.value,
      steamId: steamIdInput.value
    };
    
    showLoading();
    
    try {
      const data = await joinGame(joinData);
      currentGame = data.gameSession;
      currentPlayerSteamId = joinData.steamId;
      
      renderGame(data.gameSession, joinData.steamId);
    } catch (error) {
      hideLoading();
    }
  });
  
  // Add to app
  hideLoading();
  app.appendChild(joinGameContent);
}

function renderGame(game, playerSteamId) {
  clearContent();
  currentPage = 'game';
  
  // Set current game and player
  currentGame = game;
  currentPlayerSteamId = playerSteamId;
  
  // Clone template
  const gameContent = gameTemplate.content.cloneNode(true);
  
  // Set game details
  gameContent.querySelector('#game-name-display').textContent = game.name;
  gameContent.querySelector('#game-code-display').textContent = game.code;
  
  // Set player details
  gameContent.querySelector('#player1-name').textContent = `Player 1 (${game.player1SteamId})`;
  gameContent.querySelector('#player2-name').textContent = `Player 2 (${game.player2SteamId})`;
  
  // Set player statuses
  updatePlayerUI(gameContent, game);
  
  // Header content
  headerContent.innerHTML = `
    <div class="header-game-info">
      <span>${game.name}</span>
      <span class="header-code">Code: ${game.code}</span>
    </div>
  `;
  
  // Event listeners
  gameContent.querySelector('#copy-game-code').addEventListener('click', () => {
    navigator.clipboard.writeText(game.code);
    showNotification('Game code copied to clipboard', 'success');
  });
  
  gameContent.querySelector('#back-home').addEventListener('click', () => {
    if (refreshInterval) {
      clearInterval(refreshInterval);
      refreshInterval = null;
    }
    renderHome();
  });
  
  gameContent.querySelector('#enable-notifications').addEventListener('click', async () => {
    await subscribeToPushNotifications(playerSteamId);
  });
  
  // Status buttons
  gameContent.querySelector('#status-ready').addEventListener('click', async () => {
    await updatePlayerStatus(game.id, playerSteamId, 'ready', document.querySelector('#status-message').value || null);
    await refreshGameData();
  });
  
  gameContent.querySelector('#status-busy').addEventListener('click', async () => {
    await updatePlayerStatus(game.id, playerSteamId, 'busy', document.querySelector('#status-message').value || null);
    await refreshGameData();
  });
  
  gameContent.querySelector('#status-unavailable').addEventListener('click', async () => {
    await updatePlayerStatus(game.id, playerSteamId, 'unavailable', document.querySelector('#status-message').value || null);
    await refreshGameData();
  });
  
  // Complete turn button
  gameContent.querySelector('#complete-turn').addEventListener('click', async () => {
    await completeTurn(game.id, playerSteamId);
    await refreshGameData();
  });
  
  // Add to app
  hideLoading();
  app.appendChild(gameContent);
  
  // Set up refresh interval
  if (refreshInterval) {
    clearInterval(refreshInterval);
  }
  
  refreshInterval = setInterval(refreshGameData, 30000); // Refresh every 30 seconds
}

async function refreshGameData() {
  try {
    if (!currentGame) return;
    
    const game = await getGameByCode(currentGame.code);
    currentGame = game;
    
    // Update the UI without re-rendering the whole page
    updatePlayerUI(document, game);
  } catch (error) {
    console.error('Error refreshing game data:', error);
  }
}

function updatePlayerUI(root, game) {
  // Player 1 status
  const player1Status = game.player1Status || { status: 'waiting', message: null, lastTurnCompleted: null };
  root.querySelector('#player1-status').textContent = player1Status.status || 'waiting';
  root.querySelector('#player1-message').textContent = player1Status.message || '-';
  root.querySelector('#player1-last-turn').textContent = player1Status.lastTurnCompleted ? getTimeSince(player1Status.lastTurnCompleted) : '-';
  
  // Player 1 status indicator
  const player1StatusIndicator = root.querySelector('#player1-status-indicator');
  player1StatusIndicator.className = 'status-indicator';
  if (player1Status.status === 'ready') player1StatusIndicator.classList.add('ready');
  if (player1Status.status === 'busy') player1StatusIndicator.classList.add('busy');
  if (player1Status.status === 'unavailable') player1StatusIndicator.classList.add('unavailable');
  
  // Player 2 status
  const player2Status = game.player2Status || { status: 'waiting', message: null, lastTurnCompleted: null };
  root.querySelector('#player2-status').textContent = player2Status.status || 'waiting';
  root.querySelector('#player2-message').textContent = player2Status.message || '-';
  root.querySelector('#player2-last-turn').textContent = player2Status.lastTurnCompleted ? getTimeSince(player2Status.lastTurnCompleted) : '-';
  
  // Player 2 status indicator
  const player2StatusIndicator = root.querySelector('#player2-status-indicator');
  player2StatusIndicator.className = 'status-indicator';
  if (player2Status.status === 'ready') player2StatusIndicator.classList.add('ready');
  if (player2Status.status === 'busy') player2StatusIndicator.classList.add('busy');
  if (player2Status.status === 'unavailable') player2StatusIndicator.classList.add('unavailable');
  
  // Turn arrow
  const turnArrow = root.querySelector('#turn-arrow');
  turnArrow.className = 'arrow';
  if (game.currentTurn === game.player2SteamId) {
    turnArrow.classList.add('left');
  }
  
  // Current player controls
  const isCurrentPlayer = currentPlayerSteamId === game.player1SteamId || currentPlayerSteamId === game.player2SteamId;
  const isTheirTurn = game.currentTurn === currentPlayerSteamId;
  
  // Complete turn button (only visible if it's their turn)
  const turnControls = root.querySelector('#turn-controls');
  turnControls.style.display = isCurrentPlayer && isTheirTurn ? 'block' : 'none';
}

// Initialize App
function initApp() {
  // Start at home page
  renderHome();
  
  // Check if we need to update the Firebase config
  if (firebaseConfig.apiKey === "YOUR_API_KEY") {
    showNotification('Firebase configuration not set! The app will run in offline mode.', 'warning', 10000);
  }
}

// Start the app
initApp();