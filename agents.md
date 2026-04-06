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
- **Servers**: User-created, invite-only (Discord-style)

## Key Files
| File | Purpose |
|------|---------|
| `public/js/app.js` | Main app + auth + server management |
| `public/js/servers.js` | Server CRUD, invites, members |
| `public/js/webrtc.js` | WebRTC manager |
| `public/js/realtime.js` | Supabase Realtime signaling |
| `public/js/supabase.js` | Supabase client + auth helpers |
| `public/js/profile.js` | Profile & settings manager |
| `public/js/ui.js` | UI rendering helpers |
| `public/css/styles.css` | Cosmic theme |
| `supabase-schema.sql` | Database schema + RLS policies |
| `server.js` | Local dev server |
| `vercel.json` | Vercel SPA config |

## Environment Variables
```env
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJxxx...
```

## Server System (Discord-style)
- Users create servers (no pre-built servers)
- Each server auto-creates default channels: `geral` (text) + `Voz Geral` (voice)
- Owner invites friends via unique invite links (`?invite=CODE`)
- Roles: `owner`, `admin`, `member`
- Right-click server icon for context menu (invite, settings, delete/leave)

## Common Tasks
- Quality settings: Edit `qualitySettings` in `webrtc.js`
- Theme: Edit CSS variables in `styles.css`
- Add DB tables: Update `supabase-schema.sql` + run in Supabase SQL editor

## Gotchas
- Must use `type="module"` on script tags
- Vercel needs `vercel.json` for SPA routing
- Supabase Auth needs "Confirm email" disabled for instant login
- Build output in `dist/` folder
- After schema changes, run SQL in Supabase dashboard
- `servers.js` module handles all server/invite/member operations
