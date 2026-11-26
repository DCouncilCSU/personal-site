/**
 * Personal Site - Core Client Application
 *
 * Responsibilities:
 * 1. Load and render site-wide identity and configuration from /content/site-config.json.
 * 2. Setup navigation links (with email address scraping obfuscation, click-to-copy,
 *    and Web Audio tactile feedback).
 * 3. Fetch, format, and render post entries from /content/posts.json.
 * 4. Provide interactive cover image toggling (hide/show) for posts.
 */

// ============================================================================
// 1. Icons Library
// ============================================================================
// Inline SVG icons for external social and project links.
// Kept self-contained to avoid external stylesheet/font dependencies.
const ICONS = {
  soundcloud: `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M11.56 8.87V17h-1.2V9.6a7.2 7.2 0 0 0-1.2.14v7.26h-1.2v-7a5.5 5.5 0 0 0-1.2.4v6.6H5.56v-6.1a5 5 0 0 0-1.2.6v5.5H3.16v-4.9a6 6 0 0 0-1.2.9V17H.76v-3.7A5 5 0 0 1 3.4 9.4 6.7 6.7 0 0 1 11.56 8.87zM12.76 17h10.44a4.4 4.4 0 0 0 .8-8.72 5.6 5.6 0 0 0-5.4-4.28 5.76 5.76 0 0 0-5.84 5.8v7.2z"/></svg>`,
  github: `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/></svg>`,
  bluesky: `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 10.8c-1.087-2.114-4.046-6.053-6.798-7.995C2.566 1.023 0 2.08 0 5.438c0 1.139.315 5.86 1.26 7.64 1.282 2.414 3.737 3.013 5.49 2.502-2.73 1.01-4.72 2.652-3.328 5.753 1.884 4.2 6.772.8 8.578-4.225 1.806 5.025 6.694 8.425 8.578 4.225 1.392-3.1-0.598-4.743-3.328-5.753 1.753.511 4.208-.088 5.49-2.502.945-1.78 1.26-6.501 1.26-7.64 0-3.358-2.566-4.415-5.202-2.633C16.046 4.747 13.087 8.686 12 10.8z"/></svg>`,
  envelope: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>`,
  external: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>`
};

// ============================================================================
// 2. Web Audio Synthesis: Tactile Mechanical Tape Click
// ============================================================================
// Synthesizes a physical, cassette-deck-style mechanical switch sound entirely
// in software via the browser's Web Audio API. Requires zero external audio files.
let sharedAudioContext = null;

function playTapeClick() {
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;

    // Lazily instantiate and resume the AudioContext upon user gesture
    if (!sharedAudioContext) {
      sharedAudioContext = new AudioContextClass();
    }
    if (sharedAudioContext.state === "suspended") {
      sharedAudioContext.resume();
    }

    const startTime = sharedAudioContext.currentTime;

    // Element 1: Mechanical transient strike (sine oscillator dropping pitch rapidly)
    const oscillator = sharedAudioContext.createOscillator();
    const oscGain = sharedAudioContext.createGain();

    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(820, startTime);
    oscillator.frequency.exponentialRampToValueAtTime(120, startTime + 0.025);

    oscGain.gain.setValueAtTime(0.3, startTime);
    oscGain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.025);

    oscillator.connect(oscGain);
    oscGain.connect(sharedAudioContext.destination);

    oscillator.start(startTime);
    oscillator.stop(startTime + 0.025);

    // Element 2: Cassette housing click (bandpass filtered white noise burst)
    const noiseDurationSeconds = 0.035;
    const bufferSize = Math.floor(sharedAudioContext.sampleRate * noiseDurationSeconds);
    const noiseBuffer = sharedAudioContext.createBuffer(1, bufferSize, sharedAudioContext.sampleRate);
    const channelData = noiseBuffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      channelData[i] = Math.random() * 2 - 1; // Generates white noise between -1.0 and +1.0
    }

    const noiseSource = sharedAudioContext.createBufferSource();
    noiseSource.buffer = noiseBuffer;

    const bandpassFilter = sharedAudioContext.createBiquadFilter();
    bandpassFilter.type = "bandpass";
    bandpassFilter.frequency.setValueAtTime(1750, startTime);
    bandpassFilter.Q.setValueAtTime(3.5, startTime);

    const noiseGain = sharedAudioContext.createGain();
    noiseGain.gain.setValueAtTime(0.22, startTime);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, startTime + noiseDurationSeconds);

    noiseSource.connect(bandpassFilter);
    bandpassFilter.connect(noiseGain);
    noiseGain.connect(sharedAudioContext.destination);

    noiseSource.start(startTime);
    noiseSource.stop(startTime + noiseDurationSeconds);
  } catch {
    // Fail silently without breaking link functionality if Web Audio is restricted
  }
}

