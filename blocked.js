// Dopamine Detox - Blocked Page Controller

const EXERCISES = [
  { name: '15 Pushups', emoji: '\uD83E\uDDD1\u200D\uD83C\uDFCB\uFE0F', desc: 'chest to the ground, full extension up', icon: '\uD83D\uDCAA' },
  { name: '10 Squats', emoji: '\uD83E\uDDCE', desc: 'thighs parallel to the floor, back straight', icon: '\uD83E\uDDB5' },
  { name: '20 High Knees', emoji: '\uD83C\uDFC3', desc: 'drive those knees up, keep it fast', icon: '\u26A1' },
  { name: '30s Wall Sit', emoji: '\uD83E\uDDF1', desc: 'back flat against wall, thighs parallel', icon: '\uD83C\uDFCB\uFE0F' },
  { name: '15 Jumping Jacks', emoji: '\u2B50', desc: 'arms overhead, feet apart, stay bouncy', icon: '\uD83C\uDF1F' },
  { name: '10 Burpees', emoji: '\uD83D\uDD25', desc: 'drop, push up, jump up, repeat', icon: '\uD83D\uDE80' },
  { name: '20 Crunches', emoji: '\uD83E\uDEE0', desc: 'hands behind head, squeeze at the top', icon: '\uD83C\uDFAF' },
  { name: '15 Lunges', emoji: '\uD83E\uDDB6', desc: 'alternate legs, knee almost touches ground', icon: '\uD83D\uDC63' },
  { name: '10 Tricep Dips', emoji: '\uD83D\uDCBA', desc: 'use a chair, lower slow, push up fast', icon: '\uD83D\uDCAA' },
  { name: '30s Plank', emoji: '\uD83E\uDDF1', desc: 'straight line from head to heels, hold it', icon: '\u23F1\uFE0F' },
  { name: '20 Mountain Climbers', emoji: '\u26F0\uFE0F', desc: 'fast feet, keep your core tight', icon: '\uD83D\uDD25' },
  { name: '15 Calf Raises', emoji: '\uD83E\uDDB6', desc: 'rise up on your toes, squeeze at the top', icon: '\u2B06\uFE0F' },
];

const MOTIVATION_QUOTES = [
  '"the only bad workout is the one that didn\'t happen" - some gym bro',
  '"your future self is watching you through memories" - probably tiktok',
  '"touch grass > touch screen" - ancient proverb',
  '"the grind never stops but your doom scrolling should" - sigma wisdom',
  '"be the main character of the gym, not the feed" - gen z confucius',
  '"1% better every day, 100% less scrolling" - math',
  '"the algorithm can wait, your gains can\'t" - truth',
];

let currentExercise = null;
let timerSeconds = 30;
const baseTimer = 30;
const penaltyIncrement = 30;
let timerInterval = null;
let violationsToday = 0;
let exerciseCompleted = false;
const circumference = 2 * Math.PI * 54;

// Get blocked site name from URL params
const urlParams = new URLSearchParams(window.location.search);
const blockedUrl = urlParams.get('url') || 'https://www.google.com';
const siteName = extractSiteName(blockedUrl);

function extractSiteName(url) {
  try {
    const hostname = new URL(url).hostname;
    const parts = hostname.replace('www.', '').split('.');
    return parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
  } catch {
    return 'this site';
  }
}

async function loadViolations() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(['stats'], (result) => {
      const stats = result.stats || {};
      const todayKey = new Date().toISOString().slice(0, 10);
      violationsToday = (stats.dailyBlocks && stats.dailyBlocks[todayKey]) || 0;
      resolve(violationsToday);
    });
  });
}

