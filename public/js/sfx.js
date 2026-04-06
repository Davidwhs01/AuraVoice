// Synthesizer for Discord-like SFX using Web Audio API
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function playTone(freq, type, duration, vol, delay = 0) {
  const oscillator = audioCtx.createOscillator();
  const gainNode = audioCtx.createGain();

  oscillator.type = type;
  oscillator.frequency.setValueAtTime(freq, audioCtx.currentTime + delay);

  gainNode.gain.setValueAtTime(0, audioCtx.currentTime + delay);
  gainNode.gain.linearRampToValueAtTime(vol, audioCtx.currentTime + delay + 0.05);
  gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + delay + duration);

  oscillator.connect(gainNode);
  gainNode.connect(audioCtx.destination);

  oscillator.start(audioCtx.currentTime + delay);
  oscillator.stop(audioCtx.currentTime + delay + duration);
}

export const SFX = {
  join: () => {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    playTone(440, 'sine', 0.15, 0.1, 0);      // A4
    playTone(659.25, 'sine', 0.3, 0.1, 0.1);  // E5
  },
  leave: () => {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    playTone(659.25, 'sine', 0.15, 0.1, 0);   // E5
    playTone(440, 'sine', 0.3, 0.1, 0.1);     // A4
  },
  mute: () => {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    playTone(300, 'square', 0.1, 0.05, 0);
    playTone(200, 'square', 0.15, 0.05, 0.08);
  },
  unmute: () => {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    playTone(200, 'square', 0.1, 0.05, 0);
    playTone(300, 'square', 0.15, 0.05, 0.08);
  }
};
