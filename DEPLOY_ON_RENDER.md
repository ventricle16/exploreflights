# Explore Flights — deployment on Render

Upload the **contents of this folder** to a GitHub repository so `server.js`, `index.html`, `package.json`, `app.js`, `styles.css`, and `pdf-export.js` are directly in the root of the repository.

## Render web service settings

- New > Web Service (NOT a Static Site)
- Git provider: GitHub, select the repo
- Language / Runtime: Node
- Branch: main
- Root Directory: leave BLANK (files are in the repo root)
- Build Command: `npm install`
- Start Command: `npm start`
- Environment variable (secret, add in Render Dashboard): `DUFFEL_ACCESS_TOKEN` = Duffel test or live token
- `PORT`: do not set; Render provides it automatically. Our code binds to 0.0.0.0.
- Compute: Free for private demo or choose a paid instance for production reliability

Once live, visit `https://<your-service>.onrender.com/api/config`. A true `connected` result means a token is configured; it does NOT establish it is a live token. When a test token is used, flight search results must be labelled as test data. Do not claim airline booking or a genuine PNR is present; the current app does **not** create tickets or airline reservations.

## Duffel API token

Sign up at https://app.duffel.com. Developer test mode produces `duffel_test_...` tokens and sandbox inventory. To access production airline offers, complete verification/activation to obtain a live token. Put it ONLY in Render's Environment settings; never in a source file or public GitHub repo.

## Local check (optional)

Requires Node.js 20+ on a Mac:

```sh
cd Explore_Flights_Render_Ready
npm start
```

Open http://localhost:3000 and http://localhost:3000/api/config.

## Common issues

- `Cannot find package.json`: the repo has an extra containing folder; move its contents to the repository root or set Render Root Directory to the correct folder.
- `No open ports`: app must bind to 0.0.0.0 and process.env.PORT; this package does both.
- `Connected:false` or 503: configure DUFFEL_ACCESS_TOKEN on Render and save/redeploy.
- `401` or `403`: invalid or unauthorized Duffel token; check its access mode and activation.
- Zero flight results: check route/date, sandbox airline coverage, and provider logs.
- Free Render service can sleep after 15 minutes of inactivity; open your demo link before a CEO meeting.

Sources: https://render.com/docs/deploy-node-express-app ; https://render.com/docs/configure-environment-variables ; https://duffel.com/guides/getting-started
