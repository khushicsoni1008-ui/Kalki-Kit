# Kalki-Kit

Kalki-Kit is an educational misinformation-awareness and claim-verification project. It provides a browser-based dashboard for checking text claims, article links and images against gathered evidence, with Gemini used by the server-side verification pipeline.

> **Important:** Verification output is an aid to critical thinking, not a substitute for independent research or professional fact-checking. Users should review the cited evidence and its context.

## Features

- Text-claim verification using gathered news, fact-checking and reference sources.
- Article-link checking with public-address validation before fetching.
- Image inspection for visible signs of AI generation or editing.
- Firebase Authentication and temporary guest sessions.
- A dashboard for viewing saved checks and recent fact-checking items.
- Firestore-backed, account-private history for signed-in users; guest history remains local.

## Technology stack

- Frontend: HTML, CSS, Bootstrap and browser JavaScript.
- Backend: Node.js 20+ and Express.
- AI integration: Google Gemini API, called from the backend.
- Authentication: Firebase Authentication.
- Cloud history: Firebase Cloud Firestore for signed-in users; browser localStorage is the offline cache and guest-history store.

## Project structure

```text
Kalki-Kit/
├── assets/                 # Logo, favicon and architecture image
├── css/                    # Application styles
├── js/                     # Frontend modules and authentication
├── scratch/                # Manual verification experiments
├── index.html              # Main dashboard
├── login.html              # Login and sign-up page
├── server.js               # Express server and API routes
├── free_verifier.js        # Evidence gathering and Gemini judgement
├── image_verifier.js       # Image inspection
├── link_checker.js         # Safe article fetching and extraction
├── package.json
└── .env.example            # Environment-variable template
```

## Requirements

- Node.js 20 or newer
- npm
- A Google Gemini API key for AI-powered verification
- A Firebase project with Email/Password Authentication enabled

## Run locally (Windows PowerShell)

1. Clone the repository and open its folder:

   ```powershell
   git clone https://github.com/khushicsoni1008-ui/Kalki-Kit.git
   cd Kalki-Kit
   ```

2. Install dependencies:

   ```powershell
   npm ci
   ```

3. Create your local environment file:

   ```powershell
   Copy-Item .env.example .env
   ```

4. Open `.env` and replace the placeholder with your Gemini API key:

   ```env
   GEMINI_API_KEY=your_real_key_here
   GEMINI_MODEL=gemini-3.6-flash
   PORT=3000
   ```

   Never commit `.env` or put the Gemini key in frontend JavaScript.

5. Start the server:

   ```powershell
   npm start
   ```

6. Open [http://localhost:3000](http://localhost:3000).

7. Run the automated smoke tests in a second terminal:

   ```powershell
   npm test
   ```

   Run the live Gemini/evidence integration suite separately (requires a valid `GEMINI_API_KEY` in `.env`):

   ```powershell
   npm run test:integration
   ```

The integration suite uses `GEMINI_MODEL` (default: `gemini-3.6-flash`) and checks eight representative claims. It uses live external sources and Gemini, so results can vary as sources and model availability change.

The server exposes a public health endpoint at `/api/health`. It reports whether a Gemini key is configured; it does not expose the key.

## Deploy on Render

This project serves its frontend and API from the same Express application, so deploy it as **one Node Web Service**, not as a static site.

1. Push the project to GitHub.
2. In Render, create a new **Web Service** and connect the `khushicsoni1008-ui/Kalki-Kit` repository.
3. Select the `main` branch after the deployment-preparation changes have been merged.
4. Set:
   - Runtime: Node
   - Build command: `npm ci`
   - Start command: `npm start`
   - Health check path: `/api/health`
5. Add environment variables in the Render service settings:
   - `GEMINI_API_KEY`: your private Gemini API key
   - `GEMINI_MODEL`: `gemini-3.6-flash` (or another stable model confirmed available to your Google AI project)
   - `NODE_ENV`: `production`
   - `TRUST_PROXY`: `true` (for Render's reverse-proxy deployment)
6. Deploy and open the Render-provided HTTPS URL.
7. In Firebase Console, add the deployed hostname under Authentication → Settings → Authorized domains. Confirm Email/Password sign-in is enabled.
8. In Firebase Console, create a Cloud Firestore database in the same `kalki-kit` Firebase project.
9. Publish the rules from `firestore.rules` in Firestore → Rules. These rules restrict every user's checks to their own Firebase UID.
10. Test sign-up, login, guest access, text verification, link checking, image checking, history save/load/delete, and the latest fact-check feed.

Render supplies the `PORT` environment variable. Do not hard-code a production port.

## Firebase Cloud Firestore setup

The dashboard loads the Firebase 8.10.1 Firestore browser SDK and stores signed-in users' checks at `users/{uid}/checks/{checkId}`. Firestore is optional at runtime: if it is not configured or temporarily unavailable, the app keeps the check in that account's local browser cache and reports that cloud sync is unavailable.

Before enabling cloud history in production:

1. Open the existing Firebase project (`kalki-kit`) and create a Cloud Firestore database.
2. Open Firestore → Rules, replace the rules with the contents of `firestore.rules`, and publish them.
3. Keep Firebase Authentication Email/Password enabled and ensure the Render hostname is an authorized domain.
4. Sign in with a normal Firebase account and test saving, refreshing, deleting, and clearing checks. Guest sessions intentionally do not use Firestore.

Only the authenticated user's UID-scoped collection is accessible to that user. Image thumbnails and uploaded image bytes are excluded from cloud history. Do not loosen the rules to public read/write access.

## Current MVP limitations

- Signed-in users' history is synced to Firestore. Guest history remains in the current browser and is not synced across devices.
- Existing history from the old shared browser key is offered for one-time, explicit import at sign-in because it may contain guest or another account's checks.
- Guest-session tokens and in-memory caches are held by the server process. They are cleared when the process restarts and are not shared across multiple instances.
- Guest-session tokens, rate limits and verification caches remain in memory on the server; a shared session/cache store is still needed before scaling the backend to multiple instances.
- Rate limits are currently in-memory and are not a complete abuse-prevention system for a large public service.

## Security notes

- Keep real API secrets in local `.env` files or the hosting provider's secret environment settings.
- Keep `.env` out of Git.
- Restrict the Firebase web API key in Google Cloud to the APIs this Firebase application needs, and configure Firebase authorized domains.
- Monitor Gemini usage and configure quota/billing limits in Google AI Studio / Google Cloud as appropriate.
- Do not treat an AI verdict or a source score as proof by itself; inspect the evidence and source links.

## License

MIT
