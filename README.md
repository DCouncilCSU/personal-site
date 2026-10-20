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

## How to Customize

### 1. Personal Info & Links
Open `public/content/site-config.json` to change:
- Your name / site title
- Tagline & bio
- Links in the navigation bar (SoundCloud, GitHub, Bluesky, Email, etc.)

### 2. Publishing Blog Posts
Open `public/content/posts.json` and add a new item to the top of the array:
```json
{
  "id": "post-4",
  "title": "My New Track",
  "date": "2026-10-20",
  "tags": ["audio", "soundcloud"],
  "summary": "Short teaser of the post...",
  "content": "Full description or story...",
  "coverImage": "/assets/my-artwork.png",
  "links": [
    {
      "type": "soundcloud",
      "label": "Listen on SoundCloud",
      "url": "https://soundcloud.com/..."
    }
  ]
}
```

### 3. Swapping Artwork / Assets
All images and artwork live in `public/assets/`:
- **Header Banner:** `public/assets/banner.svg` (recommended `1200x400` px)
- **Avatar / Insignia:** `public/assets/avatar.svg` (recommended `400x400` px)
- **Post Covers:** Put any `.png`, `.jpg`, or `.webp` in `public/assets/` and link to it in `posts.json`.
- See `public/assets/ASSETS_GUIDE.md` for full dimensions and tips.

### 4. Customizing Style & Colors
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