// Dopamine Detox Popup Controller

const SITES = [
  { id: 'instagram', name: 'Instagram', emoji: '\uD83D\uDCF7', domain: 'instagram.com' },
  { id: 'facebook', name: 'Facebook', emoji: '\uD83D\uDC64', domain: 'facebook.com' },
  { id: 'youtube', name: 'YouTube', emoji: '\u25B6\uFE0F', domain: 'youtube.com' },
  { id: 'twitter', name: 'Twitter / X', emoji: '\uD83D\uDCAC', domain: 'twitter.com' },
  { id: 'linkedin', name: 'LinkedIn', emoji: '\uD83D\uDCBC', domain: 'linkedin.com' },
  { id: 'tiktok', name: 'TikTok', emoji: '\uD83C\uDFB5', domain: 'tiktok.com' },
  { id: 'reddit', name: 'Reddit', emoji: '\uD83E\uDD16', domain: 'reddit.com' },
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
};

const LOCK_DURATION = 6 * 60 * 60 * 1000; // 6 hours in ms

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

async function getLockState() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(['settingsLockUntil', 'setupComplete'], (result) => {
      resolve({
        lockUntil: result.settingsLockUntil || 0,
        setupComplete: result.setupComplete || false,
      });
    });
  });
}

async function setLock() {
  const lockUntil = Date.now() + LOCK_DURATION;
  return new Promise((resolve) => {
    chrome.storage.sync.set({ settingsLockUntil: lockUntil, setupComplete: true }, () => {
      resolve(lockUntil);
    });
  });
}

function isLocked(lockUntil) {
  return lockUntil > Date.now();
}

function formatCountdown(ms) {
  if (ms <= 0) return 'unlocked';
  const hours = Math.floor(ms / (1000 * 60 * 60));
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
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

let toastTimeout = null;
function showSaveToast() {
  const toast = document.getElementById('saveToast');
  if (!toast) return;
  if (toastTimeout) clearTimeout(toastTimeout);
  toast.classList.add('show');
  toastTimeout = setTimeout(() => {
    toast.classList.remove('show');
  }, 1500);
}

function renderCustomSites(settings, locked) {
  const container = document.getElementById('customSitesList');
  container.innerHTML = '';

  const customSites = settings.customSites || [];

  customSites.forEach((domain) => {
    const row = document.createElement('div');
    row.className = 'site-row custom-site-row';

    if (locked) {
      row.innerHTML = `
        <div class="site-info">
          <span class="site-emoji">&#x1F310;</span>
          <span class="site-name">${domain}</span>
        </div>
        <span class="lock-icon">&#x1F512;</span>
      `;
    } else {
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
        // Removing a site = loosening restriction, re-lock for 6hrs
        const lockUntil = await setLock();
        chrome.runtime.sendMessage({ type: 'settingsUpdated', settings: current });
        showSaveToast();
        renderCustomSites(current, isLocked(lockUntil));
        updateLockBanner(lockUntil);
        // Re-render site list too since lock state changed
        const siteList = document.getElementById('siteList');
        renderSiteList(siteList, SITES, 'blockedSites', current, isLocked(lockUntil));
      });
    }

    container.appendChild(row);
  });
}

