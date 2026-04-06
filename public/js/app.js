// ============================================
// Main Application Controller (Supabase + Auth + Servers)
// ============================================

import { signUp, signIn, signOut, getSession, getUser } from './supabase.js';
import { getProfile, updateStatus } from './profile.js';
import ServerManager from './servers.js';

(() => {
  // ========== State ==========
  let currentUser = null;
  let username = null;
  let activeServerId = null;
  let activeChannelId = null;
  let currentRoomId = null;
  let roomsSummary = {};
  let roomUsers = {};
  let speakingStates = {};
  let muteStates = {};
  let screenSharers = new Set();
  let localIsMuted = false;
  let localIsDeafened = false;
  let localIsScreenSharing = false;
  let peerVolumes = {};
  let avatarColor = null;
  let socketId = null;
  let userServers = [];
  let currentServerData = null;

  // ========== Init ==========
  async function init() {
    const session = await getSession();
    if (session) {
      currentUser = session.user;
      avatarColor = getRandomColor();
      username = session.user.user_metadata?.username || session.user.email.split('@')[0];
      socketId = 'user_' + Math.random().toString(36).substr(2, 9);
      showApp();
    } else {
      setupAuthModal();
    }
  }

  function setupAuthModal() {
    document.getElementById('login-submit').addEventListener('click', handleLogin);
    document.getElementById('login-password').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') handleLogin();
    });

    document.getElementById('register-submit').addEventListener('click', handleRegister);
    document.getElementById('register-password').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') handleRegister();
    });

    document.getElementById('show-register').addEventListener('click', () => {
      document.getElementById('login-form').classList.add('hidden');
      document.getElementById('register-form').classList.remove('hidden');
    });

    document.getElementById('show-login').addEventListener('click', () => {
      document.getElementById('register-form').classList.add('hidden');
      document.getElementById('login-form').classList.remove('hidden');
    });
  }

  async function handleLogin() {
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    const errorEl = document.getElementById('auth-error');

    if (!email || !password) {
      errorEl.textContent = 'Preencha todos os campos';
      errorEl.classList.remove('hidden');
      return;
    }

    const { data, error } = await signIn(email, password);

    if (error) {
      errorEl.textContent = error.message;
      errorEl.classList.remove('hidden');
    } else {
      currentUser = data.user;
      username = data.user.user_metadata?.username || email.split('@')[0];
      avatarColor = getRandomColor();
      socketId = 'user_' + Math.random().toString(36).substr(2, 9);
      errorEl.classList.add('hidden');
      showApp();
    }
  }

  async function handleRegister() {
    const email = document.getElementById('register-email').value.trim();
    const password = document.getElementById('register-password').value;
    const displayName = document.getElementById('register-username').value.trim();
    const errorEl = document.getElementById('auth-error');

    if (!email || !password || !displayName) {
      errorEl.textContent = 'Preencha todos os campos';
      errorEl.classList.remove('hidden');
      return;
    }

    if (password.length < 6) {
      errorEl.textContent = 'Senha deve ter pelo menos 6 caracteres';
      errorEl.classList.remove('hidden');
      return;
    }

    const { data: signupData, error: signupError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { username: displayName },
        emailRedirectTo: window.location.origin
      }
    });

    if (signupError) {
      errorEl.textContent = signupError.message;
      errorEl.classList.remove('hidden');
    } else {
      if (signupData.user && !signupData.session) {
        errorEl.textContent = 'Conta criada! Verifique seu email para confirmar.';
        errorEl.classList.remove('hidden');
        document.getElementById('register-form').classList.add('hidden');
        document.getElementById('login-form').classList.remove('hidden');
      } else {
        currentUser = signupData.user;
        username = displayName;
        avatarColor = getRandomColor();
        socketId = 'user_' + Math.random().toString(36).substr(2, 9);
        errorEl.classList.add('hidden');
        showApp();
      }
    }
  }

  function showApp() {
    document.getElementById('login-modal').classList.remove('active');
    document.getElementById('app').classList.remove('hidden');

    updateUserPanel();
    addLogoutButton();
    startApp();
  }

  async function updateUserPanel() {
    if (!currentUser) return;

    const profile = await getProfile(currentUser.id);
    if (profile) {
      username = profile.username;
      avatarColor = profile.avatar_color || avatarColor;
    }

    document.getElementById('user-display-name').textContent = username;
    document.getElementById('user-avatar-letter').textContent = (username || 'U')[0].toUpperCase();
    document.getElementById('user-avatar').style.background = avatarColor;

    const statusDot = document.querySelector('#user-avatar .status-dot');
    if (statusDot && profile) {
      statusDot.className = 'status-dot ' + (profile.status || 'online');
    }

    const statusTextEl = document.querySelector('.user-status');
    if (statusTextEl && profile?.status_text) {
      statusTextEl.textContent = profile.status_text;
    } else if (statusTextEl) {
      const statusLabels = { online: 'Online', idle: 'Ausente', dnd: 'Nao Perturbe', invisible: 'Invisivel' };
      statusTextEl.textContent = statusLabels[profile?.status || 'online'];
    }
  }

  window.updateUserPanel = updateUserPanel;

  function addLogoutButton() {
    const userControls = document.querySelector('.user-controls');
    const existingLogout = document.getElementById('btn-logout');
    if (existingLogout) return;

    const logoutBtn = document.createElement('button');
    logoutBtn.id = 'btn-logout';
    logoutBtn.className = 'user-panel-logout';
    logoutBtn.textContent = 'Sair';
    logoutBtn.title = 'Sair da conta';
    logoutBtn.addEventListener('click', handleLogout);
    userControls.appendChild(logoutBtn);
  }

  async function handleLogout() {
    await signOut();
    location.reload();
  }

  function getRandomColor() {
    const colors = [
      '#7c3aed', '#a855f7', '#6366f1', '#ec4899', '#3b82f6',
      '#06b6d4', '#fbbf24', '#34d399', '#ef4444', '#8b5cf6'
    ];
    return colors[Math.floor(Math.random() * colors.length)];
  }

  // ========== Server Management ==========

  async function loadUserServers() {
    userServers = await ServerManager.getServers();
    renderServerIcons();
  }

  function renderServerIcons() {
    const container = document.getElementById('server-icons');
    container.innerHTML = '';

    userServers.forEach(server => {
      const icon = document.createElement('div');
      icon.className = `server-icon ${server.id === activeServerId ? 'active' : ''}`;
      icon.dataset.server = server.id;
      icon.title = server.name;

      const initials = server.name
        .split(' ')
        .map(w => w[0])
        .join('')
        .substring(0, 2)
        .toUpperCase();

      icon.innerHTML = `<span class="server-avatar" style="background: ${server.color || 'var(--blurple)'}">${server.icon || initials}</span>`;

      icon.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        openServerContextMenu(server.id, e);
      });

      container.appendChild(icon);
    });
  }

  async function selectServer(serverId) {
    activeServerId = serverId;
    document.querySelectorAll('.server-icon').forEach(icon => {
      icon.classList.toggle('active', icon.dataset.server === (serverId || 'home'));
    });

    if (serverId) {
      const server = userServers.find(s => s.id === serverId);
      if (!server) return;

      currentServerData = server;
      const channels = await ServerManager.getServerChannels(serverId);
      UI.renderChannelsFromDB(server, channels, activeChannelId, roomsSummary);
    } else {
      currentServerData = null;
      document.getElementById('server-name').textContent = 'AuraVoice';
      document.getElementById('channels-container').innerHTML = `
        <div style="padding: 16px; color: var(--text-muted); text-align: center;">
          <p>Selecione um servidor</p>
        </div>`;
    }
  }

  async function joinVoiceChannel(channelId, channelName) {
    const newRoomId = `${activeServerId}:${channelId}`;
    if (newRoomId === currentRoomId) return;

    if (currentRoomId) {
      await RealtimeManager.leaveRoom();
      WebRTCManager.closeAllPeers();
      WebRTCManager.stopMicrophone();
    }

    currentRoomId = newRoomId;
    activeChannelId = channelId;
    roomUsers = {};
    speakingStates = {};
    muteStates = {};
    screenSharers.clear();
    muteStates[socketId] = { muted: false, deafened: false };

    await RealtimeManager.joinRoom(currentRoomId);
    RealtimeManager.updatePresence({ username, avatarColor, isMuted: localIsMuted, isDeafened: localIsDeafened });
    await WebRTCManager.startMicrophone();

    WebRTCManager.onSpeaking((isSpeaking) => {
      speakingStates[socketId] = isSpeaking;
      UI.updateSpeakingState(socketId, isSpeaking);
      RealtimeManager.sendSpeaking(isSpeaking);
    });

    updateControlButtons();
    UI.showVoiceView(channelName);
    UI.showToast(`Conectado a ${channelName}`, 'success');
  }

  function leaveVoiceChannel() {
    if (!currentRoomId) return;
    if (localIsScreenSharing) {
      WebRTCManager.stopScreenShare();
      localIsScreenSharing = false;
    }
    WebRTCManager.closeAllPeers();
    WebRTCManager.stopMicrophone();
    RealtimeManager.leaveRoom();

    currentRoomId = null;
    activeChannelId = null;
    roomUsers = {};
    speakingStates = {};
    muteStates = {};
    screenSharers.clear();

    UI.hideVoiceView();
    if (activeServerId) {
      selectServer(activeServerId);
    }
    UI.showToast('Desconectado', 'info');
  }

  function renderCurrentVoiceUsers() {
    if (!currentRoomId || !roomUsers) return;
    UI.renderVoiceUsers(roomUsers, socketId, speakingStates, muteStates, screenSharers);
    document.querySelectorAll('.volume-slider').forEach(slider => {
      const sId = slider.dataset.socketId;
      const savedVolume = peerVolumes[sId] !== undefined ? peerVolumes[sId] : 1.0;
      slider.value = savedVolume * 100;
      slider.addEventListener('input', (e) => {
        const volume = e.target.value / 100;
        peerVolumes[sId] = volume;
        WebRTCManager.setPeerVolume(sId, volume);
      });
    });
  }

  function updateControlButtons() {
    const muteBtn = document.getElementById('btn-mute');
    const deafenBtn = document.getElementById('btn-deafen');
    const screenBtn = document.getElementById('btn-screen-share');
    muteBtn.classList.toggle('active', localIsMuted);
    deafenBtn.classList.toggle('active', localIsDeafened);
    screenBtn.classList.toggle('active', localIsScreenSharing);
  }

  // ========== Server Context Menu ==========

  function openServerContextMenu(serverId, e) {
    closeServerContextMenu();

    const menu = document.createElement('div');
    menu.id = 'server-context-menu';
    menu.className = 'context-menu';
    menu.style.left = e.clientX + 'px';
    menu.style.top = e.clientY + 'px';

    const server = userServers.find(s => s.id === serverId);
    if (!server) return;

    const isOwner = server.owner_id === currentUser?.id;

    menu.innerHTML = `
      <div class="context-menu-item" data-action="invite">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M15 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm-9-2V7H4v3H1v2h3v3h2v-3h3v-2H6zm9 4c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
        Convidar Pessoas
      </div>
      <div class="context-menu-separator"></div>
      <div class="context-menu-item" data-action="settings">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.07.62-.07.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/></svg>
        Configuracoes do Servidor
      </div>
      ${isOwner ? `
      <div class="context-menu-separator"></div>
      <div class="context-menu-item danger" data-action="delete">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
        Excluir Servidor
      </div>
      ` : `
      <div class="context-menu-separator"></div>
      <div class="context-menu-item danger" data-action="leave">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z"/></svg>
        Sair do Servidor
      </div>
      `}
    `;

    menu.addEventListener('click', async (e) => {
      const item = e.target.closest('.context-menu-item');
      if (!item) return;

      const action = item.dataset.action;
      closeServerContextMenu();

      switch (action) {
        case 'invite':
          openInviteModal(serverId);
          break;
        case 'settings':
          openServerSettingsModal(serverId);
          break;
        case 'delete':
          if (confirm(`Tem certeza que deseja excluir "${server.name}"?`)) {
            await ServerManager.deleteServer(serverId);
            if (activeServerId === serverId) selectServer(null);
            await loadUserServers();
            UI.showToast('Servidor excluido', 'success');
          }
          break;
        case 'leave':
          if (confirm(`Tem certeza que deseja sair de "${server.name}"?`)) {
            await ServerManager.leaveServer(serverId);
            if (activeServerId === serverId) selectServer(null);
            await loadUserServers();
            UI.showToast('Voce saiu do servidor', 'info');
          }
          break;
      }
    });

    document.body.appendChild(menu);

    requestAnimationFrame(() => {
      const rect = menu.getBoundingClientRect();
      if (rect.right > window.innerWidth) {
        menu.style.left = (window.innerWidth - rect.width - 8) + 'px';
      }
      if (rect.bottom > window.innerHeight) {
        menu.style.top = (window.innerHeight - rect.height - 8) + 'px';
      }
    });
  }

  function closeServerContextMenu() {
    const existing = document.getElementById('server-context-menu');
    if (existing) existing.remove();
  }

  // ========== Invite Modal ==========

  async function openInviteModal(serverId) {
    const modal = document.getElementById('invite-modal');
    const linkEl = document.getElementById('invite-link');
    const copyBtn = document.getElementById('invite-copy-btn');

    let invites = await ServerManager.getInvites(serverId);
    let activeInvite = invites.find(i => {
      if (i.max_uses > 0 && i.uses >= i.max_uses) return false;
      if (i.expires_at && new Date(i.expires_at) < new Date()) return false;
      return true;
    });

    if (!activeInvite) {
      const { data } = await ServerManager.createInvite(serverId);
      if (data) activeInvite = data;
    }

    if (activeInvite) {
      const inviteUrl = `${window.location.origin}?invite=${activeInvite.code}`;
      linkEl.value = inviteUrl;
    }

    modal.classList.add('active');

    copyBtn.onclick = async () => {
      await navigator.clipboard.writeText(linkEl.value);
      copyBtn.textContent = 'Copiado!';
      setTimeout(() => { copyBtn.textContent = 'Copiar Link'; }, 2000);
    };
  }

  function closeInviteModal() {
    document.getElementById('invite-modal').classList.remove('active');
  }

  // ========== Server Settings Modal ==========

  async function openServerSettingsModal(serverId) {
    const modal = document.getElementById('server-settings-modal');
    const server = userServers.find(s => s.id === serverId);
    if (!server) return;

    document.getElementById('settings-server-name').value = server.name;
    document.getElementById('settings-server-color').value = server.color || '#7c3aed';
    modal.dataset.serverId = serverId;

    const members = await ServerManager.getServerMembers(serverId);
    renderMembersList(members, serverId);

    modal.classList.add('active');
  }

  function renderMembersList(members, serverId) {
    const container = document.getElementById('members-list');
    container.innerHTML = '';

    const roleOrder = { owner: 0, admin: 1, member: 2 };
    members.sort((a, b) => roleOrder[a.role] - roleOrder[b.role]);

    members.forEach(member => {
      const profile = member.profiles || {};
      const el = document.createElement('div');
      el.className = 'member-item';
      el.dataset.userId = member.user_id;

      const initials = (profile.username || 'U')[0].toUpperCase();
      const roleLabel = { owner: 'Dono', admin: 'Admin', member: 'Membro' }[member.role];

      el.innerHTML = `
        <div class="member-avatar" style="background: ${profile.avatar_color || '#7c3aed'}">${profile.avatar_url ? `<img src="${profile.avatar_url}" alt="">` : initials}</div>
        <div class="member-info">
          <span class="member-name">${profile.username || 'Usuario'}</span>
          <span class="member-role ${member.role}">${roleLabel}</span>
        </div>
        <div class="member-actions">
          ${member.role !== 'owner' ? `
            <select class="member-role-select" data-user-id="${member.user_id}">
              <option value="member" ${member.role === 'member' ? 'selected' : ''}>Membro</option>
              <option value="admin" ${member.role === 'admin' ? 'selected' : ''}>Admin</option>
            </select>
            <button class="member-kick-btn" data-user-id="${member.user_id}" title="Expulsar">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z"/></svg>
            </button>
          ` : '<span class="owner-badge">Dono</span>'}
        </div>
      `;

      container.appendChild(el);
    });

    container.querySelectorAll('.member-role-select').forEach(select => {
      select.addEventListener('change', async (e) => {
        const userId = e.target.dataset.userId;
        await ServerManager.updateMemberRole(serverId, userId, e.target.value);
        const members = await ServerManager.getServerMembers(serverId);
        renderMembersList(members, serverId);
        UI.showToast('Cargo atualizado', 'success');
      });
    });

    container.querySelectorAll('.member-kick-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const userId = e.target.closest('button').dataset.userId;
        if (confirm('Expulsar este membro?')) {
          await ServerManager.removeMember(serverId, userId);
          const members = await ServerManager.getServerMembers(serverId);
          renderMembersList(members, serverId);
          UI.showToast('Membro expulso', 'info');
        }
      });
    });
  }

  function closeServerSettingsModal() {
    document.getElementById('server-settings-modal').classList.remove('active');
  }

  async function saveServerSettings() {
    const modal = document.getElementById('server-settings-modal');
    const serverId = modal.dataset.serverId;
    const name = document.getElementById('settings-server-name').value.trim();
    const color = document.getElementById('settings-server-color').value;

    if (!name) {
      UI.showToast('Nome e obrigatorio', 'error');
      return;
    }

    const { error } = await ServerManager.updateServer(serverId, { name, color });
    if (error) {
      UI.showToast(error.message, 'error');
    } else {
      UI.showToast('Servidor atualizado!', 'success');
      closeServerSettingsModal();
      await loadUserServers();
      if (activeServerId === serverId) selectServer(serverId);
    }
  }

  // ========== Create Server Modal ==========

  function openCreateServerModal() {
    document.getElementById('create-server-modal').classList.add('active');
    document.getElementById('create-server-name').value = '';
    document.getElementById('create-server-name').focus();
  }

  function closeCreateServerModal() {
    document.getElementById('create-server-modal').classList.remove('active');
  }

  async function handleCreateServer() {
    const name = document.getElementById('create-server-name').value.trim();
    if (!name) {
      UI.showToast('Digite um nome para o servidor', 'error');
      return;
    }

    const { data, error } = await ServerManager.createServer(name);
    if (error) {
      UI.showToast(error.message, 'error');
    } else {
      UI.showToast(`Servidor "${name}" criado!`, 'success');
      closeCreateServerModal();
      await loadUserServers();
      selectServer(data.id);
    }
  }

  // ========== Join Server Modal ==========

  function openJoinServerModal() {
    document.getElementById('join-server-modal').classList.add('active');
    document.getElementById('join-server-code').value = '';
    document.getElementById('join-server-code').focus();
  }

  function closeJoinServerModal() {
    document.getElementById('join-server-modal').classList.remove('active');
  }

  async function handleJoinServer() {
    const input = document.getElementById('join-server-code').value.trim();
    const code = input.replace(/.*[?&]invite=/, '');

    if (!code) {
      UI.showToast('Digite um codigo de convite', 'error');
      return;
    }

    const { data, error } = await ServerManager.joinByInvite(code);
    if (error) {
      UI.showToast(error.message, 'error');
    } else {
      UI.showToast(`Voce entrou em "${data.name}"!`, 'success');
      closeJoinServerModal();
      await loadUserServers();
      selectServer(data.id);
    }
  }

  // ========== Check URL for invite ==========

  async function checkUrlInvite() {
    const params = new URLSearchParams(window.location.search);
    const inviteCode = params.get('invite');
    if (inviteCode) {
      window.history.replaceState({}, '', window.location.pathname);
      if (currentUser) {
        const { data, error } = await ServerManager.joinByInvite(inviteCode);
        if (error) {
          UI.showToast(error.message, 'error');
        } else {
          UI.showToast(`Voce entrou em "${data.name}"!`, 'success');
          await loadUserServers();
          selectServer(data.id);
        }
      } else {
        sessionStorage.setItem('pendingInvite', inviteCode);
      }
    }
  }

  // ========== App Start ==========

  function startApp() {
    const userData = {
      socketId: socketId,
      username: username,
      avatarColor: avatarColor,
      isMuted: false,
      isDeafened: false,
      isSpeaking: false,
      isScreenSharing: false
    };

    RealtimeManager.connect(userData);
    setupRealtimeCallbacks();
    setupUIListeners();
    loadUserServers();
    selectServer(null);
    checkUrlInvite();

    console.log('✅ Conectado ao Supabase Realtime');
    UI.showToast(`Bem-vindo, ${username}!`, 'success');
  }

  function setupRealtimeCallbacks() {
    RealtimeManager.onGlobalUsersUpdatedCallback((state) => {
      roomsSummary = {};
      Object.values(state).forEach(peers => {
        peers.forEach(p => {
          if (p.roomId) {
            if (!roomsSummary[p.roomId]) roomsSummary[p.roomId] = { users: [], count: 0 };
            roomsSummary[p.roomId].users.push(p);
            roomsSummary[p.roomId].count++;
          }
        });
      });

      if (activeServerId) {
        selectServer(activeServerId);
      }
    });

    RealtimeManager.onRoomUsersUpdatedCallback((users) => {
      roomUsers = users;
      renderCurrentVoiceUsers();
      Object.keys(users).forEach(id => {
        if (id !== socketId) {
          WebRTCManager.connectToPeer(id);
        }
      });
    });

    RealtimeManager.onPeerConnectedCallback((peerData) => {
      console.log('🔗 Connecting to new peer:', peerData.socketId);
      roomUsers[peerData.socketId] = peerData;
      WebRTCManager.connectToPeer(peerData.socketId);
      UI.showToast(`${peerData.username} entrou no canal`, 'info');
      renderCurrentVoiceUsers();
    });

    RealtimeManager.onPeerDisconnectedCallback((peerSocketId) => {
      delete roomUsers[peerSocketId];
      WebRTCManager.closePeer(peerSocketId);
      renderCurrentVoiceUsers();
    });

    RealtimeManager.onOfferCallback(async ({ senderId, offer }) => {
      const pc = WebRTCManager.createPeerConnection(senderId);
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const localStream = WebRTCManager.getLocalStream();
      if (localStream) {
        localStream.getTracks().forEach(track => {
          pc.addTrack(track, localStream);
        });
      }
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      RealtimeManager.sendAnswer(senderId, pc.localDescription);
    });

    RealtimeManager.onIceCandidateCallback(async ({ senderId, candidate }) => {
      const pc = WebRTCManager.getPeerConnection(senderId);
      if (pc && candidate) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (e) {
          console.error('Erro ICE:', e);
        }
      }
    });

    RealtimeManager.onScreenShareStartedCallback(({ socketId: sharerId, username: sharerName }) => {
      screenSharers.add(sharerId);
      UI.showToast(`${sharerName} compartilhando tela`, 'info');
      document.querySelectorAll('audio[id^="remote-audio-"]').forEach(audio => {
        if (audio.id !== `remote-audio-${sharerId}`) {
          audio.dataset.wasPlaying = audio.volume > 0;
          audio.muted = true;
        }
      });
      renderCurrentVoiceUsers();
    });

    RealtimeManager.onScreenShareStoppedCallback(({ socketId: sharerId }) => {
      screenSharers.delete(sharerId);
      UI.removeScreenShareStream(sharerId);
      document.querySelectorAll('audio[id^="remote-audio-"]').forEach(audio => {
        audio.muted = localIsDeafened;
      });
      renderCurrentVoiceUsers();
    });

    RealtimeManager.onSpeakingChangedCallback(({ socketId: sId, isSpeaking }) => {
      speakingStates[sId] = isSpeaking;
      UI.updateSpeakingState(sId, isSpeaking);
    });

    RealtimeManager.onMuteStatusChangedCallback(({ socketId: sId, muted, deafened }) => {
      muteStates[sId] = { muted, deafened };
      renderCurrentVoiceUsers();
    });
  }

  function setupUIListeners() {
    document.getElementById('server-list').addEventListener('click', (e) => {
      const serverIcon = e.target.closest('.server-icon');
      if (!serverIcon) return;
      const serverId = serverIcon.dataset.server;
      if (serverId === 'home') { selectServer(null); return; }
      if (serverId) { selectServer(serverId); }
    });

    document.querySelector('.add-server').addEventListener('click', () => {
      openCreateServerModal();
    });

    document.getElementById('channels-container').addEventListener('click', (e) => {
      const channelItem = e.target.closest('.channel-item');
      if (!channelItem) return;
      const channelId = channelItem.dataset.channelId;
      const channelType = channelItem.dataset.channelType;
      const channelName = channelItem.dataset.channelName;
      if (channelType === 'voice') {
        joinVoiceChannel(channelId, channelName);
      }
    });

    document.getElementById('btn-mute').addEventListener('click', async () => {
      localIsMuted = WebRTCManager.toggleMute();
      updateControlButtons();
      RealtimeManager.sendMuteStatus(localIsMuted, localIsDeafened);
    });

    document.getElementById('btn-deafen').addEventListener('click', async () => {
      const result = WebRTCManager.toggleDeafen();
      localIsMuted = result.isMuted;
      localIsDeafened = result.isDeafened;
      updateControlButtons();
      RealtimeManager.sendMuteStatus(localIsMuted, localIsDeafened);
    });

    document.getElementById('btn-settings').addEventListener('click', () => {
      ProfileManager.openSettingsModal();
    });

    document.getElementById('user-avatar').addEventListener('click', () => {
      ProfileManager.openProfileModal(currentUser.id);
    });

    document.querySelector('.user-details').addEventListener('click', () => {
      ProfileManager.openProfileModal(currentUser.id);
    });

    document.getElementById('btn-screen-share').addEventListener('click', async () => {
      if (!localIsScreenSharing) {
        const stream = await WebRTCManager.startScreenShare();
        if (stream) {
          localIsScreenSharing = true;
          screenSharers.add(socketId);
          UI.setScreenShareStream(socketId, stream, username + ' (voce)');
          RealtimeManager.sendScreenShareStarted();
          updateControlButtons();
          renderCurrentVoiceUsers();
        }
      } else {
        WebRTCManager.stopScreenShare();
        localIsScreenSharing = false;
        screenSharers.delete(socketId);
        UI.removeScreenShareStream(socketId);
        RealtimeManager.sendScreenShareStopped();
        updateControlButtons();
        renderCurrentVoiceUsers();
      }
    });

    document.getElementById('btn-disconnect').addEventListener('click', () => leaveVoiceChannel());
    document.getElementById('btn-quality').addEventListener('click', () => UI.openQualityModal());
    document.getElementById('quality-modal-close').addEventListener('click', () => UI.closeQualityModal());
    document.getElementById('quality-modal').addEventListener('click', (e) => {
      if (e.target.id === 'quality-modal') UI.closeQualityModal();
    });
    document.getElementById('quality-save').addEventListener('click', () => {
      const settings = {
        video: {
          resolution: document.getElementById('quality-resolution').value,
          fps: document.getElementById('quality-fps').value,
          bitrate: document.getElementById('quality-bitrate').value
        },
        audio: {
          sampleRate: document.getElementById('quality-audio-sample').value,
          channels: document.getElementById('quality-audio-channels').value,
          processing: document.getElementById('quality-audio-processing').value
        }
      };
      WebRTCManager.setQualitySettings(settings);
      UI.closeQualityModal();
      UI.showToast('Configuracoes salvas!', 'success');
    });

    // Create server modal
    document.getElementById('create-server-submit').addEventListener('click', handleCreateServer);
    document.getElementById('create-server-name').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') handleCreateServer();
    });
    document.getElementById('create-server-modal-close').addEventListener('click', closeCreateServerModal);
    document.getElementById('create-server-modal').addEventListener('click', (e) => {
      if (e.target.id === 'create-server-modal') closeCreateServerModal();
    });

    // Join server modal
    document.getElementById('join-server-submit').addEventListener('click', handleJoinServer);
    document.getElementById('join-server-code').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') handleJoinServer();
    });
    document.getElementById('join-server-modal-close').addEventListener('click', closeJoinServerModal);
    document.getElementById('join-server-modal').addEventListener('click', (e) => {
      if (e.target.id === 'join-server-modal') closeJoinServerModal();
    });

    // Invite modal
    document.getElementById('invite-modal-close').addEventListener('click', closeInviteModal);
    document.getElementById('invite-modal').addEventListener('click', (e) => {
      if (e.target.id === 'invite-modal') closeInviteModal();
    });

    // Server settings modal
    document.getElementById('server-settings-save').addEventListener('click', saveServerSettings);
    document.getElementById('server-settings-modal-close').addEventListener('click', closeServerSettingsModal);
    document.getElementById('server-settings-modal').addEventListener('click', (e) => {
      if (e.target.id === 'server-settings-modal') closeServerSettingsModal();
    });

    // Close context menu on outside click
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.context-menu')) {
        closeServerContextMenu();
      }
    });

    // Expose for other modules
    window.loadUserServers = loadUserServers;
    window.selectServer = selectServer;
  }

  // ========== Start ==========
  document.addEventListener('DOMContentLoaded', init);
})();
