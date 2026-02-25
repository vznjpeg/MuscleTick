// Dopamine Detox Stats Page

const ACHIEVEMENTS = [
  { id: 'first_block', icon: '\uD83C\uDF1F', name: 'First Block', desc: 'Blocked your first site', condition: (s) => s.totalBlockedAttempts >= 1 },
  { id: 'first_workout', icon: '\uD83D\uDCAA', name: 'First Rep', desc: 'Completed your first challenge', condition: (s) => s.exercisesDone >= 1 },
  { id: 'streak_3', icon: '\uD83D\uDD25', name: 'On Fire', desc: '3 day streak', condition: (s) => s.streak >= 3 },
  { id: 'streak_7', icon: '\uD83C\uDFC6', name: 'Week Warrior', desc: '7 day streak', condition: (s) => s.streak >= 7 },
  { id: 'streak_30', icon: '\uD83D\uDC51', name: 'Monthly King', desc: '30 day streak', condition: (s) => s.streak >= 30 },
  { id: 'blocks_10', icon: '\uD83D\uDEE1\uFE0F', name: 'Defender', desc: '10 distractions blocked', condition: (s) => s.totalBlockedAttempts >= 10 },
  { id: 'blocks_50', icon: '\uD83E\uDDF1', name: 'Fortress', desc: '50 distractions blocked', condition: (s) => s.totalBlockedAttempts >= 50 },
  { id: 'blocks_100', icon: '\uD83C\uDFF0', name: 'Unbreakable', desc: '100 distractions blocked', condition: (s) => s.totalBlockedAttempts >= 100 },
  { id: 'exercises_10', icon: '\uD83C\uDFCB\uFE0F', name: 'Dedicated', desc: '10 challenges done', condition: (s) => s.exercisesDone >= 10 },
  { id: 'exercises_50', icon: '\uD83E\uDDBE', name: 'Iron Will', desc: '50 challenges done', condition: (s) => s.exercisesDone >= 50 },
  { id: 'time_60', icon: '\u23F0', name: 'Hour Saver', desc: '1 hour saved', condition: (s) => s.timeSaved >= 60 },
  { id: 'time_300', icon: '\uD83D\uDCF5', name: 'Digital Detox', desc: '5 hours saved', condition: (s) => s.timeSaved >= 300 },
];

const FUN_FACTS = [
  (s) => `You've saved ${formatTime(s.timeSaved)} - that's enough time to learn ${Math.floor(s.timeSaved / 30)} new recipes! \uD83C\uDF73`,
  (s) => `${s.exercisesDone} challenges completed! That's roughly ${s.exercisesDone * 50} characters of self-reflection \uD83D\uDD25`,
  (s) => `You've resisted temptation ${s.totalBlockedAttempts} times. Willpower level: ${getWillpowerLevel(s.totalBlockedAttempts)} \uD83E\uDDE0`,
  (s) => `Time saved: ${formatTime(s.timeSaved)}. That's ${Math.floor(s.timeSaved / 120)} movie's worth of productivity! \uD83C\uDFAC`,
  (s) => `With ${s.streak} day streak, you're in the top ${Math.max(1, 100 - s.streak * 2)}% of focusers! \uD83D\uDCC8`,
  (s) => `${s.exercisesDone} shame phrases typed. Your self-awareness is leveling up! \uD83D\uDE4F`,
  (s) => `Average person spends 2.5 hours daily on social media. You're built different. \uD83D\uDCAA`,
];

function getWillpowerLevel(blocks) {
  if (blocks >= 100) return 'LEGENDARY';
  if (blocks >= 50) return 'EPIC';
  if (blocks >= 25) return 'STRONG';
  if (blocks >= 10) return 'GROWING';
  if (blocks >= 5) return 'AWAKENING';
  return 'STARTING';
}

function formatTime(minutes) {
  if (!minutes || minutes < 1) return '0m';
  if (minutes < 60) return `${Math.round(minutes)}m`;
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return `${h}h ${m}m`;
}