async function recordViolation() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(['stats'], (result) => {
      const stats = result.stats || { totalBlockedAttempts: 0, exercisesDone: 0, streak: 0, dailyBlocks: {}, timeSaved: 0 };
      const todayKey = new Date().toISOString().slice(0, 10);

      stats.totalBlockedAttempts = (stats.totalBlockedAttempts || 0) + 1;
      if (!stats.dailyBlocks) stats.dailyBlocks = {};
      stats.dailyBlocks[todayKey] = (stats.dailyBlocks[todayKey] || 0) + 1;
      violationsToday = stats.dailyBlocks[todayKey];

      const baseSaved = 8 + Math.random() * 7;
      const bloatedSaved = baseSaved * 1.17;
      stats.timeSaved = (stats.timeSaved || 0) + bloatedSaved;

      chrome.storage.sync.set({ stats }, resolve);
    });
  });
}

async function recordExercise() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(['stats'], (result) => {
      const stats = result.stats || { totalBlockedAttempts: 0, exercisesDone: 0, streak: 0, dailyBlocks: {}, timeSaved: 0 };
      stats.exercisesDone = (stats.exercisesDone || 0) + 1;

      const todayKey = new Date().toISOString().slice(0, 10);
      const lastActive = stats.lastActiveDate || '';
      const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

      if (lastActive === yesterday) {
        stats.streak = (stats.streak || 0) + 1;
      } else if (lastActive !== todayKey) {
        stats.streak = 1;
      }
      stats.lastActiveDate = todayKey;

      chrome.storage.sync.set({ stats }, resolve);
    });
  });
}

function pickExercise() {
  let exercise;
  do {
    exercise = EXERCISES[Math.floor(Math.random() * EXERCISES.length)];
  } while (exercise === currentExercise && EXERCISES.length > 1);
  currentExercise = exercise;
  return exercise;
}

function showExercise(exercise) {
  document.getElementById('exerciseIcon').textContent = exercise.icon;
  document.getElementById('exerciseEmoji').textContent = exercise.emoji;
  document.getElementById('exerciseName').textContent = exercise.name;
  document.getElementById('exerciseDesc').textContent = exercise.desc;
}

function startTimer() {
  const penaltyMultiplier = Math.max(0, violationsToday - 1);
  timerSeconds = baseTimer + (penaltyMultiplier * penaltyIncrement);

  const totalSeconds = timerSeconds;
  const ringEl = document.getElementById('ringProgress');
  const textEl = document.getElementById('timerText');

  ringEl.style.strokeDasharray = circumference;
  ringEl.style.strokeDashoffset = '0';
  textEl.textContent = timerSeconds;

  if (penaltyMultiplier > 0) {
    const notice = document.getElementById('penaltyNotice');
    notice.classList.remove('hidden');
    document.getElementById('penaltyCount').textContent = penaltyMultiplier;
  }

  timerInterval = setInterval(() => {
    timerSeconds--;
    textEl.textContent = Math.max(0, timerSeconds);

    const progress = (totalSeconds - timerSeconds) / totalSeconds;
    ringEl.style.strokeDashoffset = circumference * (1 - progress);

    if (progress > 0.75) {
      ringEl.style.stroke = '#00e676';
      textEl.style.color = '#00e676';
    } else if (progress > 0.5) {
      ringEl.style.stroke = '#ffd600';
      textEl.style.color = '#ffd600';
    }

    if (timerSeconds <= 0) {
      clearInterval(timerInterval);
      showDonePhase();
    }
  }, 1000);
}

function showDonePhase() {
  exerciseCompleted = true;
  document.getElementById('phaseExercise').classList.add('hidden');
  document.getElementById('phaseDone').classList.remove('hidden');

  const quote = MOTIVATION_QUOTES[Math.floor(Math.random() * MOTIVATION_QUOTES.length)];
  document.getElementById('motivationQuote').textContent = quote;

  recordExercise();
}

function handleProceedClick() {
  if (!exerciseCompleted) return;

  const btn = document.getElementById('proceedBtn');
  btn.disabled = true;
  btn.textContent = 'REDIRECTING...';

  // Grant temporary access
  try {
    chrome.runtime.sendMessage({
      type: 'grantTemporaryAccess',
      url: blockedUrl,
    }, () => {
      // Redirect after a short delay
      window.location.href = blockedUrl;
    });
  } catch (e) {
    // If messaging fails, try redirecting anyway
    window.location.href = blockedUrl;
  }

  // Fallback: redirect after 500ms even if message doesn't complete
  setTimeout(() => {
    window.location.href = blockedUrl;
  }, 500);
}

