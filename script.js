/**
 * Daily School Quiz — script.js
 * Loads the daily 5 questions, renders the form, scores answers client-side
 * via scoring.js, tracks streaks in localStorage, and builds a shareable
 * text summary.
 */

const SUBJECTS = [
  { key: 'math', label: 'Math', icon: '➗', file: 'questions/math.json' },
  { key: 'geography', label: 'Geography', icon: '🌍', file: 'questions/geography.json' },
  { key: 'history', label: 'History', icon: '📜', file: 'questions/history.json' },
  { key: 'science', label: 'Science', icon: '🔬', file: 'questions/science.json' },
  { key: 'language_arts', label: 'Language Arts', icon: '✍️', file: 'questions/language_arts.json' },
];

const LS_KEYS = {
  username: 'dsq_username',
  lastPlayed: 'dsq_last_played',
  streak: 'dsq_streak',
  resultPrefix: 'dsq_result_',
};

function todayString() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function displayDate() {
  const d = new Date();
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
}

function dateDiffInDays(a, b) {
  const da = new Date(a + 'T00:00:00');
  const db = new Date(b + 'T00:00:00');
  return Math.round((db - da) / (1000 * 60 * 60 * 24));
}

// Deterministic string hash so every visitor gets the same daily question.
function hashString(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) + h) ^ str.charCodeAt(i);
  }
  return Math.abs(h);
}

function pickDailyQuestion(bank, subjectKey, dateStr) {
  const h = hashString(dateStr + ':' + subjectKey);
  return bank[h % bank.length];
}

function scoreNote(score) {
  if (score >= 90) return 'Excellent!';
  if (score >= 70) return 'Great job';
  if (score >= 50) return 'Not bad';
  if (score >= 25) return 'Needs review';
  return 'Keep studying';
}

function scoreClass(score) {
  if (score >= 70) return 'score-good';
  if (score >= 40) return 'score-mid';
  return 'score-bad';
}

async function loadQuestionBanks() {
  const banks = {};
  await Promise.all(
    SUBJECTS.map(async (s) => {
      const res = await fetch(s.file);
      banks[s.key] = await res.json();
    })
  );
  return banks;
}

function updateStreakDisplay() {
  document.getElementById('streak-count').textContent = localStorage.getItem(LS_KEYS.streak) || '0';
}

function registerPlay() {
  const today = todayString();
  const last = localStorage.getItem(LS_KEYS.lastPlayed);
  let streak = parseInt(localStorage.getItem(LS_KEYS.streak) || '0', 10);
  if (last === today) {
    // already counted today
  } else if (last && dateDiffInDays(last, today) === 1) {
    streak += 1;
  } else {
    streak = 1;
  }
  localStorage.setItem(LS_KEYS.lastPlayed, today);
  localStorage.setItem(LS_KEYS.streak, String(streak));
  return streak;
}

function buildShareText(username, date, streak, results, total) {
  const lines = [];
  lines.push(`Daily School Quiz — ${date}`);
  lines.push(`${username}'s Score: ${total}/500 🎓`);
  lines.push('');
  for (const r of results) {
    lines.push(`${r.label}: ${Math.round(r.finalScore)}/100 ${r.icon} ${scoreNote(r.finalScore)}`);
  }
  lines.push('');
  lines.push(`Streak: ${streak} days 🔥`);
  return lines.join('\n');
}

