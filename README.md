# Click2Bill (Digital invoicing)

React + Vite SPA with Firebase (Auth, Firestore, Storage) and optional email via a Cloudflare Worker.

## Development

```bash
npm install
npm run dev
```

Copy `.env.example` to `.env` and set `VITE_*` Firebase variables.

## Production build

```bash
npm run build
```

Output: `dist/`.

## Deploy

- **Cloudflare Worker + static assets:** see `DEPLOY-CLOUDFLARE.md`.
- **Email (Resend):** see `EMAIL_SETUP.md`.
- **Firebase rules only:**

  ```bash
  npm run firebase:deploy:rules
  ```

  Or paste `firestore.rules` / `storage.rules` in the Firebase Console.

## Project layout

| Path | Purpose |
|------|--------|
| `src/` | Application source |
| `public/` | Static assets |
| `worker.js` | Cloudflare Worker (`/api/send-email`, serves `dist`) |
| `wrangler.toml` | Worker configuration |
| `firestore.rules` / `storage.rules` | Security rules |
| `dev.vars.example` | Local Wrangler secrets template |
