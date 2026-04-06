// ============================================
// Supabase Realtime Signaling Module
// ============================================

import { supabase } from './supabase.js';

const RealtimeManager = (() => {
  let currentRoomId = null;
  let currentUser = null;
  let channel = null;
  let isConnected = false;
  
  // Callbacks
  let onPeerConnected = null;
  let onPeerDisconnected = null;
  let onOffer = null;
  let onAnswer = null;
  let onIceCandidate = null;
  let onScreenShareStarted = null;
  let onScreenShareStopped = null;
  let onSpeakingChanged = null;
  let onMuteStatusChanged = null;
  let onRoomUsersUpdated = null;

  async function connect(userData) {
    currentUser = userData;
    
    // Subscribe to room events
    channel = supabase.channel('room-events', {
      config: {
        presence: { key: userData.socketId }
      }
    });
    
    // Handle presence sync
    channel.on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState();
      console.log('👥 Presence sync:', Object.keys(state));
      if (onRoomUsersUpdated) {
        const users = {};
        Object.values(state).forEach(peers => {
          peers.forEach(p => {
            users[p.socketId] = p;
          });
        });
        onRoomUsersUpdated(users);
      }
    });
    
    // Handle user joined
    channel.on('presence', { event: 'join' }, ({ key, newPresences }) => {
      console.log('✅ User joined:', key, newPresences);
      newPresences.forEach(p => {
        if (p.socketId !== currentUser.socketId && onPeerConnected) {
          onPeerConnected(p);
        }
      });
    });
    
    // Handle user left
    channel.on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
      console.log('❌ User left:', key, leftPresences);
      leftPresences.forEach(p => {
        if (onPeerDisconnected) {
          onPeerDisconnected(p.socketId);
        }
      });
    });
    
    // Handle custom events
    channel.on('broadcast', { event: 'offer' }, ({ payload }) => {
      if (onOffer) onOffer(payload);
    });
    
    channel.on('broadcast', { event: 'answer' }, ({ payload }) => {
      if (onAnswer) onAnswer(payload);
    });
    
    channel.on('broadcast', { event: 'ice-candidate' }, ({ payload }) => {
      if (onIceCandidate) onIceCandidate(payload);
    });
    
    channel.on('broadcast', { event: 'screen-offer' }, ({ payload }) => {
      if (onOffer) onOffer(payload);
    });
    
    channel.on('broadcast', { event: 'screen-answer' }, ({ payload }) => {
      if (onAnswer) onAnswer(payload);
    });
    
    channel.on('broadcast', { event: 'screen-ice-candidate' }, ({ payload }) => {
      if (onIceCandidate) onIceCandidate(payload);
    });
    
    channel.on('broadcast', { event: 'screen-share-started' }, ({ payload }) => {
      if (onScreenShareStarted) onScreenShareStarted(payload);
    });
    
    channel.on('broadcast', { event: 'screen-share-stopped' }, ({ payload }) => {
      if (onScreenShareStopped) onScreenShareStopped(payload);
    });
    
    channel.on('broadcast', { event: 'speaking' }, ({ payload }) => {
      if (onSpeakingChanged) onSpeakingChanged(payload);
    });
    
    channel.on('broadcast', { event: 'mute-status' }, ({ payload }) => {
      if (onMuteStatusChanged) onMuteStatusChanged(payload);
    });
    
    // Connect and track presence
    await channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        isConnected = true;
        console.log('✅ Conectado ao Supabase Realtime');
        
        // Track presence
        await channel.track(currentUser);
      }
    });
    
    return channel;
  }

  async function joinRoom(roomId) {
    currentRoomId = roomId;
    
    if (channel) {
      await channel.unsubscribe();
    }
    
    channel = supabase.channel(`room:${roomId}`, {
      config: {
        presence: { key: currentUser.socketId }
      }
    });
    
    // Re-setup all event handlers (same as connect)
    setupChannelHandlers(channel);
    
    await channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await channel.track(currentUser);
      }
    });
  }

  function setupChannelHandlers(ch) {
    ch.on('presence', { event: 'sync' }, () => {
      const state = ch.presenceState();
      if (onRoomUsersUpdated) {
        const users = {};
        Object.values(state).forEach(peers => {
          peers.forEach(p => {
            users[p.socketId] = p;
          });
        });
        onRoomUsersUpdated(users);
      }
    });
    
    ch.on('presence', { event: 'join' }, ({ key, newPresences }) => {
      newPresences.forEach(p => {
        if (p.socketId !== currentUser.socketId && onPeerConnected) {
          onPeerConnected(p);
        }
      });
    });
    
    ch.on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
      leftPresences.forEach(p => {
        if (onPeerDisconnected) {
          onPeerDisconnected(p.socketId);
        }
      });
    });
    
    ch.on('broadcast', { event: 'offer' }, ({ payload }) => {
      if (onOffer) onOffer(payload);
    });
    
    ch.on('broadcast', { event: 'answer' }, ({ payload }) => {
      if (onAnswer) onAnswer(payload);
    });
    
    ch.on('broadcast', { event: 'ice-candidate' }, ({ payload }) => {
      if (onIceCandidate) onIceCandidate(payload);
    });
    
    ch.on('broadcast', { event: 'screen-share-started' }, ({ payload }) => {
      if (onScreenShareStarted) onScreenShareStarted(payload);
    });
    
    ch.on('broadcast', { event: 'screen-share-stopped' }, ({ payload }) => {
      if (onScreenShareStopped) onScreenShareStopped(payload);
    });
    
    ch.on('broadcast', { event: 'speaking' }, ({ payload }) => {
      if (onSpeakingChanged) onSpeakingChanged(payload);
    });
    
    ch.on('broadcast', { event: 'mute-status' }, ({ payload }) => {
      if (onMuteStatusChanged) onMuteStatusChanged(payload);
    });
  }

  async function leaveRoom() {
    if (channel) {
      await channel.untrack();
      await channel.unsubscribe();
      channel = null;
    }
    currentRoomId = null;
  }

  // Broadcast methods (WebRTC signaling)
  async function sendOffer(targetId, offer) {
    if (channel) {
      await channel.send({
        type: 'broadcast',
        event: 'offer',
        payload: { targetId, senderId: currentUser.socketId, offer }
      });
    }
  }

  async function sendAnswer(targetId, answer) {
    if (channel) {
      await channel.send({
        type: 'broadcast',
        event: 'answer',
        payload: { targetId, senderId: currentUser.socketId, answer }
      });
    }
  }

  async function sendIceCandidate(targetId, candidate) {
    if (channel) {
      await channel.send({
        type: 'broadcast',
        event: 'ice-candidate',
        payload: { targetId, senderId: currentUser.socketId, candidate }
      });
    }
  }

  async function sendSpeaking(isSpeaking) {
    if (channel) {
      await channel.send({
        type: 'broadcast',
        event: 'speaking',
        payload: { socketId: currentUser.socketId, isSpeaking }
      });
    }
  }

  async function sendMuteStatus(muted, deafened) {
    if (channel) {
      await channel.send({
        type: 'broadcast',
        event: 'mute-status',
        payload: { socketId: currentUser.socketId, muted, deafened }
      });
    }
  }

  async function sendScreenShareStarted() {
    if (channel) {
      await channel.send({
        type: 'broadcast',
        event: 'screen-share-started',
        payload: { socketId: currentUser.socketId, username: currentUser.username }
      });
    }
  }

  async function sendScreenShareStopped() {
    if (channel) {
      await channel.send({
        type: 'broadcast',
        event: 'screen-share-stopped',
        payload: { socketId: currentUser.socketId }
      });
    }
  }

  async function sendScreenOffer(targetId, offer) {
    if (channel) {
      await channel.send({
        type: 'broadcast',
        event: 'screen-offer',
        payload: { targetId, senderId: currentUser.socketId, offer }
      });
    }
  }

  async function sendScreenAnswer(targetId, answer) {
    if (channel) {
      await channel.send({
        type: 'broadcast',
        event: 'screen-answer',
        payload: { targetId, senderId: currentUser.socketId, answer }
      });
    }
  }

  async function sendScreenIceCandidate(targetId, candidate) {
    if (channel) {
      await channel.send({
        type: 'broadcast',
        event: 'screen-ice-candidate',
        payload: { targetId, senderId: currentUser.socketId, candidate }
      });
    }
  }

  // Update presence data
  async function updatePresence(data) {
    currentUser = { ...currentUser, ...data };
    if (channel) {
      await channel.track(currentUser);
    }
  }

  // Event handlers
  function onPeerConnectedCallback(fn) { onPeerConnected = fn; }
  function onPeerDisconnectedCallback(fn) { onPeerDisconnected = fn; }
  function onOfferCallback(fn) { onOffer = fn; }
  function onAnswerCallback(fn) { onAnswer = fn; }
  function onIceCandidateCallback(fn) { onIceCandidate = fn; }
  function onScreenShareStartedCallback(fn) { onScreenShareStarted = fn; }
  function onScreenShareStoppedCallback(fn) { onScreenShareStopped = fn; }
  function onSpeakingChangedCallback(fn) { onSpeakingChanged = fn; }
  function onMuteStatusChangedCallback(fn) { onMuteStatusChanged = fn; }
  function onRoomUsersUpdatedCallback(fn) { onRoomUsersUpdated = fn; }

  function getState() {
    return {
      isConnected,
      currentRoomId,
      currentUser
    };
  }

  return {
    connect,
    joinRoom,
    leaveRoom,
    sendOffer,
    sendAnswer,
    sendIceCandidate,
    sendSpeaking,
    sendMuteStatus,
    sendScreenShareStarted,
    sendScreenShareStopped,
    sendScreenOffer,
    sendScreenAnswer,
    sendScreenIceCandidate,
    updatePresence,
    onPeerConnectedCallback,
    onPeerDisconnectedCallback,
    onOfferCallback,
    onAnswerCallback,
    onIceCandidateCallback,
    onScreenShareStartedCallback,
    onScreenShareStoppedCallback,
    onSpeakingChangedCallback,
    onMuteStatusChangedCallback,
    onRoomUsersUpdatedCallback,
    getState
  };
})();

window.RealtimeManager = RealtimeManager;

export { RealtimeManager as default };
