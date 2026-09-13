/**
 * Says Daily — script.js
 * Loads today's board, runs the guess/strike game loop, tracks streaks,
 * and builds a shareable text summary.
 */

const MAX_STRIKES = 3;
const BOARD_FILE = 'questions/boards.json';

const LS_KEYS = {
  username: 'sd_username',
  lastPlayed: 'sd_last_played',
  streak: 'sd_streak',
  resultPrefix: 'sd_result_',
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

function hashString(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) + h) ^ str.charCodeAt(i);
  }
  return Math.abs(h);
}

function pickDailyBoard(boards, dateStr) {
  const h = hashString(dateStr + ':board');
  return boards[h % boards.length];
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
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

function renderTiles(container, board, revealedRanks, missedRanks) {
  container.innerHTML = '';
  const sorted = [...board.answers].sort((a, b) => a.rank - b.rank);
  sorted.forEach((ans) => {
    const tile = document.createElement('div');
    const isRevealed = revealedRanks.has(ans.rank);
    const isMissed = missedRanks.has(ans.rank);
    tile.className = 'tile' + (isRevealed ? ' revealed' : '') + (isMissed ? ' missed' : '');
    if (isRevealed || isMissed) {
      tile.innerHTML = `
        <span class="tile-text">${escapeHtml(ans.text)}</span>
        <span class="tile-points">${ans.points}</span>
      `;
    } else {
      tile.innerHTML = `<span class="rank-num">#${ans.rank}</span>`;
    }
    container.appendChild(tile);
  });
}

function buildShareText(username, date, streak, board, score, maxScore, revealedCount, strikeCount) {
  const lines = [];
  lines.push(`Says Daily — ${date}`);
  lines.push(`${username}'s Score: ${score}/${maxScore} 🎤`);
  lines.push('');
  lines.push(`Category: ${board.category}`);
  lines.push(`✅ ${revealedCount}/${board.answers.length} answers revealed`);
  lines.push(`Strikes: ${strikeCount}/${MAX_STRIKES} ❌`);
  lines.push('');
  lines.push(`Streak: ${streak} days 🔥`);
  return lines.join('\n');
}

function revealAllRemaining(board, revealedRanks, missedRanks) {
  board.answers.forEach((ans) => {
    if (!revealedRanks.has(ans.rank)) missedRanks.add(ans.rank);
  });
}

async function loadBoards() {
  const res = await fetch(BOARD_FILE);
  return res.json();
}

function renderStrikes(strikeCount) {
  document.querySelectorAll('.strike').forEach((el, idx) => {
    el.classList.toggle('active', idx < strikeCount);
  });
}

async function main() {
  document.getElementById('today-date').textContent = displayDate();
  updateStreakDisplay();

  const today = todayString();
  const storedResult = localStorage.getItem(LS_KEYS.resultPrefix + today);
  const nameGate = document.getElementById('name-gate');
  const gameSection = document.getElementById('game');
  const resultsSection = document.getElementById('results');
  const alreadySection = document.getElementById('already-played');

  const usernameInput = document.getElementById('username-input');
  const savedName = localStorage.getItem(LS_KEYS.username);
  if (savedName) usernameInput.value = savedName;

  if (storedResult) {
    nameGate.classList.add('hidden');
    gameSection.classList.add('hidden');
    resultsSection.classList.add('hidden');
    alreadySection.classList.remove('hidden');
    const data = JSON.parse(storedResult);
    const revealedRanks = new Set(data.revealedRanks);
    const missedRanks = new Set(data.board.answers.map((a) => a.rank).filter((r) => !revealedRanks.has(r)));
    renderTiles(document.getElementById('already-final-board'), data.board, revealedRanks, missedRanks);
    document.getElementById('already-final-score').textContent = data.score;
    document.getElementById('already-final-max').textContent = data.maxScore;
    document.getElementById('already-share-text').value = data.shareText;
    document.getElementById('already-copy-btn').addEventListener('click', () => {
      navigator.clipboard.writeText(data.shareText);
      const c = document.getElementById('already-copy-confirm');
      c.classList.remove('hidden');
      setTimeout(() => c.classList.add('hidden'), 1500);
    });
    return;
  }

  const boards = await loadBoards();
  const board = pickDailyBoard(boards, today);
  const maxScore = GameEngine.boardMaxPoints(board);

  document.getElementById('start-btn').addEventListener('click', () => {
    const username = usernameInput.value.trim() || 'Player';
    localStorage.setItem(LS_KEYS.username, username);
    nameGate.classList.add('hidden');
    gameSection.classList.remove('hidden');

    document.getElementById('category-badge').textContent = board.category;
    document.getElementById('prompt-text').textContent = board.prompt;
    document.getElementById('score-max').textContent = maxScore;

    const revealedRanks = new Set();
    const missedRanks = new Set();
    let strikeCount = 0;
    let score = 0;

    const boardGrid = document.getElementById('board-grid');
    const guessForm = document.getElementById('guess-form');
    const guessInput = document.getElementById('guess-input');
    const feedback = document.getElementById('feedback');

    renderTiles(boardGrid, board, revealedRanks, missedRanks);
    renderStrikes(strikeCount);

    function endRound() {
      revealAllRemaining(board, revealedRanks, missedRanks);
      renderTiles(boardGrid, board, revealedRanks, missedRanks);
      const streak = registerPlay();
      updateStreakDisplay();

      gameSection.classList.add('hidden');
      resultsSection.classList.remove('hidden');
      document.getElementById('final-score').textContent = score;
      document.getElementById('final-max').textContent = maxScore;
      renderTiles(document.getElementById('final-board'), board, revealedRanks, missedRanks);

      const username2 = localStorage.getItem(LS_KEYS.username) || 'Player';
      const shareText = buildShareText(username2, displayDate(), streak, board, score, maxScore, revealedRanks.size, strikeCount);
      document.getElementById('share-text').value = shareText;

      localStorage.setItem(
        LS_KEYS.resultPrefix + today,
        JSON.stringify({ board, revealedRanks: [...revealedRanks], score, maxScore, shareText })
      );

      document.getElementById('copy-btn').addEventListener('click', () => {
        navigator.clipboard.writeText(shareText);
        const c = document.getElementById('copy-confirm');
        c.classList.remove('hidden');
        setTimeout(() => c.classList.add('hidden'), 1500);
      });
    }

    guessForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const guess = guessInput.value.trim();
      guessInput.value = '';
      if (!guess) return;

      const { result, answer } = GameEngine.evaluateGuess(guess, board, revealedRanks);

      if (result === 'hit') {
        revealedRanks.add(answer.rank);
        score += answer.points;
        document.getElementById('score-value').textContent = score;
        feedback.textContent = `✅ ${answer.text} — ${answer.points} points!`;
        feedback.className = 'feedback hit';
        renderTiles(boardGrid, board, revealedRanks, missedRanks);
        if (revealedRanks.size === board.answers.length) {
          setTimeout(endRound, 700);
        }
      } else if (result === 'duplicate') {
        strikeCount += 1;
        renderStrikes(strikeCount);
        feedback.textContent = `⚠️ Already guessed "${answer.text}"!`;
        feedback.className = 'feedback duplicate';
        if (strikeCount >= MAX_STRIKES) setTimeout(endRound, 700);
      } else {
        strikeCount += 1;
        renderStrikes(strikeCount);
        feedback.textContent = `❌ Not on the board!`;
        feedback.className = 'feedback miss';
        if (strikeCount >= MAX_STRIKES) setTimeout(endRound, 700);
      }
    });
  });
}

main();
