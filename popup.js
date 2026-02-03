// MuscleTick Popup Controller

const SITES = [
  { id: 'instagram', name: 'Instagram', emoji: '\uD83D\uDCF7', domain: 'instagram.com' },
  { id: 'facebook', name: 'Facebook', emoji: '\uD83D\uDC64', domain: 'facebook.com' },
  { id: 'youtube', name: 'YouTube', emoji: '\u25B6\uFE0F', domain: 'youtube.com' },
  { id: 'twitter', name: 'Twitter / X', emoji: '\uD83D\uDCAC', domain: 'twitter.com' },
  { id: 'linkedin', name: 'LinkedIn', emoji: '\uD83D\uDCBC', domain: 'linkedin.com' },
  { id: 'tiktok', name: 'TikTok', emoji: '\uD83C\uDFB5', domain: 'tiktok.com' },
  { id: 'reddit', name: 'Reddit', emoji: '\uD83E\uDD16', domain: 'reddit.com' },
];

const FREE_SITE_LIMIT = 2;

const DEFAULT_SETTINGS = {
  focusMode: true,
  isPremium: false,
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
};

async function getSettings() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(['settings'], (result) => {
      resolve(result.settings || DEFAULT_SETTINGS);
    });
  });
}

async function saveSettings(settings) {
  return new Promise((resolve) => {
    chrome.storage.sync.set({ settings }, resolve);
  });
}

async function getStats() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(['stats'], (result) => {
      resolve(result.stats || { totalBlockedAttempts: 0, exercisesDone: 0, streak: 0, dailyBlocks: {}, timeSaved: 0 });
    });
  });
}

function formatTimeSaved(minutes) {
  if (minutes < 60) return `${Math.round(minutes)}m`;
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return `${h}h ${m}m`;
}

function getTodayKey() {
  return new Date().toISOString().slice(0, 10);
}

function countBlockedSites(settings) {
  let count = 0;
  for (const siteId of Object.keys(settings.blockedSites || {})) {
    if (settings.blockedSites[siteId]) count++;
  }
  return count;
}

function showUpgradeModal() {
  // Create modal
  const modal = document.createElement('div');
  modal.className = 'upgrade-modal';
  modal.innerHTML = `
    <div class="upgrade-content">
      <div class="upgrade-icon">&#x1F4AA;</div>
      <h2>upgrade to premium</h2>
      <p>free users can only block 2 sites</p>
      <ul class="upgrade-features">
        <li>&#x2705; Block unlimited sites</li>
        <li>&#x2705; Custom timer settings</li>
        <li>&#x2705; Export your data</li>
        <li>&#x2705; Choose your exercises</li>
      </ul>
      <button class="btn-upgrade" id="upgradePremium">UPGRADE - $4.99</button>
      <button class="btn-close" id="closeModal">maybe later</button>
    </div>
  `;
  document.body.appendChild(modal);

  document.getElementById('closeModal').addEventListener('click', () => {
    modal.remove();
  });

  document.getElementById('upgradePremium').addEventListener('click', async () => {
    // In a real app, this would trigger payment flow
    chrome.runtime.sendMessage({ type: 'upgradeToPremium' }, () => {
      modal.remove();
      location.reload();
    });
  });
}

function renderSiteList(container, sites, settingsKey, settings, toggleClass) {
  container.innerHTML = '';
  const isPremium = settings.isPremium || false;
  const blockedCount = countBlockedSites(settings);

  sites.forEach((site) => {
    const row = document.createElement('div');
    row.className = 'site-row';

    const isChecked = settings[settingsKey] && settings[settingsKey][site.id];

    row.innerHTML = `
      <div class="site-info">
        <span class="site-emoji">${site.emoji}</span>
        <span class="site-name">${site.name}</span>
      </div>
      <label class="toggle ${toggleClass}">
        <input type="checkbox" data-site="${site.id}" data-key="${settingsKey}" ${isChecked ? 'checked' : ''}>
        <span class="toggle-slider"></span>
      </label>
    `;

    const checkbox = row.querySelector('input');
    checkbox.addEventListener('change', async () => {
      const current = await getSettings();
      const currentCount = countBlockedSites(current);

      // Check paywall for blocked sites only (not hide mode)
      if (settingsKey === 'blockedSites' && checkbox.checked && !current.isPremium) {
        if (currentCount >= FREE_SITE_LIMIT) {
          checkbox.checked = false;
          showUpgradeModal();
          return;
        }
      }

      current[settingsKey][site.id] = checkbox.checked;
      await saveSettings(current);
      chrome.runtime.sendMessage({ type: 'settingsUpdated', settings: current });
    });

    container.appendChild(row);
  });
}

async function init() {
  const settings = await getSettings();
  const stats = await getStats();

  // Render site lists
  const siteList = document.getElementById('siteList');
  const hideModeList = document.getElementById('hideModeList');
  renderSiteList(siteList, SITES, 'blockedSites', settings, '');
  renderSiteList(hideModeList, SITES, 'hiddenElements', settings, 'toggle-hide');

  // Stats
  const todayKey = getTodayKey();
  const todayBlocks = (stats.dailyBlocks && stats.dailyBlocks[todayKey]) || 0;
  document.getElementById('timeSaved').textContent = formatTimeSaved(stats.timeSaved || 0);
  document.getElementById('blocksToday').textContent = todayBlocks;
  document.getElementById('exercisesDone').textContent = stats.exercisesDone || 0;

  // Streak
  const streak = stats.streak || 0;
  document.getElementById('streakText').textContent = `${streak} day streak`;

  // Master toggle
  const masterBtn = document.getElementById('masterToggle');
  updateMasterButton(masterBtn, settings.focusMode);

  masterBtn.addEventListener('click', async () => {
    const current = await getSettings();
    current.focusMode = !current.focusMode;
    await saveSettings(current);
    updateMasterButton(masterBtn, current.focusMode);
    chrome.runtime.sendMessage({ type: 'settingsUpdated', settings: current });
  });

  // Bottom links
  document.getElementById('openStats').addEventListener('click', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('stats.html') });
  });
  document.getElementById('openOptions').addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });
}

function updateMasterButton(btn, isOn) {
  const textEl = btn.querySelector('.btn-text');
  if (isOn) {
    textEl.textContent = 'FOCUS MODE ON';
    btn.classList.remove('off');
  } else {
    textEl.textContent = 'FOCUS MODE OFF';
    btn.classList.add('off');
  }
}

document.addEventListener('DOMContentLoaded', init);