function renderSiteList(container, sites, settingsKey, settings, locked) {
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
      <label class="toggle ${locked && isChecked ? 'toggle-locked' : ''}">
        <input type="checkbox" data-site="${site.id}" data-key="${settingsKey}" ${isChecked ? 'checked' : ''} ${locked && isChecked ? 'disabled' : ''}>
        <span class="toggle-slider"></span>
        ${locked && isChecked ? '<span class="toggle-lock-icon">&#x1F512;</span>' : ''}
      </label>
    `;

    const checkbox = row.querySelector('input');
    checkbox.addEventListener('change', async () => {
      const current = await getSettings();
      const wasChecked = current[settingsKey][site.id];
      current[settingsKey][site.id] = checkbox.checked;
      await saveSettings(current);
      chrome.runtime.sendMessage({ type: 'settingsUpdated', settings: current });
      showSaveToast();

      // If turning OFF a site (loosening restriction), re-lock for 6hrs
      if (wasChecked && !checkbox.checked) {
        const lockUntil = await setLock();
        // Re-render everything with new lock state
        renderSiteList(container, sites, settingsKey, current, isLocked(lockUntil));
        renderCustomSites(current, isLocked(lockUntil));
        updateLockBanner(lockUntil);
      }
    });

    container.appendChild(row);
  });
}

async function addCustomSite(locked) {
  const input = document.getElementById('customSiteInput');
  const domain = normalizeDomain(input.value);

  if (!domain) return;

  if (!isValidDomain(domain)) {
    input.classList.add('error');
    setTimeout(() => input.classList.remove('error'), 500);
    return;
  }

  const settings = await getSettings();

  const customSites = settings.customSites || [];
  if (customSites.includes(domain)) {
    input.value = '';
    return;
  }

  const presetDomains = SITES.map(s => s.domain);
  if (presetDomains.some(d => domain.includes(d) || d.includes(domain))) {
    input.classList.add('error');
    setTimeout(() => input.classList.remove('error'), 500);
    input.value = '';
    return;
  }

  settings.customSites = [...customSites, domain];
  await saveSettings(settings);
  chrome.runtime.sendMessage({ type: 'settingsUpdated', settings });
  showSaveToast();

  input.value = '';
  renderCustomSites(settings, locked);
}

function updateLockBanner(lockUntil) {
  const banner = document.getElementById('lockBanner');
  if (!banner) return;

  if (isLocked(lockUntil)) {
    const remaining = lockUntil - Date.now();
    banner.innerHTML = `&#x1F512; settings locked &middot; ${formatCountdown(remaining)} remaining`;
    banner.classList.remove('hidden');
  } else {
    banner.classList.add('hidden');
  }
}

let countdownInterval = null;

function startCountdownTimer(lockUntil) {
  if (countdownInterval) clearInterval(countdownInterval);
  countdownInterval = setInterval(() => {
    if (!isLocked(lockUntil)) {
      clearInterval(countdownInterval);
      // Lock expired, refresh UI
      init();
      return;
    }
    updateLockBanner(lockUntil);
  }, 60000); // Update every minute
}

async function init() {
  const settings = await getSettings();
  const stats = await getStats();
  const lockState = await getLockState();
  const locked = isLocked(lockState.lockUntil);

  // Check if this is first-time setup
  if (!lockState.setupComplete) {
    showSetupOverlay(settings);
    return;
  }

  // Hide setup overlay if visible
  const setupOverlay = document.getElementById('setupOverlay');
  if (setupOverlay) setupOverlay.classList.add('hidden');

  // Show main content
  const mainContent = document.getElementById('mainContent');
  if (mainContent) mainContent.classList.remove('hidden');

  // Lock banner
  updateLockBanner(lockState.lockUntil);
  if (locked) startCountdownTimer(lockState.lockUntil);

  // Render site list
  const siteList = document.getElementById('siteList');
  renderSiteList(siteList, SITES, 'blockedSites', settings, locked);

  // Render custom sites
  renderCustomSites(settings, locked);

  // Add custom site handler (adding is always allowed)
  document.getElementById('addCustomSite').onclick = () => addCustomSite(locked);
  document.getElementById('customSiteInput').onkeydown = (e) => {
    if (e.key === 'Enter') addCustomSite(locked);
  };

  // Stats
  const todayKey = getTodayKey();
  const todayBlocks = (stats.dailyBlocks && stats.dailyBlocks[todayKey]) || 0;
  document.getElementById('timeSaved').textContent = formatTimeSaved(stats.timeSaved || 0);
  document.getElementById('blocksToday').textContent = todayBlocks;
  document.getElementById('exercisesDone').textContent = stats.exercisesDone || 0;

  // Streak
  const streak = stats.streak || 0;
  document.getElementById('streakText').textContent = `${streak} day streak`;

  // Bottom links
  document.getElementById('openStats').addEventListener('click', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('stats.html') });
  });
  document.getElementById('openOptions').addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });
}

