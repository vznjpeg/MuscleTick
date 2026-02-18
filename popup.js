// Muscle Memory Popup Controller

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
const STRIPE_PAYMENT_LINK = 'https://buy.stripe.com/test_YOUR_STRIPE_PAYMENT_LINK';

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
  customSites: [],
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

async function getStats() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(['stats'], (result) => {
      resolve(result.stats || { totalBlockedAttempts: 0, exercisesDone: 0, streak: 0, dailyBlocks: {}, timeSaved: 0 });
    });
  });
}

async function isPremium() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(['premium'], (result) => {
      resolve(result.premium === true);
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

function normalizeDomain(input) {
  let domain = input.trim().toLowerCase();
  domain = domain.replace(/^(https?:\/\/)?(www\.)?/, '');
  domain = domain.split('/')[0];
  domain = domain.trim();
  return domain;
}

function isValidDomain(domain) {
  const domainRegex = /^[a-z0-9]+([\-\.]{1}[a-z0-9]+)*\.[a-z]{2,}$/i;
  return domainRegex.test(domain);
}

function countBlockedSites(settings) {
  let count = 0;
  if (settings.blockedSites) {
    for (const key of Object.keys(settings.blockedSites)) {
      if (settings.blockedSites[key]) count++;
    }
  }
  count += (settings.customSites || []).length;
  return count;
}

function showUpgradeModal() {
  document.getElementById('upgradeModal').classList.remove('hidden');
}

function hideUpgradeModal() {
  document.getElementById('upgradeModal').classList.add('hidden');
}

function renderCustomSites(settings, premium) {
  const container = document.getElementById('customSitesList');
  container.innerHTML = '';

  const customSites = settings.customSites || [];

  customSites.forEach((domain) => {
    const row = document.createElement('div');
    row.className = 'site-row custom-site-row';
    row.innerHTML = `
      <div class="site-info">
        <span class="site-emoji">&#x1F310;</span>
        <span class="site-name">${domain}</span>
      </div>
      <button class="btn-remove" data-domain="${domain}">&#x2715;</button>
    `;

    const removeBtn = row.querySelector('.btn-remove');
    removeBtn.addEventListener('click', async () => {
      const current = await getSettings();
      current.customSites = (current.customSites || []).filter(d => d !== domain);
      await saveSettings(current);
      chrome.runtime.sendMessage({ type: 'settingsUpdated', settings: current });
      renderCustomSites(current, premium);
    });

    container.appendChild(row);
  });

  // Show/hide custom site input based on premium
  const addCustomSection = document.querySelector('.add-custom-site');
  if (!premium) {
    addCustomSection.classList.add('hidden');
  } else {
    addCustomSection.classList.remove('hidden');
  }
}

function renderSiteList(container, sites, settingsKey, settings, toggleClass, premium) {
  container.innerHTML = '';

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
      // Check free limit for blockedSites
      if (settingsKey === 'blockedSites' && checkbox.checked && !premium) {
        const current = await getSettings();
        if (countBlockedSites(current) >= FREE_SITE_LIMIT) {
          checkbox.checked = false;
          showUpgradeModal();
          return;
        }
      }

      const current = await getSettings();
      current[settingsKey][site.id] = checkbox.checked;
      await saveSettings(current);
      chrome.runtime.sendMessage({ type: 'settingsUpdated', settings: current });
    });

    container.appendChild(row);
  });
}

async function addCustomSite(premium) {
  if (!premium) {
    showUpgradeModal();
    return;
  }

  const input = document.getElementById('customSiteInput');
  const domain = normalizeDomain(input.value);

  if (!domain) return;

  if (!isValidDomain(domain)) {
    input.classList.add('error');
    setTimeout(() => input.classList.remove('error'), 500);
    return;
  }

  const settings = await getSettings();

  // Check if already exists
  const customSites = settings.customSites || [];
  if (customSites.includes(domain)) {
    input.value = '';
    return;
  }

  // Check if it's a preset site
  const presetDomains = SITES.map(s => s.domain);
  if (presetDomains.some(d => domain.includes(d) || d.includes(domain))) {
    input.classList.add('error');
    setTimeout(() => input.classList.remove('error'), 500);
    input.value = '';
    return;
  }

  // Add the custom site
  settings.customSites = [...customSites, domain];
  await saveSettings(settings);
  chrome.runtime.sendMessage({ type: 'settingsUpdated', settings });

  input.value = '';
  renderCustomSites(settings, premium);
}

async function init() {
  const settings = await getSettings();
  const stats = await getStats();
  const premium = await isPremium();

  // Render site list
  const siteList = document.getElementById('siteList');
  renderSiteList(siteList, SITES, 'blockedSites', settings, '', premium);

  // Render custom sites
  renderCustomSites(settings, premium);

  // Show limit notice for free users
  const limitNotice = document.getElementById('limitNotice');
  if (!premium && limitNotice) {
    const currentCount = countBlockedSites(settings);
    limitNotice.textContent = `${currentCount}/${FREE_SITE_LIMIT} free sites used`;
    limitNotice.classList.remove('hidden');
  } else if (limitNotice) {
    limitNotice.classList.add('hidden');
  }

  // Add custom site handler
  document.getElementById('addCustomSite').addEventListener('click', () => addCustomSite(premium));
  document.getElementById('customSiteInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') addCustomSite(premium);
  });

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

  // Upgrade modal handlers
  document.getElementById('upgradeBtn').addEventListener('click', () => {
    chrome.tabs.create({ url: STRIPE_PAYMENT_LINK });
  });
  document.getElementById('closeUpgrade').addEventListener('click', hideUpgradeModal);

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