function renderBreakdown(container, results) {
  container.innerHTML = '';
  const total = results.reduce((sum, r) => sum + r.finalScore, 0);
  const totalEl = document.createElement('div');
  totalEl.className = 'total-score';
  totalEl.textContent = `Total: ${Math.round(total)}/500`;
  container.appendChild(totalEl);

  for (const r of results) {
    const item = document.createElement('div');
    item.className = 'breakdown-item';
    item.innerHTML = `
      <div>${r.icon} <strong>${r.label}</strong> — <span class="score ${scoreClass(r.finalScore)}">${Math.round(r.finalScore)}/100</span></div>
      <div class="your-answer">Your answer: ${escapeHtml(r.userAnswer) || '(blank)'}</div>
      <div class="correct-answer">Correct answer: ${escapeHtml(String(r.correctAnswer))}</div>
      <div class="note">Base score: ${r.baseScore} &nbsp;•&nbsp; Typo penalty: −${r.typoPenalty}</div>
      ${r.factNote ? `<div class="note">💡 ${escapeHtml(r.factNote)}</div>` : ''}
    `;
    container.appendChild(item);
  }
  return Math.round(total);
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function renderQuizForm(form, dailyQuestions) {
  form.innerHTML = '';
  SUBJECTS.forEach((s) => {
    const q = dailyQuestions[s.key];
    const block = document.createElement('div');
    block.className = 'question-block';
    block.innerHTML = `
      <div class="q-tag">${s.icon} ${s.label}</div>
      <p class="q-text">${escapeHtml(q.question)}</p>
      <input type="text" name="${s.key}" autocomplete="off" placeholder="Your answer" />
    `;
    form.appendChild(block);
  });
  const submitBtn = document.createElement('button');
  submitBtn.type = 'submit';
  submitBtn.textContent = 'Submit Answers';
  form.appendChild(submitBtn);
}

function scoreAllAnswers(dailyQuestions, answers) {
  return SUBJECTS.map((s) => {
    const q = dailyQuestions[s.key];
    const userAnswer = answers[s.key] || '';
    const { baseScore, typoPenalty, finalScore } = QuizScoring.scoreQuestion(s.key, q, userAnswer);
    return {
      key: s.key,
      label: s.label,
      icon: s.icon,
      userAnswer,
      correctAnswer: q.answer,
      factNote: q.note,
      baseScore,
      typoPenalty,
      finalScore,
    };
  });
}

async function main() {
  document.getElementById('today-date').textContent = displayDate();
  updateStreakDisplay();

  const today = todayString();
  const storedResult = localStorage.getItem(LS_KEYS.resultPrefix + today);
  const nameGate = document.getElementById('name-gate');
  const quizForm = document.getElementById('quiz-form');
  const resultsSection = document.getElementById('results');
  const alreadySection = document.getElementById('already-played');

  const usernameInput = document.getElementById('username-input');
  const savedName = localStorage.getItem(LS_KEYS.username);
  if (savedName) usernameInput.value = savedName;

  if (storedResult) {
    nameGate.classList.add('hidden');
    quizForm.classList.add('hidden');
    resultsSection.classList.add('hidden');
    alreadySection.classList.remove('hidden');
    const data = JSON.parse(storedResult);
    renderBreakdown(document.getElementById('already-breakdown'), data.results);
    document.getElementById('already-share-text').value = data.shareText;
    document.getElementById('already-copy-btn').addEventListener('click', () => {
      navigator.clipboard.writeText(data.shareText);
      const c = document.getElementById('already-copy-confirm');
      c.classList.remove('hidden');
      setTimeout(() => c.classList.add('hidden'), 1500);
    });
    return;
  }

  const banks = await loadQuestionBanks();
  const dailyQuestions = {};
  SUBJECTS.forEach((s) => {
    dailyQuestions[s.key] = pickDailyQuestion(banks[s.key], s.key, today);
  });

  document.getElementById('start-btn').addEventListener('click', () => {
    const username = usernameInput.value.trim() || 'Player';
    localStorage.setItem(LS_KEYS.username, username);
    nameGate.classList.add('hidden');
    quizForm.classList.remove('hidden');
    renderQuizForm(quizForm, dailyQuestions);
  });

  quizForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const formData = new FormData(quizForm);
    const answers = {};
    SUBJECTS.forEach((s) => { answers[s.key] = (formData.get(s.key) || '').toString(); });

    const results = scoreAllAnswers(dailyQuestions, answers);
    const streak = registerPlay();
    updateStreakDisplay();

    quizForm.classList.add('hidden');
    resultsSection.classList.remove('hidden');
    const total = renderBreakdown(document.getElementById('breakdown'), results);

    const username = localStorage.getItem(LS_KEYS.username) || 'Player';
    const shareText = buildShareText(username, displayDate(), streak, results, total);
    document.getElementById('share-text').value = shareText;

    localStorage.setItem(
      LS_KEYS.resultPrefix + today,
      JSON.stringify({ results, shareText })
    );

    document.getElementById('copy-btn').addEventListener('click', () => {
      navigator.clipboard.writeText(shareText);
      const c = document.getElementById('copy-confirm');
      c.classList.remove('hidden');
      setTimeout(() => c.classList.add('hidden'), 1500);
    });
  });
}

main();
