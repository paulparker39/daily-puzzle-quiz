/**
 * Daily School Quiz — scoring.js
 *
 * Implements the scoring rules: typo penalty (Levenshtein), lenient concept
 * scoring, math partial credit, lenient language-arts scoring, science
 * scoring, and the geography/history subject-specific numeric rules.
 *
 * This is a fully static, client-side implementation. There is no ML model
 * or embeddings API available in a static site, so "semantic similarity" and
 * "synonym similarity" are approximated with a lexical proxy: the maximum of
 * (a) character-level closeness (1 - normalized Levenshtein distance) and
 * (b) word-token overlap (Dice coefficient), evaluated against the correct
 * answer and any curated acceptableAnswers/synonyms attached to each
 * question. This is an approximation of true semantic similarity, chosen so
 * the whole app can run with zero backend/API dependency.
 */

(function (global) {
  // ---------- normalization & string distance ----------

  function normalize(str) {
    return String(str == null ? '' : str)
      .trim()
      .toLowerCase()
      .replace(/[^\w\s./-]/g, '')
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
        curr[j] = Math.min(
          prev[j] + 1,      // deletion
          curr[j - 1] + 1,  // insertion
          prev[j - 1] + cost // substitution
        );
      }
      for (let j = 0; j <= n; j++) prev[j] = curr[j];
    }
    return prev[n];
  }

  // typo_penalty = min(20, 5 * distance)
  function typoPenalty(userRaw, targetRaw) {
    const d = levenshtein(normalize(userRaw), normalize(targetRaw));
    return Math.min(20, 5 * d);
  }

  function charSimilarity(a, b) {
    a = normalize(a);
    b = normalize(b);
    const maxLen = Math.max(a.length, b.length, 1);
    return 1 - levenshtein(a, b) / maxLen;
  }

  function diceTokenSimilarity(a, b) {
    const setA = new Set(normalize(a).split(' ').filter(Boolean));
    const setB = new Set(normalize(b).split(' ').filter(Boolean));
    if (setA.size === 0 && setB.size === 0) return 1;
    let inter = 0;
    setA.forEach((w) => { if (setB.has(w)) inter++; });
    return (2 * inter) / (setA.size + setB.size || 1);
  }

  // Lexical proxy for "semantic similarity" against the best-matching
  // candidate among the correct answer + acceptableAnswers.
  function bestSimilarity(user, answer, acceptableAnswers) {
    const candidates = [String(answer)].concat(acceptableAnswers || []);
    let best = 0;
    let bestCandidate = String(answer);
    for (const cand of candidates) {
      const sim = Math.max(charSimilarity(user, cand), diceTokenSimilarity(user, cand));
      if (sim > best) {
        best = sim;
        bestCandidate = cand;
      }
    }
    return { similarity: best, matchedCandidate: bestCandidate };
  }

  function isExactMatch(user, answer, acceptableAnswers) {
    const u = normalize(user);
    if (u === normalize(answer)) return true;
    return (acceptableAnswers || []).some((a) => normalize(a) === u);
  }

  // ---------- lenient_concept_scoring ----------
  // similarity >= 0.85 -> 80, >= 0.75 -> 60, >= 0.65 -> 40, else 0
  function lenientConceptScoring(user, answer, acceptableAnswers) {
    const { similarity } = bestSimilarity(user, answer, acceptableAnswers);
    if (similarity >= 0.85) return 80;
    if (similarity >= 0.75) return 60;
    if (similarity >= 0.65) return 40;
    return 0;
  }

  // ---------- math_partial_credit ----------
  function normalizeSymbolic(str) {
    return normalize(str).replace(/\*/g, '').replace(/\s+/g, '');
  }

  function mathPartialCredit(question, userAnswer) {
    if (question.type === 'numeric') {
      const user = parseFloat(userAnswer);
      const correct = parseFloat(question.answer);
      if (isNaN(user)) return 0;
      return Math.max(0, 100 - Math.abs(user - correct) * 20);
    }
    // symbolic
    const userNorm = normalizeSymbolic(userAnswer);
    const candidates = [String(question.answer)].concat(question.acceptableAnswers || []);
    const equivalent = candidates.some((c) => normalizeSymbolic(c) === userNorm);
    return equivalent ? 100 : 0;
  }

  // ---------- lenient_language_arts ----------
  const DEVICE_FAMILIES = {
    simile: 'comparison',
    metaphor: 'comparison',
    allusion: 'comparison',
    personification: 'human_qualities',
    symbolism: 'human_qualities',
    hyperbole: 'exaggeration',
    oxymoron: 'exaggeration',
    alliteration: 'sound',
    onomatopoeia: 'sound',
    repetition: 'sound',
    irony: 'meaning_play',
    pun: 'meaning_play',
    idiom: 'meaning_play',
    foreshadowing: 'narrative',
    imagery: 'narrative',
  };

  const POS_SYNONYMS = {
    noun: ['noun', 'naming word'],
    verb: ['verb', 'action word'],
    adjective: ['adjective', 'describing word', 'descriptive word'],
    adverb: ['adverb'],
    pronoun: ['pronoun'],
    preposition: ['preposition'],
    conjunction: ['conjunction', 'connecting word'],
    interjection: ['interjection'],
  };

  function lenientLanguageArts(question, userAnswer) {
    const { similarity } = bestSimilarity(userAnswer, question.answer, question.acceptableAnswers);
    if (similarity >= 0.80) return 80;

    if (question.category === 'grammar' && question.partOfSpeech) {
      const synonyms = POS_SYNONYMS[question.partOfSpeech] || [question.partOfSpeech];
      const u = normalize(userAnswer);
      if (synonyms.some((s) => normalize(s) === u)) return 60;
    }

    if (question.category === 'literary_device' && question.deviceFamily) {
      const u = normalize(userAnswer);
      const userFamily = DEVICE_FAMILIES[u];
      if (userFamily && userFamily === question.deviceFamily) return 60;
    }

    return 0;
  }

  // ---------- science scoring ----------
  function scienceScore(question, userAnswer) {
    if (question.type === 'numeric') {
      const user = parseFloat(userAnswer);
      const correct = parseFloat(question.answer);
      if (isNaN(user)) return 0;
      return Math.max(0, 100 - Math.abs(user - correct) * 10);
    }
    if (question.type === 'categorical') {
      return isExactMatch(userAnswer, question.answer, question.acceptableAnswers) ? 100 : 0;
    }
    // conceptual
    return lenientConceptScoring(userAnswer, question.answer, question.acceptableAnswers);
  }

  // ---------- geography scoring ----------
  function geographyScore(question, userAnswer) {
    if (question.type === 'population') {
      const user = parseFloat(userAnswer);
      const correct = parseFloat(question.answer);
      if (isNaN(user)) return 0;
      if (correct === 0) return user === 0 ? 100 : 0;
      return Math.max(0, 100 - (Math.abs(user - correct) / correct) * 200);
    }
    if (question.type === 'text') {
      if (isExactMatch(userAnswer, question.answer, question.acceptableAnswers)) return 100;
      return lenientConceptScoring(userAnswer, question.answer, question.acceptableAnswers);
    }
    // conceptual
    return lenientConceptScoring(userAnswer, question.answer, question.acceptableAnswers);
  }

  // ---------- history scoring ----------
  function historyScore(question, userAnswer) {
    if (question.type === 'year') {
      const user = parseFloat(userAnswer);
      const correct = parseFloat(question.answer);
      if (isNaN(user)) return 0;
      return Math.max(0, 100 - Math.abs(user - correct) * 5);
    }
    if (question.type === 'text') {
      if (isExactMatch(userAnswer, question.answer, question.acceptableAnswers)) return 100;
      return lenientConceptScoring(userAnswer, question.answer, question.acceptableAnswers);
    }
    // conceptual
    return lenientConceptScoring(userAnswer, question.answer, question.acceptableAnswers);
  }

  // ---------- top-level dispatch ----------
  function baseScore(subject, question, userAnswer) {
    switch (subject) {
      case 'math': return mathPartialCredit(question, userAnswer);
      case 'geography': return geographyScore(question, userAnswer);
      case 'history': return historyScore(question, userAnswer);
      case 'science': return scienceScore(question, userAnswer);
      case 'language_arts': return lenientLanguageArts(question, userAnswer);
      default: throw new Error('Unknown subject: ' + subject);
    }
  }

  // What string should the typo penalty be measured against? For numeric/year
  // types we compare the raw strings (typos in digits still count). For
  // text-like types we compare against whichever candidate answer was the
  // closest match, so a near-miss synonym isn't double-penalized against an
  // unrelated candidate.
  function typoPenaltyTarget(subject, question, userAnswer) {
    const numericTypes = new Set(['numeric', 'population', 'year']);
    if (numericTypes.has(question.type)) {
      return String(question.answer);
    }
    if (question.type === 'symbolic') {
      return String(question.answer);
    }
    const { matchedCandidate } = bestSimilarity(userAnswer, question.answer, question.acceptableAnswers);
    return matchedCandidate;
  }

  function scoreQuestion(subject, question, userAnswer) {
    const base = baseScore(subject, question, userAnswer);
    const target = typoPenaltyTarget(subject, question, userAnswer);
    const penalty = typoPenalty(userAnswer, target);
    const final = Math.max(0, base - penalty);
    return {
      baseScore: Math.round(base * 100) / 100,
      typoPenalty: penalty,
      finalScore: Math.round(final * 100) / 100,
    };
  }

  global.QuizScoring = {
    levenshtein,
    typoPenalty,
    lenientConceptScoring,
    mathPartialCredit,
    lenientLanguageArts,
    scienceScore,
    geographyScore,
    historyScore,
    scoreQuestion,
    normalize,
  };
})(typeof window !== 'undefined' ? window : globalThis);
