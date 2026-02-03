// MuscleTick Content Script
// Hides distracting elements on social media sites

const HIDE_SELECTORS = {
  instagram: {
    feed: 'main[role="main"] article',
    stories: 'header section ul',
    explore: 'a[href="/explore/"]',
    reels: 'a[href="/reels/"]',
    suggestions: 'aside',
    sidebar: 'aside[aria-label]',
  },
  facebook: {
    feed: 'div[role="feed"]',
    stories: 'div[aria-label="Stories"]',
    reels: 'div[aria-label="Reels"]',
    watch: 'a[href="/watch/"]',
    gaming: 'a[href="/gaming/"]',
    marketplace: 'a[href="/marketplace/"]',
    sidebar: 'div[data-pagelet="RightRail"]',
    sponsored: 'span:contains("Sponsored")',
  },
  youtube: {
    shorts: 'ytd-rich-section-renderer, ytd-reel-shelf-renderer, a[title="Shorts"]',
    recommendations: 'ytd-watch-next-secondary-results-renderer',
    homepage: 'ytd-rich-grid-renderer',
    comments: 'ytd-comments',
    endscreen: 'div.ytp-endscreen-content',
    sidebar: '#secondary',
    trending: 'a[title="Trending"]',
  },
  twitter: {
    feed: 'div[data-testid="primaryColumn"] section',
    trends: 'div[data-testid="sidebarColumn"] section',
    explore: 'a[href="/explore"]',
    forYou: 'div[role="tablist"]',
    whoToFollow: 'aside[aria-label="Who to follow"]',
  },
  linkedin: {
    feed: 'main.scaffold-layout__main',
    news: 'aside.scaffold-layout__aside',
    notifications: 'a[href*="/notifications/"]',
    recommendations: 'div.feed-shared-update-v2',
    ads: 'span:contains("Promoted")',
  },
  tiktok: {
    feed: 'div[data-e2e="recommend-list-item-container"]',
    forYou: 'div[data-e2e="foryou-item"]',
    following: 'a[data-e2e="nav-following"]',
    sidebar: 'aside',
  },
  reddit: {
    feed: 'div[data-testid="posts-list"], .rpBJOHq2PR60pnwJlUyP0, shreddit-feed',
    popular: 'a[href="/r/popular/"]',
    all: 'a[href="/r/all/"]',
    trending: 'div[data-redditstyle="trending"]',
    sidebar: 'aside',
    comments: 'div[data-test-id="comments-page"]',
  },
  snapchat: {
    stories: 'div[data-testid="stories"]',
    discover: 'div[data-testid="discover"]',
    spotlight: 'a[href*="spotlight"]',
  },
};

function getSiteKey() {
  const hostname = window.location.hostname.toLowerCase();
  if (hostname.includes('instagram')) return 'instagram';
  if (hostname.includes('facebook')) return 'facebook';
  if (hostname.includes('youtube')) return 'youtube';
  if (hostname.includes('twitter') || hostname.includes('x.com')) return 'twitter';
  if (hostname.includes('linkedin')) return 'linkedin';
  if (hostname.includes('tiktok')) return 'tiktok';
  if (hostname.includes('reddit')) return 'reddit';
  if (hostname.includes('snapchat')) return 'snapchat';
  return null;
}

let hideStyleElement = null;

function injectHideStyles(siteKey) {
  if (!siteKey || !HIDE_SELECTORS[siteKey]) return;

  const selectors = Object.values(HIDE_SELECTORS[siteKey]);
  const css = selectors.map(s => `${s} { display: none !important; visibility: hidden !important; }`).join('\n');

  if (hideStyleElement) {
    hideStyleElement.textContent = css;
  } else {
    hideStyleElement = document.createElement('style');
    hideStyleElement.id = 'muscletick-hide-styles';
    hideStyleElement.textContent = css;
    (document.head || document.documentElement).appendChild(hideStyleElement);
  }
}

function removeHideStyles() {
  if (hideStyleElement) {
    hideStyleElement.remove();
    hideStyleElement = null;
  }
}

function showBlockOverlay() {
  // Check if overlay already exists
  if (document.getElementById('muscletick-block-overlay')) return;

  const overlay = document.createElement('div');
  overlay.id = 'muscletick-block-overlay';
  overlay.innerHTML = `
    <div style="
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(13, 13, 13, 0.98);
      z-index: 2147483647;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-direction: column;
      font-family: 'Inter', -apple-system, sans-serif;
      color: white;
    ">
      <div style="font-size: 64px; margin-bottom: 16px;">\uD83D\uDEAB</div>
      <h1 style="font-size: 28px; font-weight: 900; margin: 0;">blocked by MuscleTick</h1>
      <p style="color: #9e9e9e; margin-top: 8px;">redirecting to workout challenge...</p>
    </div>
  `;
  document.body.appendChild(overlay);

  // Redirect to blocked page
  setTimeout(() => {
    const blockedUrl = chrome.runtime.getURL('blocked.html') + '?url=' + encodeURIComponent(window.location.href);
    window.location.href = blockedUrl;
  }, 500);
}

function removeBlockOverlay() {
  const overlay = document.getElementById('muscletick-block-overlay');
  if (overlay) overlay.remove();
}

async function checkAndApply() {
  const siteKey = getSiteKey();
  if (!siteKey) return;

  try {
    const result = await chrome.storage.sync.get(['settings', 'temporaryAccess']);
    const settings = result.settings || { focusMode: true, blockedSites: {}, hiddenElements: {} };
    const tempAccess = result.temporaryAccess || {};

    // Check temporary access
    const now = Date.now();
    const hostname = window.location.hostname;
    const accessExpiry = tempAccess[hostname];

    if (accessExpiry && now < accessExpiry) {
      // Temporary access granted, don't block
      removeBlockOverlay();

      // But still apply hide mode if enabled
      if (settings.focusMode && settings.hiddenElements && settings.hiddenElements[siteKey]) {
        injectHideStyles(siteKey);
      } else {
        removeHideStyles();
      }
      return;
    }

    // Check if site is blocked
    if (settings.focusMode && settings.blockedSites && settings.blockedSites[siteKey]) {
      showBlockOverlay();
      return;
    }

    removeBlockOverlay();

    // Check if hide mode is on
    if (settings.focusMode && settings.hiddenElements && settings.hiddenElements[siteKey]) {
      injectHideStyles(siteKey);
    } else {
      removeHideStyles();
    }
  } catch (err) {
    console.error('MuscleTick error:', err);
  }
}

// Listen for settings updates
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'settingsUpdated' || message.type === 'checkBlock') {
    checkAndApply();
  }
  sendResponse({ received: true });
});

// Initial check
checkAndApply();

// Re-check on navigation (for SPAs)
let lastUrl = location.href;
new MutationObserver(() => {
  if (location.href !== lastUrl) {
    lastUrl = location.href;
    checkAndApply();
  }
}).observe(document, { subtree: true, childList: true });

// Also check periodically for dynamic content
setInterval(checkAndApply, 5000);
