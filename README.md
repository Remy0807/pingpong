# pingpong

## Firebase App Hosting

This app is now set up to work with Firebase App Hosting. The React UI and the
Express API run from the same app, so App Hosting can build and serve the whole
project without a separate Cloud Run service or `firebase.json` rewrite setup.

### What App Hosting needs

- `package.json` with `build` and `start` scripts
- `apphosting.yaml` in the repo root
- a Firebase project with Firestore enabled
- optional environment values in the App Hosting backend config

### Environment values

For local development and fallback use:

- `VITE_API_BASE_URL=http://localhost:4000`
- `PORT=4000`
- `FIREBASE_SERVICE_ACCOUNT_BASE64=...` or `FIREBASE_SERVICE_ACCOUNT=...`

For Firebase App Hosting, you can usually rely on the platform credentials and
only add custom values such as `TEAMS_WEBHOOK_URL` if you use them.

The database starts empty. Add players and matches from the app UI.
