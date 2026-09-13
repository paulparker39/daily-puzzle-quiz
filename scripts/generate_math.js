// Generates questions/math.json — deterministic (seeded), no external deps.
const fs = require('fs');
const path = require('path');

let seed = 42;
function rnd() {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff;
  return seed / 0x7fffffff;
}
function randInt(min, max) {
  return Math.floor(rnd() * (max - min + 1)) + min;
}
function pick(arr) {
  return arr[Math.floor(rnd() * arr.length)];
}
function gcd(a, b) {
  a = Math.abs(a); b = Math.abs(b);
  while (b) { [a, b] = [b, a % b]; }
  return a || 1;
}
function round2(n) {
  return Math.round(n * 100) / 100;
}

const questions = [];
const seen = new Set();
let counter = 1;

function add(question, type, answer, note, acceptableAnswers) {
  const key = question.trim().toLowerCase();
  if (seen.has(key)) return;
  seen.add(key);
  const id = 'math_' + String(counter++).padStart(3, '0');
  const q = { id, question, type, answer };
  if (acceptableAnswers) q.acceptableAnswers = acceptableAnswers;
  if (note) q.note = note;
  questions.push(q);
}

// 1. Multi-step arithmetic / order of operations (numeric) — ~45
for (let i = 0; i < 45; i++) {
  const a = randInt(2, 20), b = randInt(2, 20), c = randInt(2, 12), d = randInt(2, 9);
  const style = i % 4;
  let question, answer;
  if (style === 0) {
    question = `What is ${a} + ${b} × ${c}?`;
    answer = a + b * c;
  } else if (style === 1) {
    question = `What is (${a} + ${b}) × ${c}?`;
    answer = (a + b) * c;
  } else if (style === 2) {
    question = `What is ${a} × ${d} − ${c}?`;
    answer = a * d - c;
  } else {
    const dd = randInt(2, 9);
    question = `What is ${a * dd} ÷ ${dd} + ${c}?`;
    answer = (a * dd) / dd + c;
  }
  add(question, 'numeric', answer, 'Multiplication and division happen before addition and subtraction.');
}

// 2. Fractions (numeric, decimal answer) — ~35
for (let i = 0; i < 35; i++) {
  const den1 = pick([2, 3, 4, 5, 6, 8, 10]);
  const num1 = randInt(1, den1 - 1);
  const den2 = pick([2, 3, 4, 5, 6, 8, 10]);
  const num2 = randInt(1, den2 - 1);
  const op = pick(['+', '-']);
  let answer;
  if (op === '+') answer = num1 / den1 + num2 / den2;
  else answer = num1 / den1 - num2 / den2;
  answer = round2(answer);
  const question = `What is ${num1}/${den1} ${op} ${num2}/${den2}? Give your answer as a decimal, rounded to 2 decimal places.`;
  add(question, 'numeric', answer, 'Convert fractions to a common denominator before adding or subtracting.');
}

// 3. Percentages (numeric) — ~30
for (let i = 0; i < 30; i++) {
  const pct = pick([5, 10, 15, 20, 25, 30, 40, 50, 60, 75]);
  const base = randInt(4, 40) * 10;
  const style = i % 3;
  let question, answer;
  if (style === 0) {
    question = `What is ${pct}% of ${base}?`;
    answer = round2((pct / 100) * base);
  } else if (style === 1) {
    const whole = base;
    const part = round2((pct / 100) * whole);
    question = `${part} is what percent of ${whole}?`;
    answer = pct;
  } else {
    const price = base;
    const discount = pct;
    question = `A $${price} jacket is on sale for ${discount}% off. What is the sale price in dollars?`;
    answer = round2(price - (discount / 100) * price);
  }
  add(question, 'numeric', answer, 'To find a percentage of a number, multiply by the percent written as a decimal.');
}

