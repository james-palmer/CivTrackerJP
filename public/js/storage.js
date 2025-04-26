// In-memory storage fallback
class MemoryStorage {
  constructor() {
    this.gameSessions = [];
    this.playerStatuses = [];
    this.subscriptions = [];
    this.lastId = 0;
  }

  // Generate unique ID
  generateId() {
    return ++this.lastId;
  }

  // Game session methods
  async createGameSession(session) {
    const id = this.generateId();
    const newSession = {
      ...session,
      id,
      createdAt: new Date()
    };
    this.gameSessions.push(newSession);
    return newSession;
  }

  async getGameSessionByCode(code) {
    return this.gameSessions.find(session => session.code === code) || null;
  }

  async getGameSessionById(id) {
    return this.gameSessions.find(session => session.id === id) || null;
  }

  async getGameSessionWithPlayers(id) {
    const session = await this.getGameSessionById(id);
    if (!session) return null;
    
    const player1Status = await this.getPlayerStatus(id, session.player1SteamId);
    const player2Status = await this.getPlayerStatus(id, session.player2SteamId);
    
    return {
      ...session,
      player1Status,
      player2Status
    };
  }

  async getGameSessionWithPlayersByCode(code) {
    const session = await this.getGameSessionByCode(code);
    if (!session) return null;
    
    return this.getGameSessionWithPlayers(session.id);
  }

  async updateGameSessionTurn(id, currentTurn) {
    const sessionIndex = this.gameSessions.findIndex(session => session.id === id);
    if (sessionIndex === -1) return null;
    
    this.gameSessions[sessionIndex] = {
      ...this.gameSessions[sessionIndex],
      currentTurn
    };
    
    return this.gameSessions[sessionIndex];
  }

  // Player status methods
  async createPlayerStatus(playerStatus) {
    const existingStatusIndex = this.playerStatuses.findIndex(
      s => s.gameSessionId === playerStatus.gameSessionId && s.steamId === playerStatus.steamId
    );
    
    if (existingStatusIndex !== -1) {
      // Update existing status
      this.playerStatuses[existingStatusIndex] = {
        ...this.playerStatuses[existingStatusIndex],
        ...playerStatus,
        updatedAt: new Date()
      };
      return this.playerStatuses[existingStatusIndex];
    }
    
    // Create new status
    const id = this.generateId();
    const newStatus = {
      ...playerStatus,
      id,
      message: null,
      lastTurnCompleted: null,
      updatedAt: new Date()
    };
    this.playerStatuses.push(newStatus);
    return newStatus;
  }

  async getPlayerStatus(gameSessionId, steamId) {
    return this.playerStatuses.find(
      status => status.gameSessionId === gameSessionId && status.steamId === steamId
    ) || null;
  }

  async updatePlayerStatus(gameSessionId, steamId, status, message) {
    const statusIndex = this.playerStatuses.findIndex(
      s => s.gameSessionId === gameSessionId && s.steamId === steamId
    );
    
    if (statusIndex === -1) {
      // Create new status if it doesn't exist
      return this.createPlayerStatus({
        gameSessionId,
        steamId,
        status,
        message: message || null
      });
    }
    
    const updatedStatus = {
      ...this.playerStatuses[statusIndex],
      status,
      updatedAt: new Date()
    };
    
    if (message !== undefined) {
      updatedStatus.message = message;
    }
    
    this.playerStatuses[statusIndex] = updatedStatus;
    return updatedStatus;
  }

  async updatePlayerLastTurn(gameSessionId, steamId) {
    const statusIndex = this.playerStatuses.findIndex(
      s => s.gameSessionId === gameSessionId && s.steamId === steamId
    );
    
    if (statusIndex === -1) return null;
    
    const now = new Date();
    this.playerStatuses[statusIndex] = {
      ...this.playerStatuses[statusIndex],
      lastTurnCompleted: now,
      updatedAt: now
    };
    
    return this.playerStatuses[statusIndex];
  }

  // Subscription methods
  async saveSubscription(subscription) {
    const existingIndex = this.subscriptions.findIndex(
      s => s.steamId === subscription.steamId
    );
    
    if (existingIndex !== -1) {
      // Update existing subscription
      this.subscriptions[existingIndex] = {
        ...this.subscriptions[existingIndex],
        ...subscription
      };
      return this.subscriptions[existingIndex];
    }
    
    // Create new subscription
    const newSubscription = {
      ...subscription,
      createdAt: new Date()
    };
    this.subscriptions.push(newSubscription);
    return newSubscription;
  }

  async getSubscriptionBySteamId(steamId) {
    return this.subscriptions.find(sub => sub.steamId === steamId) || null;
  }
}

// Firestore storage implementation
class FirestoreStorage {
  constructor() {
    this.db = firebase.firestore();
  }

  // Helper methods
  gameSessionFromDoc(doc) {
    if (!doc.exists) return null;
    return {
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate() || new Date()
    };
  }

