// Validates all questions/*.json files against the expected schema.
const fs = require('fs');
const path = require('path');

const QUESTIONS_DIR = path.join(__dirname, '..', 'questions');

const SUBJECT_RULES = {
  math: {
    types: ['numeric', 'symbolic'],
    validate(q, errors, idx) {
      if (q.type === 'numeric' && typeof q.answer !== 'number') errors.push(`[${idx}] ${q.id}: numeric answer must be a number`);
      if (q.type === 'symbolic' && typeof q.answer !== 'string') errors.push(`[${idx}] ${q.id}: symbolic answer must be a string`);
    },
  },
  geography: {
    types: ['text', 'population', 'conceptual'],
    validate(q, errors, idx) {
      if (q.type === 'population' && typeof q.answer !== 'number') errors.push(`[${idx}] ${q.id}: population answer must be a number`);
      if ((q.type === 'text' || q.type === 'conceptual') && typeof q.answer !== 'string') errors.push(`[${idx}] ${q.id}: ${q.type} answer must be a string`);
    },
  },
  history: {
    types: ['year', 'text', 'conceptual'],
    validate(q, errors, idx) {
      if (q.type === 'year' && typeof q.answer !== 'number') errors.push(`[${idx}] ${q.id}: year answer must be a number`);
      if ((q.type === 'text' || q.type === 'conceptual') && typeof q.answer !== 'string') errors.push(`[${idx}] ${q.id}: ${q.type} answer must be a string`);
    },
  },
  science: {
    types: ['numeric', 'conceptual', 'categorical'],
    validate(q, errors, idx) {
      if (q.type === 'numeric' && typeof q.answer !== 'number') errors.push(`[${idx}] ${q.id}: numeric answer must be a number`);
      if ((q.type === 'conceptual' || q.type === 'categorical') && typeof q.answer !== 'string') errors.push(`[${idx}] ${q.id}: ${q.type} answer must be a string`);
    },
  },
  language_arts: {
    types: ['language_arts'],
    validate(q, errors, idx) {
      if (typeof q.answer !== 'string') errors.push(`[${idx}] ${q.id}: answer must be a string`);
      if (!['vocabulary', 'grammar', 'literary_device'].includes(q.category)) errors.push(`[${idx}] ${q.id}: invalid category "${q.category}"`);
      if (!Array.isArray(q.acceptableAnswers) || q.acceptableAnswers.length === 0) errors.push(`[${idx}] ${q.id}: missing acceptableAnswers`);
    },
  },
};

let overallOk = true;

for (const [subject, rules] of Object.entries(SUBJECT_RULES)) {
  const file = path.join(QUESTIONS_DIR, subject + '.json');
  if (!fs.existsSync(file)) {
    console.log(`⏳ ${subject}.json — not yet written`);
    overallOk = false;
    continue;
  }
  let data;
  try {
    data = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    console.log(`❌ ${subject}.json — invalid JSON: ${e.message}`);
    overallOk = false;
    continue;
  }
  if (!Array.isArray(data)) {
    console.log(`❌ ${subject}.json — not an array`);
    overallOk = false;
    continue;
  }
  const errors = [];
  const ids = new Set();
  const questionTexts = new Set();
  data.forEach((q, idx) => {
    if (!q.id || ids.has(q.id)) errors.push(`[${idx}] duplicate or missing id: ${q.id}`);
    ids.add(q.id);
    if (!q.question || typeof q.question !== 'string') errors.push(`[${idx}] ${q.id}: missing question text`);
    const qNorm = (q.question || '').trim().toLowerCase();
    if (questionTexts.has(qNorm)) errors.push(`[${idx}] ${q.id}: duplicate question text`);
    questionTexts.add(qNorm);
    if (!rules.types.includes(q.type)) errors.push(`[${idx}] ${q.id}: invalid type "${q.type}"`);
    if (q.answer === undefined || q.answer === null) errors.push(`[${idx}] ${q.id}: missing answer`);
    rules.validate(q, errors, idx);
  });

  const count = data.length;
  const status = count >= 200 && errors.length === 0 ? '✅' : (errors.length > 0 ? '❌' : '⚠️');
  console.log(`${status} ${subject}.json — ${count} questions${count < 200 ? ' (NEEDS >= 200)' : ''}`);
  if (errors.length > 0) {
    overallOk = false;
    console.log(`   ${errors.length} error(s), showing first 10:`);
    errors.slice(0, 10).forEach((e) => console.log('   - ' + e));
  }
}

process.exit(overallOk ? 0 : 1);
