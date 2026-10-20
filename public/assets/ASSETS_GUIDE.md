# Asset Replacement Guide

You can easily replace any of the artwork files in this folder with your own designs (PNG, JPG, WebP, or SVG).

### 1. Header Banner
* **Default path:** `/assets/banner.svg` (defined in `public/content/site-config.json`)
* **Recommended size:** `1200 x 400` px (or any 3:1 aspect ratio)
* **How to replace:** 
  1. Drop your image into this `public/assets/` folder (e.g. `my-banner.jpg` or `my-banner.png`).
  2. In `public/content/site-config.json`, change `"banner": "/assets/banner.svg"` to your new file name.

### 2. Avatar / Logo
* **Default path:** `/assets/avatar.svg`
* **Recommended size:** `400 x 400` px (1:1 square aspect ratio)
* **How to replace:**
  1. Drop your square image or logo into `public/assets/`.
  2. In `public/content/site-config.json`, update `"avatar": "/assets/my-avatar.png"`.

### 3. Post Cover Images / Track Artwork
* **Recommended size:** `800 x 500` px (16:10) or `600 x 600` px (square for music/albums)
* **How to use:**
  1. Drop the image into `public/assets/` (e.g. `ep-cover.jpg`).
  2. In `public/content/posts.json`, set `"coverImage": "/assets/ep-cover.jpg"` for that specific post.
  3. If a post doesn't need an image, set `"coverImage": null`.
