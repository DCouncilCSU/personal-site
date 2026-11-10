# Personal Site Scaffold (GCP / Firebase Hosting)

A low-code, zero-maintenance personal website and blog designed for showcasing audio releases, code projects (SoundCloud, GitHub, etc.), and written posts.

---

## Quick Start (Local Preview)

No `npm install` needed! Just run:

```bash
npm start
```
Then open `http://localhost:8080` in your browser.

---

## Local Admin Panel (Managing Posts)

A streamlined, zero-dependency admin GUI runs locally alongside your dev preview to create, edit, and delete entries in `public/content/posts.json`.

```bash
npm start
# Open http://localhost:8080/admin
```

### Simplicity & Workflow
- **Form-driven editing:** No manual JSON editing, comma syntax checks, or manual string escaping for quotes and multiline text.
- **Auto-generated IDs & Dates:** Automatically assigns the next sequential ID (`post-4`, etc.) and pre-fills today's date.
- **Full CRUD operations:** Create new posts, modify existing entries with single-click form population, or remove old posts directly from the browser.
- **Dynamic link management:** Add platform-specific external buttons (SoundCloud, GitHub, Live Demo, etc.) with a single click.

### Built-in Security by Design
- **Completely isolated from production:** The admin interface (`admin/index.html` and `admin/admin.css`) lives outside the deployed `public/` directory. Firebase Hosting only ever sees and uploads the contents of `public/`.
- **Zero server footprint in the cloud:** The administrative API endpoints (`POST`, `PUT`, `DELETE` at `/api/posts`) exist only in your local Node.js development server (`serve.mjs`). On the live production site, Firebase serves strictly static assets.
- **Double deployment guard:** `firebase.json` explicitly ignores `admin/**`, ensuring that even if files are accidentally placed in the deploy folder, they are never uploaded to GCP / Firebase Hosting.

---

### SoundCloud Sync
- **1-Click Sync in Admin Panel:** Click `♬ Sync SoundCloud Tracks` in the local admin panel (`/admin`) to fetch tracks published in the last 30 days from your SoundCloud profile and automatically append them to `public/content/posts.json` if not already present.
- **Local-only credentials:** Configure `SC_CLIENT_ID`, `SC_CLIENT_SECRET`, and `SC_PROFILE_URI` in `.env`. Credentials stay on your local machine and are never deployed to Firebase Hosting.

---

## How to Customize

### 1. Personal Info & Links
Open `public/content/site-config.json` to change:
- Your name / site title
- Tagline & bio
- Links in the navigation bar (SoundCloud, GitHub, Bluesky, Email, etc.)

### 2. Swapping Artwork / Assets
All images and artwork live in `public/assets/`:
- **Header Banner:** `public/assets/banner.svg` (recommended `1200x400` px)
- **Avatar / Insignia:** `public/assets/avatar.svg` (recommended `400x400` px)
- **Post Covers:** Put any `.png`, `.jpg`, or `.webp` in `public/assets/` and link to it in `posts.json`.
- See `public/assets/ASSETS_GUIDE.md` for full dimensions and tips.

### 3. Customizing Style & Colors
Open `public/css/style.css`. All colors, fonts, border widths, and shadows are exposed at the top under `:root`:
```css
:root {
  --bg-page: #f4f4f5;
  --bg-card: #ffffff;
  --border-color: #18181b;
  --border-width: 2px;
  --shadow-offset: 4px;
  ...
}
```

### 4. SoundCloud API
A builtin integration with SoundCloud can be run from the terminal:
```bash
npm run soundcloud
```
- **SoundCloud API credentials:** The `SoundCloud` key in `.env` is only used by the local Node.js server (`serve.mjs`) and is not deployed to Firebase Hosting.

---

## Deploying to Google Cloud (Firebase Hosting)

### Step 1: Install Firebase CLI
```bash
npm install -g firebase-tools
```

### Step 2: Log into your Google Cloud account
```bash
firebase login
```

### Step 3: Link your GCP Project
In `.firebaserc`, replace `"your-gcp-project-id"` with your actual Google Cloud Project ID (or run `firebase use --add`).

### Step 4: Deploy
```bash
npm run deploy
```
Your site will instantly be live at `https://<your-project-id>.web.app` and `https://<your-project-id>.firebaseapp.com`.

---

## Connecting your Squarespace Domain

1. In the [Firebase Console](https://console.firebase.google.com/), navigate to **Hosting** $\rightarrow$ click **Add custom domain**.
2. Enter your root domain (e.g. `yourdomain.com`) or subdomain.
3. Firebase will provide:
   - One `TXT` record (to verify ownership)
   - Two `A` records (IP addresses)
4. Open **Squarespace Domains** $\rightarrow$ select your domain $\rightarrow$ **DNS Settings**.
5. Add the `TXT` and `A` records provided by Firebase.
6. Firebase will automatically provision an SSL certificate (usually active within 15–30 minutes).


## Future Enhancements
1. Integrate with SoundCloud API for track listing