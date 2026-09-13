// Validates questions/boards.json against the survey-board schema.
const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '..', 'questions', 'boards.json');
if (!fs.existsSync(file)) {
  console.log('⏳ boards.json — not yet written');
  process.exit(1);
}

let data;
try {
  data = JSON.parse(fs.readFileSync(file, 'utf8'));
} catch (e) {
  console.log(`❌ boards.json — invalid JSON: ${e.message}`);
  process.exit(1);
}

if (!Array.isArray(data)) {
  console.log('❌ boards.json — not an array');
  process.exit(1);
}

const errors = [];
const ids = new Set();
const prompts = new Set();

data.forEach((board, idx) => {
  if (!board.id || ids.has(board.id)) errors.push(`[${idx}] duplicate or missing id: ${board.id}`);
  ids.add(board.id);
  if (!board.category) errors.push(`[${idx}] ${board.id}: missing category`);
  if (!board.prompt) errors.push(`[${idx}] ${board.id}: missing prompt`);
  const pNorm = (board.prompt || '').trim().toLowerCase();
  if (prompts.has(pNorm)) errors.push(`[${idx}] ${board.id}: duplicate prompt`);
  prompts.add(pNorm);

  if (!Array.isArray(board.answers) || board.answers.length < 5 || board.answers.length > 10) {
    errors.push(`[${idx}] ${board.id}: answers must be an array of 5-10 entries (got ${board.answers ? board.answers.length : 'none'})`);
  } else {
    let lastPoints = Infinity;
    let sum = 0;
    const ranks = new Set();
    board.answers.forEach((a, aIdx) => {
      if (typeof a.rank !== 'number') errors.push(`[${idx}] ${board.id}: answer ${aIdx} missing numeric rank`);
      if (ranks.has(a.rank)) errors.push(`[${idx}] ${board.id}: duplicate rank ${a.rank}`);
      ranks.add(a.rank);
      if (!a.text || typeof a.text !== 'string') errors.push(`[${idx}] ${board.id}: answer ${aIdx} missing text`);
      if (typeof a.points !== 'number' || a.points <= 0) errors.push(`[${idx}] ${board.id}: answer ${aIdx} invalid points`);
      if (a.points >= lastPoints) errors.push(`[${idx}] ${board.id}: points not strictly descending at rank ${a.rank}`);
      lastPoints = a.points;
      sum += a.points || 0;
      if (!Array.isArray(a.acceptableAnswers) || a.acceptableAnswers.length === 0) {
        errors.push(`[${idx}] ${board.id}: answer ${aIdx} missing acceptableAnswers`);
      }
    });
    if (sum !== 100) errors.push(`[${idx}] ${board.id}: points sum to ${sum}, expected 100`);
  }
});

const count = data.length;
const ok = errors.length === 0 && count >= 200;
console.log(`${ok ? '✅' : '❌'} boards.json — ${count} boards`);
if (errors.length > 0) {
  console.log(`   ${errors.length} error(s), showing first 20:`);
  errors.slice(0, 20).forEach((e) => console.log('   - ' + e));
}
if (count < 200) console.log(`   ⚠️  only ${count} boards, want >= 200`);

process.exit(ok ? 0 : 1);
