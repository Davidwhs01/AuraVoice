// ============================================
// Supabase Realtime Signaling Module
// ============================================

import { supabase } from './supabase.js';

const RealtimeManager = (() => {
  let currentRoomId = null;
  let currentUser = null;
  let roomChannel = null;
  let globalChannel = null;
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
  let onGlobalUsersUpdated = null;

  async function connect(userData) {
    currentUser = userData;
    
    globalChannel = supabase.channel('room-events', {
      config: { presence: { key: userData.socketId } }
    });
    
    globalChannel.on('presence', { event: 'sync' }, () => {
      const state = globalChannel.presenceState();
      if (onGlobalUsersUpdated) {
        onGlobalUsersUpdated(state);
      }
    });

    await globalChannel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        isConnected = true;
        await globalChannel.track({ ...currentUser, roomId: currentRoomId });
      }
    });
    
    return globalChannel;
  }

  async function joinRoom(roomId) {
    const previousRoom = currentRoomId;
    currentRoomId = roomId;
    
    if (roomChannel) {
      await roomChannel.untrack();
      await roomChannel.unsubscribe();
    }
    
    roomChannel = supabase.channel(`room:${roomId}`, {
      config: { presence: { key: currentUser.socketId } }
    });
    
    setupChannelHandlers(roomChannel);
    
    await roomChannel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await roomChannel.track(currentUser);
      }
    });

    if (globalChannel && isConnected) {
      await globalChannel.track({ ...currentUser, roomId: currentRoomId });
    }
  }

  function setupChannelHandlers(ch) {
    ch.on('presence', { event: 'sync' }, () => {
      const state = ch.presenceState();
      console.log('SYNC STATE:', state);
      if (onRoomUsersUpdated) {
        const users = {};
        Object.values(state).forEach(peers => {
          peers.forEach(p => {
            users[p.socketId] = p;
          });
        });
        console.log('SYNC USERS PARSED:', users);
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
    if (roomChannel) {
      await roomChannel.untrack();
      await roomChannel.unsubscribe();
      roomChannel = null;
    }
    currentRoomId = null;
    if (globalChannel && isConnected) {
      await globalChannel.track({ ...currentUser, roomId: null });
    }
  }

  // Broadcast methods (WebRTC signaling)
  async function sendOffer(targetId, offer) {
    if (roomChannel) {
      await roomChannel.send({
        type: 'broadcast',
        event: 'offer',
        payload: { targetId, senderId: currentUser.socketId, offer }
      });
    }
  }

  async function sendAnswer(targetId, answer) {
    if (roomChannel) {
      await roomChannel.send({
        type: 'broadcast',
        event: 'answer',
        payload: { targetId, senderId: currentUser.socketId, answer }
      });
    }
  }

  async function sendIceCandidate(targetId, candidate) {
    if (roomChannel) {
      await roomChannel.send({
        type: 'broadcast',
        event: 'ice-candidate',
        payload: { targetId, senderId: currentUser.socketId, candidate }
      });
    }
  }

  async function sendSpeaking(isSpeaking) {
    if (roomChannel) {
      await roomChannel.send({
        type: 'broadcast',
        event: 'speaking',
        payload: { socketId: currentUser.socketId, isSpeaking }
      });
    }
  }

  async function sendMuteStatus(isMuted, isDeafened) {
    if (roomChannel) {
      await roomChannel.send({
        type: 'broadcast',
        event: 'mute-status',
        payload: { socketId: currentUser.socketId, isMuted, isDeafened }
      });
    }
  }
  async function sendScreenShareStarted() {
    if (roomChannel) {
      await roomChannel.send({
        type: 'broadcast',
        event: 'screen-share-started',
        payload: { socketId: currentUser.socketId, username: currentUser.username }
      });
    }
  }

  async function sendScreenShareStopped() {
    if (roomChannel) {
      await roomChannel.send({
        type: 'broadcast',
        event: 'screen-share-stopped',
        payload: { socketId: currentUser.socketId }
      });
    }
  }

  async function sendScreenOffer(targetId, offer) {
    if (roomChannel) {
      await roomChannel.send({
        type: 'broadcast',
        event: 'screen-offer',
        payload: { targetId, senderId: currentUser.socketId, offer }
      });
    }
  }

  async function sendScreenAnswer(targetId, answer) {
    if (roomChannel) {
      await roomChannel.send({
        type: 'broadcast',
        event: 'screen-answer',
        payload: { targetId, senderId: currentUser.socketId, answer }
      });
    }
  }

  async function sendScreenIceCandidate(targetId, candidate) {
    if (roomChannel) {
      await roomChannel.send({
        type: 'broadcast',
        event: 'screen-ice-candidate',
        payload: { targetId, senderId: currentUser.socketId, candidate }
      });
    }
  }

  // Update presence data
  async function updatePresence(data) {
    currentUser = { ...currentUser, ...data };
    if (roomChannel) {
      await roomChannel.track(currentUser);
    }
    if (globalChannel && isConnected) {
      await globalChannel.track({ ...currentUser, roomId: currentRoomId });
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
  function onGlobalUsersUpdatedCallback(fn) { onGlobalUsersUpdated = fn; }

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
    onGlobalUsersUpdatedCallback,
    getState
  };
})();
window.RealtimeManager = RealtimeManager;

export { RealtimeManager as default };
