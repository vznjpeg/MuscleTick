// Dopamine Detox Options Page

const STRIPE_URL = 'https://buy.stripe.com/00weVee9raiV6ascLZao80h';

const SITES = [
  { id: 'instagram', name: 'Instagram', emoji: '\uD83D\uDCF7' },
  { id: 'facebook', name: 'Facebook', emoji: '\uD83D\uDC64' },
  { id: 'youtube', name: 'YouTube', emoji: '\u25B6\uFE0F' },
  { id: 'twitter', name: 'Twitter / X', emoji: '\uD83D\uDCAC' },
  { id: 'linkedin', name: 'LinkedIn', emoji: '\uD83D\uDCBC' },
  { id: 'tiktok', name: 'TikTok', emoji: '\uD83C\uDFB5' },
  { id: 'reddit', name: 'Reddit', emoji: '\uD83E\uDD16' },
];

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
  baseReps: 3,
  penaltyExtraReps: 1,
};

async function getSettings() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(['settings'], (result) => {
      resolve({ ...DEFAULT_SETTINGS, ...result.settings });
    });
  });
}

async function saveSettings(settings) {
  return new Promise((resolve) => {
    chrome.storage.sync.set({ settings }, resolve);
  });
}

async function getPremiumStatus() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(['isPremium'], (result) => {
      resolve(result.isPremium || false);
    });
  });
}

async function setPremiumStatus(isPremium) {
  return new Promise((resolve) => {
    chrome.storage.sync.set({ isPremium }, resolve);
  });
}

function renderPremiumSection(isPremium) {
  const container = document.getElementById('premiumStatus');
  if (!container) return;

  if (isPremium) {
    container.innerHTML = `
      <div class="premium-active">
        <span class="premium-active-icon">&#x2705;</span>
        <div class="premium-active-text">
          <strong>Premium Active</strong>
          <span>You have full access to all features</span>
        </div>
      </div>
    `;
  } else {
    container.innerHTML = `
      <div class="premium-free">
        <div class="premium-free-info">
          <p><strong>Free Version</strong></p>
          <p class="premium-free-desc">Block only 2 sites. Upgrade for unlimited sites + custom blockers.</p>
        </div>
        <div class="premium-buttons">
          <button class="btn-upgrade" id="upgradeBtn">&#x1F451; Upgrade - One Time</button>
          <button class="btn-activate" id="activateBtn">Already purchased? Activate</button>
        </div>
      </div>
    `;

    document.getElementById('upgradeBtn').addEventListener('click', () => {
      chrome.tabs.create({ url: STRIPE_URL });
    });

    document.getElementById('activateBtn').addEventListener('click', async () => {
      if (confirm('By clicking OK, you confirm that you have completed your purchase. Premium features will be activated.')) {
        await setPremiumStatus(true);
        showSaveNotice();
        renderPremiumSection(true);
      }
    });
  }
}

function showSaveNotice() {
  const notice = document.getElementById('saveNotice');
  notice.classList.add('visible');
  setTimeout(() => {
    notice.classList.remove('visible');
  }, 2000);
}

function renderSiteList(containerId, sites, settingsKey, settings) {
  const container = document.getElementById(containerId);
  container.innerHTML = '';

  sites.forEach((site) => {
    const isChecked = settings[settingsKey] && settings[settingsKey][site.id];
    const row = document.createElement('div');
    row.className = 'site-row';
    row.innerHTML = `
      <div class="site-info">
        <span class="site-emoji">${site.emoji}</span>
        <span class="site-name">${site.name}</span>
      </div>
      <label class="toggle">
        <input type="checkbox" data-site="${site.id}" data-key="${settingsKey}" ${isChecked ? 'checked' : ''}>
        <span class="toggle-slider"></span>
      </label>
    `;

    const checkbox = row.querySelector('input');
    checkbox.addEventListener('change', async () => {
      const current = await getSettings();
      if (!current[settingsKey]) current[settingsKey] = {};
      current[settingsKey][site.id] = checkbox.checked;
      await saveSettings(current);
      showSaveNotice();
      chrome.runtime.sendMessage({ type: 'settingsUpdated', settings: current });
    });

    container.appendChild(row);
  });
}

async function init() {
  const settings = await getSettings();
  const isPremium = await getPremiumStatus();

  // Render premium section
  renderPremiumSection(isPremium);

  // Render blocked sites list
  renderSiteList('blockedSitesList', SITES, 'blockedSites', settings);

  // Challenge settings
  const baseReps = document.getElementById('baseReps');
  const penaltyExtraReps = document.getElementById('penaltyExtraReps');

  if (baseReps) {
    baseReps.value = settings.baseReps || 3;
    baseReps.addEventListener('change', async () => {
      const current = await getSettings();
      current.baseReps = parseInt(baseReps.value);
      await saveSettings(current);
      showSaveNotice();
    });
  }

  if (penaltyExtraReps) {
    penaltyExtraReps.value = settings.penaltyExtraReps || 1;
    penaltyExtraReps.addEventListener('change', async () => {
      const current = await getSettings();
      current.penaltyExtraReps = parseInt(penaltyExtraReps.value);
      await saveSettings(current);
      showSaveNotice();
    });
  }

  // Export data
  const exportBtn = document.getElementById('exportData');
  if (exportBtn) {
    exportBtn.addEventListener('click', async () => {
      const result = await chrome.storage.sync.get(['settings', 'stats']);
      const dataStr = JSON.stringify(result, null, 2);
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'dopamine-detox-data.json';
      a.click();
      URL.revokeObjectURL(url);
    });
  }

  // Request a feature
  const featureBtn = document.getElementById('requestFeature');
  if (featureBtn) {
    featureBtn.addEventListener('click', () => {
      chrome.tabs.create({ url: 'https://forms.gle/ZxMmUz2usNUVuJvS7' });
    });
  }

  // Reset stats
  const resetBtn = document.getElementById('resetStats');
  if (resetBtn) {
    resetBtn.addEventListener('click', async () => {
      if (confirm('Are you sure you want to reset all your stats? This cannot be undone.')) {
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
        showSaveNotice();
      }
    });
  }
}

document.addEventListener('DOMContentLoaded', init);
