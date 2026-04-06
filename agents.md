# AuraVoice - Agent Instructions

## 🚀 Quick Start

```bash
# Development
npm run dev

# Build (for Vercel)
npm run build
```

## 🏗️ Architecture

- **Frontend**: Vanilla JS + Vite (no framework)
- **Backend**: Supabase Realtime (WebRTC signaling) - no custom server
- **Deployment**: Vercel (SPA mode)
- **Audio/Video**: WebRTC P2P (no media server)

## 📁 Key Files

| File | Purpose |
|------|---------|
| `public/js/app.js` | Main app controller |
| `public/js/webrtc.js` | WebRTC manager (audio/video) |
| `public/js/realtime.js` | Supabase Realtime signaling |
| `public/js/supabase.js` | Supabase client |
| `public/css/styles.css` | Cosmic theme |
| `supabase-schema.sql` | Database schema |

## ⚙️ Environment Variables

Create `.env`:
```
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJxxx...
```

## 🎯 Future Plans (Bots System)

### Bot Architecture
- Bots as "virtual clients" connecting via Supabase Realtime
- P2P Mesh: each bot opens RTCPeerConnection with each user
- Uses `node-webrtc` for server-side WebRTC

### Planned Bot Types

1. **Music Bot** - Stream audio from YouTube/Spotify
   - `ffmpeg` for audio capture
   - Commands: `!play`, `!skip`, `!stop`, `!volume`

2. **AI Assistant** - Conversational bot with STT/TTS
   - STT: Whisper or AssemblyAI
   - LLM: OpenAI GPT or Gemini
   - TTS: ElevenLabs or OpenAI TTS

3. **Moderation Bot** - Room management
   - Focuses on Supabase Realtime events only
   - No WebRTC needed (lower load)

### Bot Framework API
```javascript
import { AuraVoiceBot } from './bot-framework';

const bot = new AuraVoiceBot({
  username: 'Aura DJ',
  avatarColor: '#a855f7'
});

bot.on('ready', () => bot.joinChannel('server:channel'));
bot.on('message', (msg, peerId) => { /* ... */ });
```

## 🔧 Common Tasks

- **Add quality preset**: Edit `qualitySettings` in `webrtc.js`
- **Modify theme**: Edit CSS variables in `styles.css`
- **Add server/channel**: Edit `SERVERS` array in `app.js`

## ⚠️ Gotchas

- Supabase Realtime replaces Socket.io - no server.js needed
- `type="module"` required in HTML script tags
- Vercel requires `vercel.json` rewrites for SPA