// ============================================================================
// 3. Application Lifecycle
// ============================================================================
async function init() {
  await Promise.all([loadConfig(), loadPosts()]);
}

// ============================================================================
// 4. Site Configuration & Navigation Rendering
// ============================================================================
async function loadConfig() {
  try {
    const response = await fetch("/content/site-config.json");
    if (!response.ok) throw new Error("Could not load site-config.json");
    const config = await response.json();

    // Populate document title, header text, and bio section
    document.title = config.siteTitle || "Personal Site";
    document.getElementById("site-title").textContent = config.siteTitle || "Personal Site";
    document.getElementById("site-tagline").textContent = config.tagline || "";
    document.getElementById("site-bio").textContent = config.bio || "";

    // Helper to pick a new random glitch animation variant (0, 1, or 2)
    // ensuring consecutive clicks switch to a different variant
    const triggerDynamicGlitch = (container, totalVariants = 3) => {
      playTapeClick();

      const lastVar = parseInt(container.dataset.glitchVariant ?? "-1", 10);
      let nextVar = Math.floor(Math.random() * totalVariants);
      if (nextVar === lastVar) {
        nextVar = (nextVar + 1) % totalVariants;
      }
      container.dataset.glitchVariant = nextVar;

      // Clean up any previously applied variant classes
      for (let i = 0; i < totalVariants; i++) {
        container.classList.remove(`glitch-var-${i}`);
      }
      container.classList.remove("is-glitching");

      // Force DOM reflow to allow immediate re-triggering of animations
      void container.offsetWidth;

      container.classList.add("is-glitching", `glitch-var-${nextVar}`);
    };

    // Populate header artwork if defined
    if (config.banner) {
      const bannerImg = document.getElementById("site-banner");
      bannerImg.src = config.banner;

      // Wire up interactive tape glitch Easter egg on the banner image
      const bannerContainer = bannerImg.closest(".banner-container") || bannerImg.parentElement;
      if (bannerContainer) {
        bannerContainer.setAttribute("role", "button");
        bannerContainer.setAttribute("tabindex", "0");
        bannerContainer.title = "Click to test";

        bannerContainer.addEventListener("click", () => triggerDynamicGlitch(bannerContainer));
        bannerContainer.addEventListener("keydown", (e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            triggerDynamicGlitch(bannerContainer);
          }
        });

        bannerContainer.addEventListener("animationend", () => {
          bannerContainer.classList.remove("is-glitching");
        });
      }
    }
    if (config.avatar) {
      const avatarImg = document.getElementById("site-avatar");
      avatarImg.src = config.avatar;

      // Wire up interactive tape glitch Easter egg on the avatar
      const avatarContainer = avatarImg.closest(".avatar-container") || avatarImg.parentElement;
      if (avatarContainer) {
        avatarContainer.setAttribute("role", "button");
        avatarContainer.setAttribute("tabindex", "0");
        avatarContainer.title = "Click to test";

        avatarContainer.addEventListener("click", () => triggerDynamicGlitch(avatarContainer));
        avatarContainer.addEventListener("keydown", (e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            triggerDynamicGlitch(avatarContainer);
          }
        });

        avatarContainer.addEventListener("animationend", () => {
          avatarContainer.classList.remove("is-glitching");
        });
      }
    }

    // Populate navigation links bar
    const navContainer = document.getElementById("nav-links");
    navContainer.innerHTML = "";

    (config.links || []).forEach(link => {
      const linkElement = document.createElement("a");
      linkElement.className = "nav-link";
      const iconSvg = ICONS[link.icon] || ICONS.external;
      linkElement.innerHTML = `${iconSvg} <span>${link.name}</span>`;

      if (link.url && link.url.startsWith("mailto:")) {
        // Obfuscate personal email against simple web scrapers:
        // Instead of writing a literal mailto: link into the DOM, encode the address
        // into a data attribute and wire up a one-click clipboard copy with audio feedback.
        const rawEmail = link.url.slice("mailto:".length);
        linkElement.dataset.contact = btoa(rawEmail);
        linkElement.href = "#";
        linkElement.setAttribute("role", "button");
        linkElement.title = "Click to copy email address";

        let copyResetTimer = null;
        const defaultLabel = link.name;

        linkElement.addEventListener("click", async (event) => {
          event.preventDefault();
          playTapeClick();

          if (!linkElement.dataset.contact) return;
          const decodedEmail = atob(linkElement.dataset.contact);
          const labelSpan = linkElement.querySelector("span");

          // Clear any active reset timeout if the user clicks repeatedly
          if (copyResetTimer) {
            clearTimeout(copyResetTimer);
          }

          try {
            await navigator.clipboard.writeText(decodedEmail);
            if (labelSpan) labelSpan.textContent = "Copied!";
          } catch {
            // Fallback for browsers or contexts blocking clipboard permissions
            window.prompt("Copy email address:", decodedEmail);
          }

          // Always reset back to the canonical link name (e.g. "Email") after 2 seconds
          copyResetTimer = setTimeout(() => {
            if (labelSpan) labelSpan.textContent = defaultLabel;
            copyResetTimer = null;
          }, 2000);
        });
      } else {
        // Standard external or internal navigational link
        const isInternalRoute = link.url && (link.url.startsWith("/") || link.url.startsWith("#"));
        linkElement.href = link.url;
        linkElement.target = isInternalRoute ? "_self" : "_blank";
        linkElement.rel = "noopener noreferrer";
      }

      navContainer.appendChild(linkElement);
    });

    // Populate footer copyright & subtext
    if (config.footer) {
      document.getElementById("footer-copyright").textContent = config.footer.copyright || "";
      document.getElementById("footer-subtext").textContent = config.footer.subtext || "";
    }
  } catch (err) {
    console.error("Config error:", err);
  }
}

