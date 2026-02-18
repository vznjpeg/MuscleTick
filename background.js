// Dopamine Detox - Background Service Worker

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
  customSites: [],
};

// In-memory temp access map for instant checks (no async storage delay)
const tempAccessMap = {};

// Load existing temp access from storage on startup
chrome.storage.sync.get(['temporaryAccess'], (result) => {
  const stored = result.temporaryAccess || {};
  const now = Date.now();
  for (const [domain, expiry] of Object.entries(stored)) {
    if (expiry > now) {
      tempAccessMap[domain] = expiry;
    }
  }
});

// Initialize settings if not exists
chrome.runtime.onInstalled.addListener(async () => {
  const result = await chrome.storage.sync.get(['settings']);
  if (!result.settings) {
    await chrome.storage.sync.set({ settings: DEFAULT_SETTINGS });
  }

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

// Check temp access from in-memory map (synchronous, no race condition)
function hasTempAccess(hostname) {
  const cleanHostname = hostname.replace(/^www\./, '');
  const now = Date.now();
  for (const [domain, expiry] of Object.entries(tempAccessMap)) {
    if (expiry > now && (cleanHostname === domain || cleanHostname.endsWith('.' + domain) || domain.endsWith('.' + cleanHostname))) {
      return true;
    }
  }
  return false;
}

// Handle navigation to blocked sites
chrome.webNavigation.onBeforeNavigate.addListener(async (details) => {
  if (details.frameId !== 0) return;

  try {
    const url = new URL(details.url);
    const hostname = url.hostname.toLowerCase();

    // Check in-memory temp access FIRST (instant, no async)
    if (hasTempAccess(hostname)) return;

    const result = await chrome.storage.sync.get(['settings']);
    const settings = result.settings || DEFAULT_SETTINGS;

    if (!settings.focusMode) return;

    // Check preset blocked sites
    let siteKey = DOMAIN_TO_KEY[hostname];
    if (!siteKey) {
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

    const customSites = settings.customSites || [];
    const matchedCustomSite = matchesCustomSite(hostname, customSites);
    if (matchedCustomSite) {
      shouldBlock = true;
    }

    if (!shouldBlock) return;

    const blockedUrl = chrome.runtime.getURL('blocked.html') + '?url=' + encodeURIComponent(details.url);
    chrome.tabs.update(details.tabId, { url: blockedUrl });
  } catch (err) {
    console.error('Dopamine Detox navigation error:', err);
  }
});

// Enforce 24hr lock: reject settings changes that loosen restrictions while locked
async function enforceSettingsLock(newSettings) {
  return new Promise((resolve) => {
    chrome.storage.sync.get(['settingsLockUntil', 'settings'], (result) => {
      const lockUntil = result.settingsLockUntil || 0;
      if (lockUntil <= Date.now()) {
        // Not locked, allow any change
        resolve(newSettings);
        return;
      }

      // Locked: prevent loosening restrictions
      const oldSettings = result.settings || DEFAULT_SETTINGS;
      const enforced = { ...newSettings };

      // Prevent turning OFF any site that was ON
      if (oldSettings.blockedSites && enforced.blockedSites) {
        for (const [key, wasBlocked] of Object.entries(oldSettings.blockedSites)) {
          if (wasBlocked && !enforced.blockedSites[key]) {
            enforced.blockedSites[key] = true; // Force it back ON
          }
        }
      }

      // Prevent removing custom sites that were there
      const oldCustom = oldSettings.customSites || [];
      const newCustom = enforced.customSites || [];
      const missing = oldCustom.filter(d => !newCustom.includes(d));
      if (missing.length > 0) {
        enforced.customSites = [...newCustom, ...missing];
      }

      resolve(enforced);
    });
  });
}

// Handle messages from popup and content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'settingsUpdated') {
    // Enforce lock before propagating
    enforceSettingsLock(message.settings).then((enforcedSettings) => {
      // Save the enforced settings
      chrome.storage.sync.set({ settings: enforcedSettings }, () => {
        chrome.tabs.query({}, (tabs) => {
          tabs.forEach((tab) => {
            if (tab.id) {
              chrome.tabs.sendMessage(tab.id, { type: 'settingsUpdated', settings: enforcedSettings }).catch(() => {});
            }
          });
        });
        sendResponse({ success: true });
      });
    });
    return true; // async response
  }

  if (message.type === 'grantTemporaryAccess') {
    const url = message.url;
    try {
      const hostname = new URL(url).hostname.replace(/^www\./, '');
      const expiryTime = Date.now() + 60 * 1000; // 60 seconds

      // Write to in-memory map FIRST (instant for navigation checks)
      tempAccessMap[hostname] = expiryTime;

      // Also persist to storage for cross-session recovery
      chrome.storage.sync.get(['temporaryAccess'], (result) => {
        const tempAccess = result.temporaryAccess || {};
        tempAccess[hostname] = expiryTime;
        chrome.storage.sync.set({ temporaryAccess: tempAccess }, () => {
          sendResponse({ success: true, expiryTime });
        });
      });
    } catch (err) {
      sendResponse({ success: false, error: err.message });
    }
    return true;
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

  return false;
});

// Clean up expired entries periodically
chrome.alarms.create('cleanupTempAccess', { periodInMinutes: 1 });

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'cleanupTempAccess') {
    // Clean in-memory map
    const now = Date.now();
    for (const [hostname, expiry] of Object.entries(tempAccessMap)) {
      if (expiry < now) {
        delete tempAccessMap[hostname];
      }
    }

    // Clean storage
    chrome.storage.sync.get(['temporaryAccess'], (result) => {
      const tempAccess = result.temporaryAccess || {};
      let changed = false;
      for (const [hostname, expiry] of Object.entries(tempAccess)) {
        if (expiry < now) {
          delete tempAccess[hostname];
          changed = true;
        }
      }
      if (changed) {
        chrome.storage.sync.set({ temporaryAccess: tempAccess });
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

      if (lastActive) {
        const lastDate = new Date(lastActive);
        const today = new Date(todayKey);
        const diffDays = Math.floor((today - lastDate) / (1000 * 60 * 60 * 24));

        if (diffDays > 1) {
          stats.streak = 0;
          chrome.storage.sync.set({ stats });
        }
      }
    });
  }
});

console.log('Dopamine Detox background service worker loaded');
