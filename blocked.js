// Dopamine Detox - Blocked Page Controller

const SHAME_PHRASE = 'I am choosing to scroll instead of being productive';
const BASE_REPS = 3;

const MOTIVATION_QUOTES = [
  '"your future self is watching you through memories" - probably tiktok',
  '"touch grass > touch screen" - ancient proverb',
  '"the grind never stops but your doom scrolling should" - sigma wisdom',
  '"1% better every day, 100% less scrolling" - math',
  '"the algorithm can wait, your goals can\'t" - truth',
  '"be the main character of your life, not the feed" - gen z confucius',
  '"average person spends 2.5 hours daily on social media. you\'re built different." - facts',
];

let totalReps = BASE_REPS;
let currentRep = 0;
let challengeCompleted = false;
let violationsToday = 0;

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

async function recordChallenge() {
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

function calculateReps() {
  const extraReps = Math.max(0, violationsToday - 1);
  totalReps = BASE_REPS + extraReps;
  return totalReps;
}

function renderCharDisplay(typed, errorIndex = -1) {
  const charDisplay = document.getElementById('charDisplay');
  let html = '';

  for (let i = 0; i < SHAME_PHRASE.length; i++) {
    const char = SHAME_PHRASE[i] === ' ' ? '&nbsp;' : SHAME_PHRASE[i];
    if (i === errorIndex) {
      html += `<span class="char char-error">${char}</span>`;
    } else if (i < typed.length) {
      html += `<span class="char char-correct">${char}</span>`;
    } else {
      html += `<span class="char char-pending">${char}</span>`;
    }
  }

  charDisplay.innerHTML = html;
}

function completeLine() {
  currentRep++;
  const input = document.getElementById('typingInput');

  // Add completed line to the completed-lines area
  const completedLines = document.getElementById('completedLines');
  const lineDiv = document.createElement('div');
  lineDiv.className = 'completed-line';
  lineDiv.textContent = SHAME_PHRASE;
  completedLines.appendChild(lineDiv);

  if (currentRep >= totalReps) {
    // All reps done
    input.disabled = true;
    showDonePhase();
    return;
  }

  // Reset for next line
  input.value = '';
  renderCharDisplay('');
  document.getElementById('currentLine').textContent = currentRep + 1;
  input.focus();
}

function initTypingChallenge() {
  calculateReps();

  // Show penalty notice if escalation applies
  if (violationsToday > 1) {
    const notice = document.getElementById('penaltyNotice');
    notice.classList.remove('hidden');
    document.getElementById('penaltyCount').textContent = violationsToday - 1;
    document.getElementById('penaltyViolations').textContent = violationsToday;
  }

  document.getElementById('totalLines').textContent = totalReps;
  document.getElementById('currentLine').textContent = 1;

  const input = document.getElementById('typingInput');

  // Render initial char display (all dim)
  renderCharDisplay('');

  // Prevent paste
  input.addEventListener('paste', (e) => e.preventDefault());

  // Prevent drag-and-drop text
  input.addEventListener('drop', (e) => e.preventDefault());

  // Prevent right-click paste
  input.addEventListener('contextmenu', (e) => e.preventDefault());

  // Listen for input changes
  input.addEventListener('input', () => {
    const typed = input.value;

    // Check each character
    for (let i = 0; i < typed.length; i++) {
      if (typed[i] !== SHAME_PHRASE[i]) {
        // Typo detected -- flash red, reset this line
        renderCharDisplay(typed, i);
        input.classList.add('shake');
        setTimeout(() => {
          input.value = '';
          input.classList.remove('shake');
          renderCharDisplay('');
        }, 400);
        return;
      }
    }

    // All typed characters match so far
    renderCharDisplay(typed);

    // Check if line is complete
    if (typed === SHAME_PHRASE) {
      completeLine();
    }
  });

  input.focus();
}

function showDonePhase() {
  challengeCompleted = true;
  document.getElementById('phaseChallenge').classList.add('hidden');
  document.getElementById('phaseDone').classList.remove('hidden');

  const quote = MOTIVATION_QUOTES[Math.floor(Math.random() * MOTIVATION_QUOTES.length)];
  document.getElementById('motivationQuote').textContent = quote;

  recordChallenge();
}

function handleProceedClick() {
  if (!challengeCompleted) return;

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
    emergencyBtn.textContent = '\uD83D\uDEA8 emergency pass used';
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

  if (proceedBtn) {
    proceedBtn.onclick = handleProceedClick;
  }
  if (stayFocusedBtn) {
    stayFocusedBtn.onclick = handleStayFocusedClick;
  }

  await loadViolations();
  await recordViolation();

  document.getElementById('violationCount').textContent = violationsToday;

  const el = document.getElementById('blockedSiteName');
  if (el) el.textContent = siteName;

  initTypingChallenge();

  // Initialize emergency pass
  initEmergencyPass();
}

// Run init when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
