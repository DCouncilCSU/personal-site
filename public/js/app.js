// Icon library for common social/project links (clean inline SVGs, zero external dependency)
const ICONS = {
  soundcloud: `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M11.56 8.87V17h-1.2V9.6a7.2 7.2 0 0 0-1.2.14v7.26h-1.2v-7a5.5 5.5 0 0 0-1.2.4v6.6H5.56v-6.1a5 5 0 0 0-1.2.6v5.5H3.16v-4.9a6 6 0 0 0-1.2.9V17H.76v-3.7A5 5 0 0 1 3.4 9.4 6.7 6.7 0 0 1 11.56 8.87zM12.76 17h10.44a4.4 4.4 0 0 0 .8-8.72 5.6 5.6 0 0 0-5.4-4.28 5.76 5.76 0 0 0-5.84 5.8v7.2z"/></svg>`,
  github: `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/></svg>`,
  bluesky: `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 10.8c-1.087-2.114-4.046-6.053-6.798-7.995C2.566 1.023 0 2.08 0 5.438c0 1.139.315 5.86 1.26 7.64 1.282 2.414 3.737 3.013 5.49 2.502-2.73 1.01-4.72 2.652-3.328 5.753 1.884 4.2 6.772.8 8.578-4.225 1.806 5.025 6.694 8.425 8.578 4.225 1.392-3.1-0.598-4.743-3.328-5.753 1.753.511 4.208-.088 5.49-2.502.945-1.78 1.26-6.501 1.26-7.64 0-3.358-2.566-4.415-5.202-2.633C16.046 4.747 13.087 8.686 12 10.8z"/></svg>`,
  envelope: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>`,
  external: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>`
};

async function init() {
  await Promise.all([loadConfig(), loadPosts()]);
}

async function loadConfig() {
  try {
    const res = await fetch("/content/site-config.json");
    if (!res.ok) throw new Error("Could not load site-config.json");
    const config = await res.json();

    // Title & Meta
    document.title = config.siteTitle || "Personal Site";
    document.getElementById("site-title").textContent = config.siteTitle || "Personal Site";
    document.getElementById("site-tagline").textContent = config.tagline || "";
    document.getElementById("site-bio").textContent = config.bio || "";

    // Artwork
    if (config.banner) {
      document.getElementById("site-banner").src = config.banner;
    }
    if (config.avatar) {
      document.getElementById("site-avatar").src = config.avatar;
    }

    // Links Bar
    const navEl = document.getElementById("nav-links");
    navEl.innerHTML = "";
    (config.links || []).forEach(link => {
      const a = document.createElement("a");
      a.className = "nav-link";
      a.href = link.url;
      a.target = link.url.startsWith("mailto:") ? "_self" : "_blank";
      a.rel = "noopener noreferrer";

      const iconSvg = ICONS[link.icon] || ICONS.external;
      a.innerHTML = `${iconSvg} <span>${link.name}</span>`;
      navEl.appendChild(a);
    });

    // Footer
    if (config.footer) {
      document.getElementById("footer-copyright").textContent = config.footer.copyright || "";
      document.getElementById("footer-subtext").textContent = config.footer.subtext || "";
    }
  } catch (err) {
    console.error("Config error:", err);
  }
}

async function loadPosts() {
  const container = document.getElementById("posts-container");
  try {
    const res = await fetch("/content/posts.json");
    if (!res.ok) throw new Error("Could not load posts.json");
    const posts = await res.json();

    if (!posts || posts.length === 0) {
      container.innerHTML = `<p class="empty-state">No posts published yet.</p>`;
      return;
    }

    container.innerHTML = "";
    posts.forEach(post => {
      const card = document.createElement("article");
      card.className = "post-card";

      // Meta: Date and Tags
      const tagsHtml = (post.tags || [])
        .map(tag => `<span class="tag-badge">#${escapeHtml(tag)}</span>`)
        .join("");

      // Cover image if specified
      const coverHtml = post.coverImage
        ? `<img class="post-cover" src="${post.coverImage}" alt="${escapeHtml(post.title)}" loading="lazy">`
        : "";

      // Links (SoundCloud, GitHub, etc.)
      let linksHtml = "";
      if (post.links && post.links.length > 0) {
        const linkButtons = post.links.map(l => {
          const icon = ICONS[l.type] || ICONS.external;
          return `<a href="${l.url}" target="_blank" rel="noopener noreferrer" class="btn-link">${icon} ${escapeHtml(l.label)}</a>`;
        }).join("");
        linksHtml = `<div class="post-links">${linkButtons}</div>`;
      }

      card.innerHTML = `
        <div class="post-meta">
          <time class="post-date">${formatDate(post.date)}</time>
          <div class="post-tags">${tagsHtml}</div>
        </div>
        <h2 class="post-title">${escapeHtml(post.title)}</h2>
        ${coverHtml}
        <div class="post-body">${escapeHtml(post.content || post.summary || "")}</div>
        ${linksHtml}
      `;

      container.appendChild(card);
    });
  } catch (err) {
    console.error("Posts error:", err);
    container.innerHTML = `<p class="error-state">Failed to load posts feed.</p>`;
  }
}

function formatDate(dateStr) {
  if (!dateStr) return "";
  try {
    const [year, month, day] = dateStr.split("-");
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return dateStr;
  }
}

function escapeHtml(str) {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

document.addEventListener("DOMContentLoaded", init);
