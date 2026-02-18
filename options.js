// Muscle Memory Options Page

const SITES = [
  { id: 'instagram', name: 'Instagram', emoji: '\uD83D\uDCF7' },
  { id: 'facebook', name: 'Facebook', emoji: '\uD83D\uDC64' },
  { id: 'youtube', name: 'YouTube', emoji: '\u25B6\uFE0F' },
  { id: 'twitter', name: 'Twitter / X', emoji: '\uD83D\uDCAC' },
  { id: 'linkedin', name: 'LinkedIn', emoji: '\uD83D\uDCBC' },
  { id: 'tiktok', name: 'TikTok', emoji: '\uD83C\uDFB5' },
  { id: 'reddit', name: 'Reddit', emoji: '\uD83E\uDD16' },
];

const EXERCISES = [
  { id: 'pushups', name: '15 Pushups', emoji: '\uD83E\uDDD1\u200D\uD83C\uDFCB\uFE0F' },
  { id: 'squats', name: '10 Squats', emoji: '\uD83E\uDDCE' },
  { id: 'highknees', name: '20 High Knees', emoji: '\uD83C\uDFC3' },
  { id: 'wallsit', name: '30s Wall Sit', emoji: '\uD83E\uDDF1' },
  { id: 'jumpingjacks', name: '15 Jumping Jacks', emoji: '\u2B50' },
  { id: 'burpees', name: '10 Burpees', emoji: '\uD83D\uDD25' },
  { id: 'crunches', name: '20 Crunches', emoji: '\uD83E\uDEE0' },
  { id: 'lunges', name: '15 Lunges', emoji: '\uD83E\uDDB6' },
  { id: 'dips', name: '10 Tricep Dips', emoji: '\uD83D\uDCBA' },
  { id: 'plank', name: '30s Plank', emoji: '\uD83E\uDDF1' },
  { id: 'mountainclimbers', name: '20 Mountain Climbers', emoji: '\u26F0\uFE0F' },
  { id: 'calfraises', name: '15 Calf Raises', emoji: '\uD83E\uDDB6' },
];

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
  baseTimer: 30,
  penaltyIncrement: 30,
  enabledExercises: ['pushups', 'squats', 'highknees', 'wallsit', 'jumpingjacks', 'burpees', 'crunches', 'lunges', 'dips', 'plank', 'mountainclimbers', 'calfraises'],
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

async function isPremium() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(['premium'], (result) => {
      resolve(result.premium === true);
    });
  });
}

function showSaveNotice() {
  const notice = document.getElementById('saveNotice');
  notice.classList.add('visible');
  setTimeout(() => {
    notice.classList.remove('visible');
  }, 2000);
}

function renderSiteList(containerId, sites, settingsKey, settings, toggleClass = '') {
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
      <label class="toggle ${toggleClass}">
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

function renderExerciseGrid(settings) {
  const container = document.getElementById('exerciseGrid');
  if (!container) return;
  container.innerHTML = '';

  const enabled = settings.enabledExercises || DEFAULT_SETTINGS.enabledExercises;

  EXERCISES.forEach((exercise) => {
    const isSelected = enabled.includes(exercise.id);
    const item = document.createElement('label');
    item.className = `exercise-item ${isSelected ? 'selected' : ''}`;
    item.innerHTML = `
      <input type="checkbox" data-exercise="${exercise.id}" ${isSelected ? 'checked' : ''}>
      <span class="exercise-emoji">${exercise.emoji}</span>
      <span class="exercise-name">${exercise.name}</span>
    `;

    const checkbox = item.querySelector('input');
    checkbox.addEventListener('change', async () => {
      const current = await getSettings();
      const enabledExercises = current.enabledExercises || [...DEFAULT_SETTINGS.enabledExercises];

      if (checkbox.checked) {
        if (!enabledExercises.includes(exercise.id)) {
          enabledExercises.push(exercise.id);
        }
        item.classList.add('selected');
      } else {
        if (enabledExercises.length <= 3) {
          checkbox.checked = true;
          return;
        }
        const idx = enabledExercises.indexOf(exercise.id);
        if (idx > -1) enabledExercises.splice(idx, 1);
        item.classList.remove('selected');
      }

      current.enabledExercises = enabledExercises;
      await saveSettings(current);
      showSaveNotice();
    });

    container.appendChild(item);
  });
}

async function init() {
  const settings = await getSettings();
  const premium = await isPremium();

  // Premium banner
  const premiumBanner = document.getElementById('premiumBanner');
  const premiumBadge = document.getElementById('premiumBadge');
  if (premium) {
    if (premiumBanner) premiumBanner.classList.add('hidden');
    if (premiumBadge) premiumBadge.classList.remove('hidden');
  } else {
    if (premiumBanner) premiumBanner.classList.remove('hidden');
    if (premiumBadge) premiumBadge.classList.add('hidden');
  }

  // Upgrade button in banner
  const upgradeBannerBtn = document.getElementById('upgradeBannerBtn');
  if (upgradeBannerBtn) {
    upgradeBannerBtn.addEventListener('click', () => {
      chrome.tabs.create({ url: STRIPE_PAYMENT_LINK });
    });
  }

  // Render blocked sites list
  renderSiteList('blockedSitesList', SITES, 'blockedSites', settings);

  // Premium-gated sections
  const premiumSections = document.querySelectorAll('.premium-section');
  premiumSections.forEach((section) => {
    if (!premium) {
      section.classList.add('locked');
    }
  });

  // Timer settings (premium only)
  const baseTimer = document.getElementById('baseTimer');
  const penaltyIncrement = document.getElementById('penaltyIncrement');

  if (baseTimer) {
    baseTimer.value = settings.baseTimer || 30;
    baseTimer.disabled = !premium;
    baseTimer.addEventListener('change', async () => {
      if (!premium) return;
      const current = await getSettings();
      current.baseTimer = parseInt(baseTimer.value);
      await saveSettings(current);
      showSaveNotice();
    });
  }

  if (penaltyIncrement) {
    penaltyIncrement.value = settings.penaltyIncrement || 30;
    penaltyIncrement.disabled = !premium;
    penaltyIncrement.addEventListener('change', async () => {
      if (!premium) return;
      const current = await getSettings();
      current.penaltyIncrement = parseInt(penaltyIncrement.value);
      await saveSettings(current);
      showSaveNotice();
    });
  }

  // Exercise grid (premium only)
  if (premium) {
    renderExerciseGrid(settings);
  } else {
    const exerciseGrid = document.getElementById('exerciseGrid');
    if (exerciseGrid) {
      exerciseGrid.innerHTML = '<p class="locked-msg">upgrade to premium to customize exercises</p>';
    }
  }

  // Export data (premium only)
  const exportBtn = document.getElementById('exportData');
  if (exportBtn) {
    exportBtn.disabled = !premium;
    exportBtn.addEventListener('click', async () => {
      if (!premium) return;
      const result = await chrome.storage.sync.get(['settings', 'stats']);
      const dataStr = JSON.stringify(result, null, 2);
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'musclememory-data.json';
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

  // Reset stats (always available)
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