function handleStayFocusedClick() {
  window.location.href = 'https://www.google.com';
}

function handleRerollClick() {
  const exercise = pickExercise();
  showExercise(exercise);
}

// Emergency Pass Functions
async function checkEmergencyPassUsed() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(['emergencyPassUsedAt'], (result) => {
      const usedAt = result.emergencyPassUsedAt || 0;

      // Pass is "used" if it was used within the last 24 hours
      if (usedAt > 0 && (Date.now() - usedAt) < 24 * 60 * 60 * 1000) {
        resolve(true);
      } else {
        resolve(false);
      }
    });
  });
}

function showEmergencyConfirmModal() {
  const modal = document.createElement('div');
  modal.className = 'emergency-modal';
  modal.id = 'emergencyModal';
  modal.innerHTML = `
    <div class="emergency-modal-content">
      <h2>&#x1F6A8; use emergency pass?</h2>
      <p>this will <strong>permanently unblock ${siteName}</strong> and update your settings. you only get 1 emergency pass every 24 hours.</p>
      <div class="emergency-modal-btns">
        <button class="btn-emergency-cancel" id="emergencyCancelBtn">cancel</button>
        <button class="btn-emergency-confirm" id="emergencyConfirmBtn">unblock</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  document.getElementById('emergencyCancelBtn').onclick = () => {
    modal.remove();
  };

  document.getElementById('emergencyConfirmBtn').onclick = async () => {
    await useEmergencyPass();
    modal.remove();
  };
}

async function useEmergencyPass() {
  const emergencyBtn = document.getElementById('emergencyBtn');
  emergencyBtn.disabled = true;
  emergencyBtn.textContent = 'unblocking...';

  try {
    // Get the hostname to unblock
    const hostname = new URL(blockedUrl).hostname.replace(/^www\./, '');

    // Send message to background to permanently unblock
    chrome.runtime.sendMessage({
      type: 'useEmergencyPass',
      hostname: hostname,
      url: blockedUrl,
    }, (response) => {
      if (response && response.success) {
        // Redirect to the site
        window.location.href = blockedUrl;
      } else {
        emergencyBtn.textContent = 'failed - try again';
        emergencyBtn.disabled = false;
      }
    });
  } catch (e) {
    emergencyBtn.textContent = 'failed - try again';
    emergencyBtn.disabled = false;
  }
}

async function initEmergencyPass() {
  const emergencyBtn = document.getElementById('emergencyBtn');
  const emergencyPass = document.getElementById('emergencyPass');

  if (!emergencyBtn || !emergencyPass) return;

  const used = await checkEmergencyPassUsed();

  if (used) {
    emergencyBtn.disabled = true;
    emergencyBtn.textContent = '&#x1F6A8; emergency pass used';
    emergencyPass.classList.add('used');
    document.querySelector('.emergency-note').textContent = 'already used in the last 24 hours';
  } else {
    emergencyBtn.onclick = showEmergencyConfirmModal;
  }
}

async function init() {
  // Attach event listeners
  const proceedBtn = document.getElementById('proceedBtn');
  const stayFocusedBtn = document.getElementById('stayFocused');
  const rerollBtn = document.getElementById('rerollExercise');

  if (proceedBtn) {
    proceedBtn.onclick = handleProceedClick;
  }
  if (stayFocusedBtn) {
    stayFocusedBtn.onclick = handleStayFocusedClick;
  }
  if (rerollBtn) {
    rerollBtn.onclick = handleRerollClick;
  }

  await loadViolations();
  await recordViolation();

  document.getElementById('violationCount').textContent = violationsToday;

  const el = document.getElementById('blockedSiteName');
  if (el) el.textContent = siteName;

  const exercise = pickExercise();
  showExercise(exercise);

  startTimer();

  // Initialize emergency pass
  initEmergencyPass();
}

// Run init when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
