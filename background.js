// Muscle Memory - Background Service Worker

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

const DOMAIN_TO_KEY = {
  'instagram.com': 'instagram',
  'www.instagram.com': 'instagram',
  'facebook.com': 'facebook',
  'www.facebook.com': 'facebook',
  'youtube.com': 'youtube',
  'www.youtube.com': 'youtube',
  'm.youtube.com': 'youtube',
  'twitter.com': 'twitter',
  'www.twitter.com': 'twitter',
  'x.com': 'twitter',
  'www.x.com': 'twitter',
  'linkedin.com': 'linkedin',
  'www.linkedin.com': 'linkedin',
  'tiktok.com': 'tiktok',
  'www.tiktok.com': 'tiktok',
  'reddit.com': 'reddit',
  'www.reddit.com': 'reddit',
  'old.reddit.com': 'reddit',
  'new.reddit.com': 'reddit',
};

const DEFAULT_SETTINGS = {
  focusMode: true,
  blockedSites: {
    instagram: true,
    facebook: true,
    youtube: false,
    twitter: false,
    linkedin: false,
    tiktok: false,
    reddit: false,
  },
  hiddenElements: {
    instagram: false,
    facebook: false,
    youtube: false,
    twitter: false,
    linkedin: false,
    tiktok: false,
    reddit: false,
  },
  customSites: [], // Array of custom blocked domains
};

// Initialize settings if not exists
chrome.runtime.onInstalled.addListener(async () => {
  const result = await chrome.storage.sync.get(['settings']);
  if (!result.settings) {
    await chrome.storage.sync.set({ settings: DEFAULT_SETTINGS });
  }

  // Initialize stats
  const statsResult = await chrome.storage.sync.get(['stats']);
  if (!statsResult.stats) {
    await chrome.storage.sync.set({
      stats: {
        totalBlockedAttempts: 0,
        exercisesDone: 0,
        streak: 0,
        dailyBlocks: {},
        timeSaved: 0,
        lastActiveDate: null,
      },
    });
  }
});

// Check if hostname matches a custom site
function matchesCustomSite(hostname, customSites) {
  const cleanHostname = hostname.replace(/^www\./, '');
  for (const customDomain of customSites) {
    const cleanCustom = customDomain.replace(/^www\./, '');
    if (cleanHostname === cleanCustom || cleanHostname.endsWith('.' + cleanCustom)) {
      return customDomain;
    }
  }
  return null;
}

// Handle navigation to blocked sites
chrome.webNavigation.onBeforeNavigate.addListener(async (details) => {
  // Only handle main frame navigation
  if (details.frameId !== 0) return;

  try {
    const url = new URL(details.url);
    const hostname = url.hostname.toLowerCase();

    const result = await chrome.storage.sync.get(['settings', 'temporaryAccess']);
    const settings = result.settings || DEFAULT_SETTINGS;
    const tempAccess = result.temporaryAccess || {};

    // Check if focus mode is on
    if (!settings.focusMode) return;

    // Check temporary access first
    const now = Date.now();
    for (const domain of Object.keys(tempAccess)) {
      if (hostname.includes(domain) || domain.includes(hostname.replace(/^www\./, ''))) {
        if (tempAccess[domain] > now) {
          return; // Access granted
        }
      }
    }

    // Check preset blocked sites
    let siteKey = DOMAIN_TO_KEY[hostname];
    if (!siteKey) {
      // Check partial matches
      for (const domain of BLOCKED_DOMAINS) {
        if (hostname.includes(domain)) {
          siteKey = DOMAIN_TO_KEY[domain] || DOMAIN_TO_KEY['www.' + domain];
          break;
        }
      }
    }

    let shouldBlock = false;

    if (siteKey && settings.blockedSites && settings.blockedSites[siteKey]) {
      shouldBlock = true;
    }

    // Check custom sites
    const customSites = settings.customSites || [];
    const matchedCustomSite = matchesCustomSite(hostname, customSites);
    if (matchedCustomSite) {
      shouldBlock = true;
    }

    if (!shouldBlock) return;

    // Redirect to blocked page
    const blockedUrl = chrome.runtime.getURL('blocked.html') + '?url=' + encodeURIComponent(details.url);
    chrome.tabs.update(details.tabId, { url: blockedUrl });
  } catch (err) {
    console.error('Muscle Memory navigation error:', err);
  }
});

// Handle messages from popup and content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'settingsUpdated') {
    // Notify all tabs to re-check
    chrome.tabs.query({}, (tabs) => {
      tabs.forEach((tab) => {
        if (tab.id) {
          chrome.tabs.sendMessage(tab.id, { type: 'settingsUpdated', settings: message.settings }).catch(() => {});
        }
      });
    });
    sendResponse({ success: true });
  }

  if (message.type === 'grantTemporaryAccess') {
    // Grant 60 SECONDS access to the site
    const url = message.url;
    try {
      const hostname = new URL(url).hostname.replace(/^www\./, '');
      const expiryTime = Date.now() + 60 * 1000; // 60 seconds

      chrome.storage.sync.get(['temporaryAccess'], (result) => {
        const tempAccess = result.temporaryAccess || {};
        tempAccess[hostname] = expiryTime;
        chrome.storage.sync.set({ temporaryAccess }, () => {
          sendResponse({ success: true, expiryTime });
        });
      });
    } catch (err) {
      sendResponse({ success: false, error: err.message });
    }
    return true; // Keep channel open for async response
  }

  if (message.type === 'getStats') {
    chrome.storage.sync.get(['stats'], (result) => {
      sendResponse(result.stats || {});
    });
    return true;
  }

  if (message.type === 'getSettings') {
    chrome.storage.sync.get(['settings'], (result) => {
      sendResponse(result.settings || DEFAULT_SETTINGS);
    });
    return true;
  }

  if (message.type === 'checkPremium') {
    chrome.storage.sync.get(['premium'], (result) => {
      sendResponse({ premium: result.premium === true });
    });
    return true;
  }

  if (message.type === 'upgradeToPremium') {
    chrome.storage.sync.set({ premium: true }, () => {
      sendResponse({ success: true });
    });
    return true;
  }

  return false;
});

// Clean up expired temporary access entries periodically
chrome.alarms.create('cleanupTempAccess', { periodInMinutes: 1 });

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'cleanupTempAccess') {
    chrome.storage.sync.get(['temporaryAccess'], (result) => {
      const tempAccess = result.temporaryAccess || {};
      const now = Date.now();
      let changed = false;

      for (const [hostname, expiry] of Object.entries(tempAccess)) {
        if (expiry < now) {
          delete tempAccess[hostname];
          changed = true;
        }
      }

      if (changed) {
        chrome.storage.sync.set({ temporaryAccess });
      }
    });
  }
});

// Daily reset check - runs every hour
chrome.alarms.create('dailyReset', { periodInMinutes: 60 });

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'dailyReset') {
    chrome.storage.sync.get(['stats'], (result) => {
      const stats = result.stats || {};
      const todayKey = new Date().toISOString().slice(0, 10);
      const lastActive = stats.lastActiveDate;

      // If last active was 2+ days ago, reset streak
      if (lastActive) {
        const lastDate = new Date(lastActive);
        const today = new Date(todayKey);
        const diffDays = Math.floor((today - lastDate) / (1000 * 60 * 60 * 24));

        if (diffDays > 1) {
          stats.streak = 0;
          chrome.storage.sync.set({ stats });
        }
      }

      // Note: dailyBlocks automatically resets because it uses date keys
      // Each new day gets a fresh count since we use todayKey as the key
    });
  }
});

console.log('Muscle Memory background service worker loaded');