  playerStatusFromDoc(doc) {
    if (!doc.exists) return null;
    const data = doc.data();
    return {
      id: doc.id,
      ...data,
      lastTurnCompleted: data.lastTurnCompleted?.toDate() || null,
      updatedAt: data.updatedAt?.toDate() || new Date()
    };
  }

  // Game session methods
  async createGameSession(session) {
    try {
      const docRef = await this.db.collection('game_sessions').add({
        ...session,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      
      const doc = await docRef.get();
      return this.gameSessionFromDoc(doc);
    } catch (error) {
      console.error('Error creating game session:', error);
      throw error;
    }
  }

  async getGameSessionByCode(code) {
    try {
      const snapshot = await this.db.collection('game_sessions')
        .where('code', '==', code)
        .limit(1)
        .get();
      
      if (snapshot.empty) return null;
      return this.gameSessionFromDoc(snapshot.docs[0]);
    } catch (error) {
      console.error('Error getting game session by code:', error);
      throw error;
    }
  }

  async getGameSessionById(id) {
    try {
      const doc = await this.db.collection('game_sessions').doc(id).get();
      return this.gameSessionFromDoc(doc);
    } catch (error) {
      console.error('Error getting game session by ID:', error);
      throw error;
    }
  }

  async getGameSessionWithPlayers(id) {
    try {
      const session = await this.getGameSessionById(id);
      if (!session) return null;
      
      const player1Status = await this.getPlayerStatus(id, session.player1SteamId);
      const player2Status = await this.getPlayerStatus(id, session.player2SteamId);
      
      return {
        ...session,
        player1Status,
        player2Status
      };
    } catch (error) {
      console.error('Error getting game session with players:', error);
      throw error;
    }
  }

  async getGameSessionWithPlayersByCode(code) {
    try {
      const session = await this.getGameSessionByCode(code);
      if (!session) return null;
      
      return this.getGameSessionWithPlayers(session.id);
    } catch (error) {
      console.error('Error getting game session with players by code:', error);
      throw error;
    }
  }

  async updateGameSessionTurn(id, currentTurn) {
    try {
      await this.db.collection('game_sessions').doc(id).update({
        currentTurn
      });
      
      const doc = await this.db.collection('game_sessions').doc(id).get();
      return this.gameSessionFromDoc(doc);
    } catch (error) {
      console.error('Error updating game session turn:', error);
      throw error;
    }
  }

  // Player status methods
  async createPlayerStatus(playerStatus) {
    try {
      // Check if player status already exists
      const existingSnapshot = await this.db.collection('player_statuses')
        .where('gameSessionId', '==', playerStatus.gameSessionId)
        .where('steamId', '==', playerStatus.steamId)
        .limit(1)
        .get();
      
      if (!existingSnapshot.empty) {
        // Update existing status
        const existingDoc = existingSnapshot.docs[0];
        await existingDoc.ref.update({
          ...playerStatus,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        const updatedDoc = await existingDoc.ref.get();
        return this.playerStatusFromDoc(updatedDoc);
      }
      
      // Create new status
      const docRef = await this.db.collection('player_statuses').add({
        ...playerStatus,
        message: null,
        lastTurnCompleted: null,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      
      const doc = await docRef.get();
      return this.playerStatusFromDoc(doc);
    } catch (error) {
      console.error('Error creating player status:', error);
      throw error;
    }
  }

  async getPlayerStatus(gameSessionId, steamId) {
    try {
      const snapshot = await this.db.collection('player_statuses')
        .where('gameSessionId', '==', gameSessionId)
        .where('steamId', '==', steamId)
        .limit(1)
        .get();
      
      if (snapshot.empty) return null;
      return this.playerStatusFromDoc(snapshot.docs[0]);
    } catch (error) {
      console.error('Error getting player status:', error);
      throw error;
    }
  }

  async updatePlayerStatus(gameSessionId, steamId, status, message) {
    try {
      const snapshot = await this.db.collection('player_statuses')
        .where('gameSessionId', '==', gameSessionId)
        .where('steamId', '==', steamId)
        .limit(1)
        .get();
      
      const updateData = {
        status,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      };
      
      if (message !== undefined) {
        updateData.message = message;
      }
      
      if (snapshot.empty) {
        // Create new status if it doesn't exist
        return this.createPlayerStatus({
          gameSessionId,
          steamId,
          status,
          message: message || null
        });
      }
      
      // Update existing status
      await snapshot.docs[0].ref.update(updateData);
      const updatedDoc = await snapshot.docs[0].ref.get();
      return this.playerStatusFromDoc(updatedDoc);
    } catch (error) {
      console.error('Error updating player status:', error);
      throw error;
    }
  }

  async updatePlayerLastTurn(gameSessionId, steamId) {
    try {
      const snapshot = await this.db.collection('player_statuses')
        .where('gameSessionId', '==', gameSessionId)
        .where('steamId', '==', steamId)
        .limit(1)
        .get();
      
      if (snapshot.empty) return null;
      
      const now = new Date();
      await snapshot.docs[0].ref.update({
        lastTurnCompleted: now,
        updatedAt: now
      });
      
      const updatedDoc = await snapshot.docs[0].ref.get();
      return this.playerStatusFromDoc(updatedDoc);
    } catch (error) {
      console.error('Error updating player last turn:', error);
      throw error;
    }
  }

  // Subscription methods
  async saveSubscription(subscription) {
    try {
      const snapshot = await this.db.collection('subscriptions')
        .where('steamId', '==', subscription.steamId)
        .limit(1)
        .get();
      
      if (!snapshot.empty) {
        // Update existing subscription
        await snapshot.docs[0].ref.update(subscription);
        const updatedDoc = await snapshot.docs[0].ref.get();
        return {
          id: updatedDoc.id,
          ...updatedDoc.data()
        };
      }
      
      // Create new subscription
      const docRef = await this.db.collection('subscriptions').add({
        ...subscription,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      
      const doc = await docRef.get();
      return {
        id: doc.id,
        ...doc.data()
      };
    } catch (error) {
      console.error('Error saving subscription:', error);
      throw error;
    }
  }

  async getSubscriptionBySteamId(steamId) {
    try {
      const snapshot = await this.db.collection('subscriptions')
        .where('steamId', '==', steamId)
        .limit(1)
        .get();
      
      if (snapshot.empty) return null;
      
      const doc = snapshot.docs[0];
      return {
        id: doc.id,
        ...doc.data()
      };
    } catch (error) {
      console.error('Error getting subscription by Steam ID:', error);
      throw error;
    }
  }
}

// Hybrid storage that falls back to memory if Firestore fails
class HybridStorage {
  constructor() {
    this.firestoreStorage = new FirestoreStorage();
    this.memoryStorage = new MemoryStorage();
    this.useFirestore = true;
  }

  async withFallback(firestoreMethod, memoryMethod) {
    if (!this.useFirestore) {
      return memoryMethod();
    }
    
    try {
      return await firestoreMethod();
    } catch (error) {
      console.warn('Firestore error, falling back to in-memory storage:', error);
      this.useFirestore = false;
      return memoryMethod();
    }
  }

  // Game session methods
  async createGameSession(session) {
    return this.withFallback(
      () => this.firestoreStorage.createGameSession(session),
      () => this.memoryStorage.createGameSession(session)
    );
  }

  async getGameSessionByCode(code) {
    return this.withFallback(
      () => this.firestoreStorage.getGameSessionByCode(code),
      () => this.memoryStorage.getGameSessionByCode(code)
    );
  }

  async getGameSessionById(id) {
    return this.withFallback(
      () => this.firestoreStorage.getGameSessionById(id),
      () => this.memoryStorage.getGameSessionById(id)
    );
  }

  async getGameSessionWithPlayers(id) {
    return this.withFallback(
      () => this.firestoreStorage.getGameSessionWithPlayers(id),
      () => this.memoryStorage.getGameSessionWithPlayers(id)
    );
  }

  async getGameSessionWithPlayersByCode(code) {
    return this.withFallback(
      () => this.firestoreStorage.getGameSessionWithPlayersByCode(code),
      () => this.memoryStorage.getGameSessionWithPlayersByCode(code)
    );
  }

  async updateGameSessionTurn(id, currentTurn) {
    return this.withFallback(
      () => this.firestoreStorage.updateGameSessionTurn(id, currentTurn),
      () => this.memoryStorage.updateGameSessionTurn(id, currentTurn)
    );
  }

  // Player status methods
  async createPlayerStatus(playerStatus) {
    return this.withFallback(
      () => this.firestoreStorage.createPlayerStatus(playerStatus),
      () => this.memoryStorage.createPlayerStatus(playerStatus)
    );
  }

  async getPlayerStatus(gameSessionId, steamId) {
    return this.withFallback(
      () => this.firestoreStorage.getPlayerStatus(gameSessionId, steamId),
      () => this.memoryStorage.getPlayerStatus(gameSessionId, steamId)
    );
  }

  async updatePlayerStatus(gameSessionId, steamId, status, message) {
    return this.withFallback(
      () => this.firestoreStorage.updatePlayerStatus(gameSessionId, steamId, status, message),
      () => this.memoryStorage.updatePlayerStatus(gameSessionId, steamId, status, message)
    );
  }

  async updatePlayerLastTurn(gameSessionId, steamId) {
    return this.withFallback(
      () => this.firestoreStorage.updatePlayerLastTurn(gameSessionId, steamId),
      () => this.memoryStorage.updatePlayerLastTurn(gameSessionId, steamId)
    );
  }

  // Subscription methods
  async saveSubscription(subscription) {
    return this.withFallback(
      () => this.firestoreStorage.saveSubscription(subscription),
      () => this.memoryStorage.saveSubscription(subscription)
    );
  }

  async getSubscriptionBySteamId(steamId) {
    return this.withFallback(
      () => this.firestoreStorage.getSubscriptionBySteamId(steamId),
      () => this.memoryStorage.getSubscriptionBySteamId(steamId)
    );
  }
}

// Create storage instance
const storage = new HybridStorage();