// 4. Geometry: area / perimeter / volume (numeric) — ~35
for (let i = 0; i < 35; i++) {
  const style = i % 5;
  let question, answer, note;
  if (style === 0) {
    const l = randInt(3, 20), w = randInt(3, 20);
    question = `What is the area of a rectangle with length ${l} and width ${w}?`;
    answer = l * w;
    note = 'Area of a rectangle = length × width.';
  } else if (style === 1) {
    const l = randInt(3, 20), w = randInt(3, 20);
    question = `What is the perimeter of a rectangle with length ${l} and width ${w}?`;
    answer = 2 * (l + w);
    note = 'Perimeter of a rectangle = 2 × (length + width).';
  } else if (style === 2) {
    const b = randInt(4, 20), h = randInt(3, 20);
    question = `What is the area of a triangle with base ${b} and height ${h}?`;
    answer = round2(0.5 * b * h);
    note = 'Area of a triangle = 1/2 × base × height.';
  } else if (style === 3) {
    const s = randInt(2, 15);
    question = `What is the volume of a cube with side length ${s}?`;
    answer = s * s * s;
    note = 'Volume of a cube = side³.';
  } else {
    const r = randInt(2, 12);
    question = `What is the area of a circle with radius ${r}? Use 3.14 for pi and round to the nearest whole number.`;
    answer = Math.round(3.14 * r * r);
    note = 'Area of a circle = π × radius².';
  }
  add(question, 'numeric', answer, note);
}

// 5. Basic algebra: solve for x (numeric) — ~40
for (let i = 0; i < 40; i++) {
  const x = randInt(-12, 12) || 3;
  const a = randInt(2, 9);
  const b = randInt(1, 20);
  const style = i % 3;
  let question, answer;
  if (style === 0) {
    const c = a * x + b;
    question = `Solve for x: ${a}x + ${b} = ${c}`;
    answer = x;
  } else if (style === 1) {
    const c = a * x - b;
    question = `Solve for x: ${a}x − ${b} = ${c}`;
    answer = x;
  } else {
    const c = a * (x + b);
    question = `Solve for x: ${a}(x + ${b}) = ${c}`;
    answer = x;
  }
  add(question, 'numeric', answer, 'Isolate x by undoing operations in reverse order (inverse operations).');
}

// 6. Exponents & roots (numeric) — ~25
for (let i = 0; i < 25; i++) {
  const style = i % 3;
  let question, answer, note;
  if (style === 0) {
    const base = randInt(2, 12), exp = randInt(2, 3);
    question = `What is ${base}${exp === 2 ? '²' : '³'}?`;
    answer = Math.pow(base, exp);
    note = `An exponent tells you how many times to multiply the base by itself.`;
  } else if (style === 1) {
    const root = randInt(2, 15);
    question = `What is the square root of ${root * root}?`;
    answer = root;
    note = 'The square root of a number x is the value that, multiplied by itself, gives x.';
  } else {
    const base = randInt(2, 10);
    question = `What is ${base} to the power of 0?`;
    answer = 1;
    note = 'Any nonzero number raised to the power of 0 equals 1.';
  }
  add(question, 'numeric', answer, note);
}

// 7. Symbolic simplification / expansion (symbolic) — ~35
for (let i = 0; i < 35; i++) {
  const style = i % 4;
  const a = randInt(2, 9), b = randInt(2, 9), c = randInt(1, 12);
  let question, answer, acceptable;
  if (style === 0) {
    question = `Simplify by combining like terms: ${a}x + ${b}x`;
    answer = `${a + b}x`;
    acceptable = [answer.toLowerCase()];
  } else if (style === 1) {
    question = `Expand: ${a}(x + ${c})`;
    answer = `${a}x + ${a * c}`;
    acceptable = [answer.toLowerCase(), `${a * c} + ${a}x`.toLowerCase()];
  } else if (style === 2) {
    question = `Simplify: ${a}x + ${c} + ${b}x`;
    answer = `${a + b}x + ${c}`;
    acceptable = [answer.toLowerCase(), `${c} + ${a + b}x`.toLowerCase()];
  } else {
    const coeff = a * b;
    question = `Simplify: ${coeff}x ÷ ${a}`;
    answer = `${b}x`;
    acceptable = [answer.toLowerCase()];
  }
  add(question, 'symbolic', answer, 'Combine terms with the same variable by adding their coefficients.', acceptable);
}

fs.writeFileSync(
  path.join(__dirname, '..', 'questions', 'math.json'),
  JSON.stringify(questions, null, 2)
);
console.log(`Wrote ${questions.length} math questions.`);
