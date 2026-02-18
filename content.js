// Dopamine Detox Content Script

const BLOCKED_DOMAINS = [
  'instagram.com',
  'facebook.com',
  'youtube.com',
  'twitter.com',
  'x.com',
  'linkedin.com',
  'tiktok.com',
  'reddit.com',
];

function getSiteKey() {
  const hostname = window.location.hostname.toLowerCase();
  if (hostname.includes('instagram')) return 'instagram';
  if (hostname.includes('facebook')) return 'facebook';
  if (hostname.includes('youtube')) return 'youtube';
  if (hostname.includes('twitter') || hostname.includes('x.com')) return 'twitter';
  if (hostname.includes('linkedin')) return 'linkedin';
  if (hostname.includes('tiktok')) return 'tiktok';
  if (hostname.includes('reddit')) return 'reddit';
  return null;
}

function isBlockedDomain(hostname) {
  const cleanHostname = hostname.replace(/^www\./, '').toLowerCase();
  for (const domain of BLOCKED_DOMAINS) {
    if (cleanHostname === domain || cleanHostname.endsWith('.' + domain)) {
      return true;
    }
  }
  return false;
}

function matchesCustomSite(hostname, customSites) {
  const cleanHostname = hostname.replace(/^www\./, '').toLowerCase();
  for (const customDomain of customSites) {
    const cleanCustom = customDomain.replace(/^www\./, '').toLowerCase();
    if (cleanHostname === cleanCustom || cleanHostname.endsWith('.' + cleanCustom)) {
      return customDomain;
    }
  }
  return null;
}

// Check if current site should be blocked and monitor temp access expiry
async function checkAndMonitorTempAccess() {
  const hostname = window.location.hostname.toLowerCase();
  const cleanHostname = hostname.replace(/^www\./, '');

  try {
    // Get settings to check if this site is blocked
    const settings = await new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: 'getSettings' }, (response) => {
        resolve(response || {});
      });
    });

    if (!settings.focusMode) return;

    // Check if this is a blocked site
    const siteKey = getSiteKey();
    const isPresetBlocked = siteKey && settings.blockedSites && settings.blockedSites[siteKey];
    const customSites = settings.customSites || [];
    const isCustomBlocked = matchesCustomSite(hostname, customSites);

    if (!isPresetBlocked && !isCustomBlocked) return;

    // This is a blocked site - check temp access
    const tempAccessInfo = await new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: 'getTempAccessExpiry', hostname: cleanHostname }, (response) => {
        resolve(response || {});
      });
    });

    if (!tempAccessInfo.hasAccess) {
      // No temp access but on blocked site - redirect immediately
      redirectToBlocked();
      return;
    }

    // Has temp access - start countdown to auto-redirect
    const remainingMs = tempAccessInfo.expiryTime - Date.now();
    if (remainingMs <= 0) {
      redirectToBlocked();
      return;
    }

    // Show countdown overlay
    showCountdownOverlay(remainingMs);

    // Set timeout to redirect when temp access expires
    setTimeout(() => {
      redirectToBlocked();
    }, remainingMs);

  } catch (err) {
    console.error('Dopamine Detox: Error checking temp access', err);
  }
}

function redirectToBlocked() {
  const blockedUrl = chrome.runtime.getURL('blocked.html') + '?url=' + encodeURIComponent(window.location.href);
  window.location.href = blockedUrl;
}

function showCountdownOverlay(remainingMs) {
  // Create countdown banner at top of page
  const banner = document.createElement('div');
  banner.id = 'dopamine-detox-countdown';
  banner.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    background: linear-gradient(135deg, #e94560, #c62828);
    color: white;
    padding: 10px 20px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 14px;
    font-weight: 600;
    text-align: center;
    z-index: 2147483647;
    box-shadow: 0 2px 10px rgba(0,0,0,0.3);
  `;

  function updateBanner() {
    const remaining = Math.max(0, Math.ceil((endTime - Date.now()) / 1000));
    banner.textContent = `Temp access expires in ${remaining}s - page will auto-redirect`;
  }

  const endTime = Date.now() + remainingMs;
  updateBanner();

  // Update every second
  const interval = setInterval(() => {
    const remaining = endTime - Date.now();
    if (remaining <= 0) {
      clearInterval(interval);
      return;
    }
    updateBanner();
  }, 1000);

  document.documentElement.appendChild(banner);
}

// Listen for settings updates
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'settingsUpdated') {
    // Settings changed - recheck if we should be blocked
    checkAndMonitorTempAccess();
  }
  sendResponse({ received: true });
});

// Run on page load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', checkAndMonitorTempAccess);
} else {
  checkAndMonitorTempAccess();
}