function showSetupOverlay(settings) {
  const setupOverlay = document.getElementById('setupOverlay');
  const mainContent = document.getElementById('mainContent');

  if (mainContent) mainContent.classList.add('hidden');
  if (setupOverlay) setupOverlay.classList.remove('hidden');

  // Render setup site toggles
  const setupSiteList = document.getElementById('setupSiteList');
  if (!setupSiteList) return;

  setupSiteList.innerHTML = '';

  SITES.forEach((site) => {
    const row = document.createElement('div');
    row.className = 'site-row';

    const isChecked = settings.blockedSites && settings.blockedSites[site.id];

    row.innerHTML = `
      <div class="site-info">
        <span class="site-emoji">${site.emoji}</span>
        <span class="site-name">${site.name}</span>
      </div>
      <label class="toggle">
        <input type="checkbox" data-site="${site.id}" ${isChecked ? 'checked' : ''}>
        <span class="toggle-slider"></span>
      </label>
    `;

    setupSiteList.appendChild(row);
  });

  // Setup custom site input
  const setupAddBtn = document.getElementById('setupAddCustomSite');
  const setupInput = document.getElementById('setupCustomInput');
  const setupCustomList = document.getElementById('setupCustomList');

  let setupCustomSites = [...(settings.customSites || [])];

  function renderSetupCustomSites() {
    setupCustomList.innerHTML = '';
    setupCustomSites.forEach((domain) => {
      const row = document.createElement('div');
      row.className = 'site-row custom-site-row';
      row.innerHTML = `
        <div class="site-info">
          <span class="site-emoji">&#x1F310;</span>
          <span class="site-name">${domain}</span>
        </div>
        <button class="btn-remove" data-domain="${domain}">&#x2715;</button>
      `;
      row.querySelector('.btn-remove').addEventListener('click', () => {
        setupCustomSites = setupCustomSites.filter(d => d !== domain);
        renderSetupCustomSites();
      });
      setupCustomList.appendChild(row);
    });
  }

  renderSetupCustomSites();

  setupAddBtn.onclick = () => {
    const domain = normalizeDomain(setupInput.value);
    if (!domain || !isValidDomain(domain)) {
      setupInput.classList.add('error');
      setTimeout(() => setupInput.classList.remove('error'), 500);
      return;
    }
    if (setupCustomSites.includes(domain)) { setupInput.value = ''; return; }
    const presetDomains = SITES.map(s => s.domain);
    if (presetDomains.some(d => domain.includes(d) || d.includes(domain))) {
      setupInput.classList.add('error');
      setTimeout(() => setupInput.classList.remove('error'), 500);
      setupInput.value = '';
      return;
    }
    setupCustomSites.push(domain);
    setupInput.value = '';
    renderSetupCustomSites();
  };

  setupInput.onkeydown = (e) => {
    if (e.key === 'Enter') setupAddBtn.onclick();
  };

  // Lock In button
  const lockInBtn = document.getElementById('lockInBtn');
  lockInBtn.onclick = async () => {
    // Gather selected sites from setup
    const checkboxes = setupSiteList.querySelectorAll('input[type="checkbox"]');
    const blockedSites = {};
    checkboxes.forEach((cb) => {
      blockedSites[cb.dataset.site] = cb.checked;
    });

    // Check if at least one site is selected
    const hasAnySite = Object.values(blockedSites).some(v => v) || setupCustomSites.length > 0;
    if (!hasAnySite) {
      lockInBtn.textContent = 'SELECT AT LEAST ONE SITE';
      lockInBtn.style.background = 'linear-gradient(135deg, #333, #555)';
      setTimeout(() => {
        lockInBtn.textContent = 'LOCK IN FOR 6 HOURS';
        lockInBtn.style.background = '';
      }, 2000);
      return;
    }

    const newSettings = {
      focusMode: true,
      blockedSites,
      customSites: setupCustomSites,
    };

    await saveSettings(newSettings);
    await setLock();
    chrome.runtime.sendMessage({ type: 'settingsUpdated', settings: newSettings });

    // Reload popup with locked state
    init();
  };
}

document.addEventListener('DOMContentLoaded', init);
