// 《代號：極限追逐》(Tag & Chaos) — PeerJS WebRTC P2P Multiplayer Manager

export class P2PManager {
  constructor() {
    this.peer = null;
    this.isHost = false;
    this.roomCode = '';
    this.myId = '';
    this.connections = new Map(); // peerId -> DataConnection (host side)
    this.hostConn = null;         // client side
    this.onLobbyUpdate = null;
    this.onStartMatch = null;
    this.onSnapshot = null;
    this.onClientInput = null;
    this.onSpectatorSkill = null;
    this.onStatus = null;
    this.onError = null;
  }

  hasPeerJS() {
    return typeof window.Peer === 'function';
  }

  emitStatus(msg) {
    if (this.onStatus) this.onStatus(msg);
  }

  generateRoomCode() {
    const num = Math.floor(1000 + Math.random() * 9000);
    return `TAG-${num}`;
  }

  destroy() {
    for (const conn of this.connections.values()) {
      try { conn.close(); } catch {}
    }
    this.connections.clear();
    if (this.hostConn) {
      try { this.hostConn.close(); } catch {}
      this.hostConn = null;
    }
    if (this.peer) {
      try { this.peer.destroy(); } catch {}
      this.peer = null;
    }
  }

  createRoom(onReady) {
    if (!this.hasPeerJS()) {
      if (this.onError) this.onError('PeerJS 尚未載入（可能離線），請檢查網路或先遊玩單人模式！');
      return;
    }
    this.destroy();
    this.isHost = true;
    this.roomCode = this.generateRoomCode();
    const peerId = `tagchaos-${this.roomCode}`;
    this.emitStatus('正在向 P2P 節點註冊房間...');

    this.peer = new window.Peer(peerId);
    this.peer.on('open', (id) => {
      this.myId = id;
      this.emitStatus(`房間已建立：${this.roomCode}`);
      if (onReady) onReady(this.roomCode, id);
    });

    this.peer.on('connection', (conn) => {
      conn.on('open', () => {
        this.connections.set(conn.peer, conn);
        this.emitStatus(`玩家連線加入 (${conn.peer.slice(0, 8)})`);
      });
      conn.on('data', (msg) => {
        this.handleHostMessage(conn, msg);
      });
      conn.on('close', () => {
        this.connections.delete(conn.peer);
        if (this.onLobbyUpdate) this.onLobbyUpdate({ type: 'leave', peerId: conn.peer });
      });
    });

    this.peer.on('error', (err) => {
      if (this.onError) this.onError(`連線錯誤：${err.type || err.message}`);
    });
  }

  joinRoom(code, profile, onJoined) {
    if (!this.hasPeerJS()) {
      if (this.onError) this.onError('PeerJS 尚未載入（可能離線），請檢查網路！');
      return;
    }
    this.destroy();
    this.isHost = false;
    this.roomCode = code.trim().toUpperCase();
    const hostPeerId = `tagchaos-${this.roomCode}`;
    this.emitStatus(`正在連線至房間 ${this.roomCode}...`);

    this.peer = new window.Peer();
    this.peer.on('open', (id) => {
      this.myId = id;
      const conn = this.peer.connect(hostPeerId, { reliable: false });
      this.hostConn = conn;
      conn.on('open', () => {
        this.emitStatus(`已連線至房間 ${this.roomCode}！`);
        conn.send({ type: 'hello', profile });
        if (onJoined) onJoined(id);
      });
      conn.on('data', (msg) => {
        this.handleClientMessage(msg);
      });
      conn.on('close', () => {
        if (this.onError) this.onError('與房主斷開連線');
      });
    });

    this.peer.on('error', (err) => {
      if (this.onError) this.onError(`無法加入房間 ${this.roomCode}：${err.type || err.message}`);
    });
  }

  handleHostMessage(conn, msg) {
    if (!msg || typeof msg !== 'object') return;
    if (msg.type === 'hello' || msg.type === 'profile') {
      if (this.onLobbyUpdate) this.onLobbyUpdate({ type: msg.type, peerId: conn.peer, profile: msg.profile });
    } else if (msg.type === 'input') {
      if (this.onClientInput) this.onClientInput(conn.peer, msg.input);
    } else if (msg.type === 'spec') {
      if (this.onSpectatorSkill) this.onSpectatorSkill(conn.peer, msg.skill, msg.x, msg.y);
    }
  }

  handleClientMessage(msg) {
    if (!msg || typeof msg !== 'object') return;
    if (msg.type === 'lobby') {
      if (this.onLobbyUpdate) this.onLobbyUpdate({ type: 'sync', state: msg.state });
    } else if (msg.type === 'start') {
      if (this.onStartMatch) this.onStartMatch(msg.config);
    } else if (msg.type === 'snap') {
      if (this.onSnapshot) this.onSnapshot(msg.snap);
    }
  }

  broadcast(msg) {
    for (const conn of this.connections.values()) {
      if (conn.open) conn.send(msg);
    }
  }

  sendToHost(msg) {
    if (this.hostConn && this.hostConn.open) {
      this.hostConn.send(msg);
    }
  }
}