function formatTimeContext(minutes) {
  const hours = minutes / 60;
  if (hours >= 10) return `that's like watching ${Math.floor(hours / 2)} movies`;
  if (hours >= 2) return `that's like reading ${Math.floor(hours / 3)} book chapters`;
  if (minutes >= 30) return `that's like ${Math.floor(minutes / 20)} study sessions`;
  return `keep going, every minute counts!`;
}

function getDayName(offset) {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const date = new Date();
  date.setDate(date.getDate() - offset);
  return days[date.getDay()];
}

function getDateKey(offset) {
  const date = new Date();
  date.setDate(date.getDate() - offset);
  return date.toISOString().slice(0, 10);
}

async function loadStats() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(['stats'], (result) => {
      resolve(result.stats || {
        totalBlockedAttempts: 0,
        exercisesDone: 0,
        streak: 0,
        dailyBlocks: {},
        timeSaved: 0,
      });
    });
  });
}

function renderWeekChart(dailyBlocks) {
  const weekChart = document.getElementById('weekChart');
  weekChart.innerHTML = '';

  const today = getDateKey(0);
  let maxBlocks = 1;

  // Find max for scaling
  for (let i = 6; i >= 0; i--) {
    const key = getDateKey(i);
    const value = dailyBlocks[key] || 0;
    if (value > maxBlocks) maxBlocks = value;
  }

  // Render bars
  for (let i = 6; i >= 0; i--) {
    const key = getDateKey(i);
    const value = dailyBlocks[key] || 0;
    const height = Math.max(4, (value / maxBlocks) * 100);
    const isToday = key === today;

    const dayBar = document.createElement('div');
    dayBar.className = 'day-bar';
    dayBar.innerHTML = `
      <div class="day-value">${value}</div>
      <div class="bar-container">
        <div class="bar-fill ${isToday ? 'today' : ''}" style="height: ${height}%"></div>
      </div>
      <div class="day-label">${getDayName(i)}</div>
    `;
    weekChart.appendChild(dayBar);
  }
}

function renderAchievements(stats) {
  const grid = document.getElementById('achievementsGrid');
  grid.innerHTML = '';

  ACHIEVEMENTS.forEach((ach) => {
    const unlocked = ach.condition(stats);
    const div = document.createElement('div');
    div.className = `achievement ${unlocked ? 'unlocked' : 'locked'}`;
    div.innerHTML = `
      <div class="achievement-icon">${ach.icon}</div>
      <div class="achievement-name">${ach.name}</div>
      <div class="achievement-desc">${ach.desc}</div>
    `;
    grid.appendChild(div);
  });
}

function renderFunFact(stats) {
  const fact = FUN_FACTS[Math.floor(Math.random() * FUN_FACTS.length)](stats);
  document.getElementById('factText').textContent = fact;
}

async function init() {
  const stats = await loadStats();

  // Hero stats
  document.getElementById('totalTimeSaved').textContent = formatTime(stats.timeSaved || 0);
  document.getElementById('timeSavedContext').textContent = formatTimeContext(stats.timeSaved || 0);

  // Grid stats
  document.getElementById('totalBlocks').textContent = stats.totalBlockedAttempts || 0;
  document.getElementById('totalExercises').textContent = stats.exercisesDone || 0;
  document.getElementById('currentStreak').textContent = stats.streak || 0;

  const todayKey = getDateKey(0);
  const todayBlocks = (stats.dailyBlocks && stats.dailyBlocks[todayKey]) || 0;
  document.getElementById('todayBlocks').textContent = todayBlocks;

  // Week chart
  renderWeekChart(stats.dailyBlocks || {});

  // Achievements
  renderAchievements(stats);

  // Fun fact
  renderFunFact(stats);

  // Back link
  document.getElementById('backLink').addEventListener('click', (e) => {
    e.preventDefault();
    window.close();
  });
}

document.addEventListener('DOMContentLoaded', init);