// ============================================================================
// 5. Posts Feed Rendering
// ============================================================================
async function loadPosts() {
  const postsContainer = document.getElementById("posts-container");
  try {
    const response = await fetch("/content/posts.json");
    if (!response.ok) throw new Error("Could not load posts.json");
    const posts = await response.json();

    if (!posts || posts.length === 0) {
      postsContainer.innerHTML = `<p class="empty-state">No posts published yet.</p>`;
      return;
    }

    postsContainer.innerHTML = "";

    posts.forEach(post => {
      const card = document.createElement("article");
      card.className = "post-card";

      // Render tags as badges (#tag)
      const tagsHtml = (post.tags || [])
        .map(tag => `<span class="tag-badge">#${escapeHtml(tag)}</span>`)
        .join("");

      // If a post only has a single external link, make the post's title
      // and body text directly clickable as a primary navigation link.
      const hasSingleLink = post.links && post.links.length === 1;
      const primaryUrl = hasSingleLink ? post.links[0].url : null;
      const primaryLinkOpen = primaryUrl ? `<a href="${primaryUrl}" target="_blank" rel="noopener noreferrer" class="post-primary-link">` : "";
      const primaryLinkClose = primaryUrl ? `</a>` : "";

      // Cover image with interactive hover-to-hide button
      const coverHtml = post.coverImage
        ? `<div class="post-cover-wrapper">
             <button type="button" class="cover-toggle-btn" aria-label="Hide cover image">Hide Image</button>
             <div class="cover-image-container">
               <img class="post-cover" src="${post.coverImage}" alt="${escapeHtml(post.title)}" loading="lazy">
             </div>
           </div>`
        : "";

      // Post external action links (SoundCloud, GitHub, Demo, etc.)
      let linksHtml = "";
      if (post.links && post.links.length > 0) {
        const linkButtons = post.links.map(link => {
          const icon = ICONS[link.type] || ICONS.external;
          return `<a href="${link.url}" target="_blank" rel="noopener noreferrer" class="btn-link">${icon} ${escapeHtml(link.label)}</a>`;
        }).join("");
        linksHtml = `<div class="post-links">${linkButtons}</div>`;
      }

      card.innerHTML = `
        <div class="post-meta">
          <time class="post-date">${formatDate(post.date)}</time>
          <div class="post-tags">${tagsHtml}</div>
        </div>
        <h2 class="post-title">${primaryLinkOpen}${escapeHtml(post.title)}${primaryLinkClose}</h2>
        ${coverHtml}
        <div class="post-body">${primaryLinkOpen}${escapeHtml(post.content || "")}${primaryLinkClose}</div>
        ${linksHtml}
      `;

      postsContainer.appendChild(card);
    });

    // Wire up the cover image hide/show interactive toggles
    postsContainer.querySelectorAll(".post-cover-wrapper").forEach(wrapper => {
      const toggleButton = wrapper.querySelector(".cover-toggle-btn");
      if (!toggleButton) return;

      toggleButton.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        const isHidden = wrapper.classList.toggle("is-hidden");
        toggleButton.textContent = isHidden ? "Show Image" : "Hide Image";
        toggleButton.setAttribute("aria-label", isHidden ? "Show cover image" : "Hide cover image");
      });
    });
  } catch (err) {
    console.error("Posts error:", err);
    postsContainer.innerHTML = `<p class="error-state">Failed to load posts feed.</p>`;
  }
}

// ============================================================================
// 6. Formatting & Security Helpers
// ============================================================================

/**
 * Converts a YYYY-MM-DD date string into a localized human-readable string (e.g. "Nov 8, 2026").
 * Falls back to the raw string if parsing fails.
 */
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

/**
 * Escapes unsafe HTML characters to prevent XSS injection from user-provided content.
 */
function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Initialize on DOM ready
document.addEventListener("DOMContentLoaded", init);
