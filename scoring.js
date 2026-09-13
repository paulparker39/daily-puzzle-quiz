/**
 * America Says — scoring.js
 *
 * Matches a free-text guess against a board's ranked answer list. Typos are
 * tolerated via Levenshtein-based character similarity, and each answer can
 * carry a curated list of acceptable synonyms/aliases (acceptableAnswers).
 */

(function (global) {
  function normalize(str) {
    return String(str == null ? '' : str)
      .trim()
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function levenshtein(a, b) {
    a = String(a);
    b = String(b);
    const m = a.length, n = b.length;
    if (m === 0) return n;
    if (n === 0) return m;
    const prev = new Array(n + 1);
    const curr = new Array(n + 1);
    for (let j = 0; j <= n; j++) prev[j] = j;
    for (let i = 1; i <= m; i++) {
      curr[0] = i;
      for (let j = 1; j <= n; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
      }
      for (let j = 0; j <= n; j++) prev[j] = curr[j];
    }
    return prev[n];
  }

  function charSimilarity(a, b) {
    a = normalize(a);
    b = normalize(b);
    const maxLen = Math.max(a.length, b.length, 1);
    return 1 - levenshtein(a, b) / maxLen;
  }

  const FUZZY_THRESHOLD = 0.82;

  // Best-matching answer among a set of board answers (by rank), or null.
  function bestMatch(guessRaw, answers) {
    const guess = normalize(guessRaw);
    if (!guess) return null;
    let best = null;
    let bestScore = 0;
    for (const ans of answers) {
      const candidates = [ans.text].concat(ans.acceptableAnswers || []);
      for (const c of candidates) {
        const cn = normalize(c);
        if (!cn) continue;
        if (cn === guess) return ans; // exact match short-circuits
        const sim = charSimilarity(guess, cn);
        if (sim > bestScore) {
          bestScore = sim;
          best = ans;
        }
      }
    }
    return bestScore >= FUZZY_THRESHOLD ? best : null;
  }

  // Evaluate a guess against the board's current reveal state.
  // Returns { result: 'hit' | 'duplicate' | 'miss', answer? }
  function evaluateGuess(guessRaw, board, revealedRanks) {
    const revealed = board.answers.filter((a) => revealedRanks.has(a.rank));
    const unrevealed = board.answers.filter((a) => !revealedRanks.has(a.rank));

    const dup = bestMatch(guessRaw, revealed);
    if (dup) return { result: 'duplicate', answer: dup };

    const hit = bestMatch(guessRaw, unrevealed);
    if (hit) return { result: 'hit', answer: hit };

    return { result: 'miss' };
  }

  function boardMaxPoints(board) {
    return board.answers.reduce((sum, a) => sum + a.points, 0);
  }

  global.GameEngine = {
    normalize,
    levenshtein,
    charSimilarity,
    bestMatch,
    evaluateGuess,
    boardMaxPoints,
  };
})(typeof window !== 'undefined' ? window : globalThis);
