# AuraVoice - Agent Instructions

## Quick Start
```bash
npm run dev      # Development
npm run build    # Build for Vercel
node server.js   # Local server
```

## Architecture
- **Frontend**: Vanilla JS + Vite
- **Auth**: Supabase Auth (email/password)
- **Backend**: Supabase Realtime (WebRTC signaling)
- **Deployment**: Vercel (auto-deploy from GitHub)
- **Audio/Video**: WebRTC P2P

## Key Files
| File | Purpose |
|------|---------|
| `public/js/app.js` | Main app + auth |
| `public/js/webrtc.js` | WebRTC manager |
| `public/js/realtime.js` | Supabase Realtime |
| `public/js/supabase.js` | Supabase client + auth helpers |
| `public/css/styles.css` | Cosmic theme |
| `server.js` | Local dev server |
| `vercel.json` | Vercel SPA config |

## Environment Variables
```env
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJxxx...
```

## Common Tasks
- Add channel: Edit `SERVERS` array in `app.js`
- Quality settings: Edit `qualitySettings` in `webrtc.js`
- Theme: Edit CSS variables in `styles.css`

## Gotchas
- Must use `type="module"` on script tags
- Vercel needs `vercel.json` for SPA routing
- Supabase Auth needs "Confirm email" disabled for instant login
- Build output in `dist/` folder
