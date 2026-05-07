# pingpong

## Firebase App Hosting

This app is now set up to work with Firebase App Hosting. The React UI and the
Express API run from the same app, so App Hosting can build and serve the whole
project without a separate Cloud Run service or `firebase.json` rewrite setup.

### What App Hosting needs

- `package.json` with `build` and `start` scripts
- `apphosting.yaml` in the repo root
- a Firebase project with Firestore enabled
- Firebase Authentication enabled with the Email/Password provider
- one client config variable, usually `VITE_FIREBASE_WEBAPP_CONFIG`

### Environment values

For local development and fallback use:

- `VITE_API_BASE_URL=http://localhost:4000`
- `PORT=4000`
- `VITE_FIREBASE_WEBAPP_CONFIG={"apiKey":"...","authDomain":"...","projectId":"...","appId":"..."}`
- `FIREBASE_SERVICE_ACCOUNT_BASE64=...` or `FIREBASE_SERVICE_ACCOUNT=...`

For Firebase App Hosting, you can usually rely on the platform credentials for
the server side. In practice, the only client value you normally set is
`VITE_FIREBASE_WEBAPP_CONFIG`, plus anything extra like `TEAMS_WEBHOOK_URL` if
you use it.

The database starts empty. Add players and matches from the app UI.
