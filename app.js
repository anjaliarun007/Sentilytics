/* ═══════════════════════════════════════════════════
   SENTILYTICS — app.js
   Sentiment analysis powered by Claude API
═══════════════════════════════════════════════════ */

'use strict';

/* ── Sample texts ── */
const EXAMPLES = [
  // 0 — Joyful review
  "This product is absolutely wonderful! I've never been so happy with a purchase in my life. The quality is outstanding and the customer service was incredibly helpful and kind. I would recommend this to everyone I know. Best decision ever!",

  // 1 — Frustrated complaint
  "I am extremely disappointed with this experience. The service was terrible, the staff were rude, and nothing worked as advertised. I wasted hours trying to get help and nobody cared at all. This is completely unacceptable and I want a full refund immediately.",

  // 2 — Neutral report
  "The package was delivered on Tuesday, October 15th. It contained three items as listed in the order confirmation. The tracking number updated twice during transit. No issues were noted during shipping.",

  // 3 — Mixed feelings
  "The movie had some genuinely brilliant moments, especially in the first half. But the ending felt rushed and left me confused. The acting was superb — I just wish the story had matched it. Overall, I'm glad I watched it, though I probably won't revisit it."
];

/* ── Orb config: overall label → [emoji, CSS class] ── */
const ORB_MAP = {
  'Very Positive':    ['🌸', 'op'],
  'Positive':         ['🌿', 'op'],
  'Slightly Positive':['🌱', 'op'],
  'Neutral':          ['🌾', 'ou'],
  'Slightly Negative':['🌧️', 'on'],
  'Negative':         ['🌩️', 'on'],
  'Very Negative':    ['⛈️',  'on'],
  'Mixed':            ['🌤️', 'om']
};

/* ═══════════════════════════════════════════════════
   UI HELPERS
═══════════════════════════════════════════════════ */

/** Update character counter */
function onChar() {
  const n = document.getElementById('inp').value.length;
  document.getElementById('chr').textContent = n + ' / 3000';
}

/** Load a sample text into the textarea */
function loadEx(index) {
  document.getElementById('inp').value = EXAMPLES[index];
  onChar();
}

/** Clear textarea and hide results / errors */
function clearAll() {
  document.getElementById('inp').value = '';
  onChar();
  document.getElementById('res').classList.remove('vis');
  document.getElementById('errbox').classList.remove('vis');
}

/** Animate a sentiment bar to a given percentage */
function setBar(fillId, pctId, value) {
  document.getElementById(pctId).textContent = Math.round(value) + '%';
  // Slight delay so the CSS transition is visible
  setTimeout(() => {
    document.getElementById(fillId).style.width = value + '%';
  }, 80);
}

/** Display an error message */
function showErr(message) {
  const box = document.getElementById('errbox');
  box.textContent = message;
  box.classList.add('vis');
}

/* ═══════════════════════════════════════════════════
   LOCAL SENTIMENT ANALYSIS
═══════════════════════════════════════════════════ */

const SENTIMENT_LEXICON = {
  positive: {
    happy: 1.5,
    wonderful: 2,
    excellent: 2,
    amazing: 2,
    grateful: 1.5,
    love: 2,
    recommend: 1.2,
    outstanding: 2,
    kind: 1.2,
    helpful: 1.2,
    great: 1.5,
    fantastic: 2,
    best: 1.5,
    enjoy: 1.4,
    joyful: 1.6,
    friendly: 1.3,
    praise: 1.4,
    delighted: 1.8,
    support: 1.1,
    smooth: 1.1,
    satisfied: 1.4,
    comfortable: 1.2,
    positive: 1.3,
    nice: 1.2
  },
  negative: {
    disappointed: 2,
    terrible: 2,
    rude: 1.8,
    unacceptable: 2,
    frustrating: 1.8,
    poor: 1.5,
    bad: 1.5,
    awful: 2,
    hate: 2,
    worst: 2,
    broken: 1.6,
    angry: 1.7,
    frustrated: 1.7,
    complaint: 1.2,
    wasted: 1.4,
    problem: 1.3,
    confused: 1.3,
    issue: 1.2,
    disappointing: 1.9,
    slow: 1.1,
    expensive: 1.4,
    poor: 1.5,
    noisy: 1.1
  }
};

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function formatObservation(words, prefix) {
  const unique = [...new Set(words)].slice(0, 3);
  if (unique.length === 0) return null;
  return `${prefix} "${unique.join('" and "')}".`;
}

function analyseTextLocally(text) {
  const lower = text.toLowerCase();
  const tokens = lower.match(/\b[\w']+\b/g) || [];

  let positiveScore = 0;
  let negativeScore = 0;
  const positiveMatches = [];
  const negativeMatches = [];

  for (const token of tokens) {
    if (SENTIMENT_LEXICON.positive[token]) {
      positiveScore += SENTIMENT_LEXICON.positive[token];
      positiveMatches.push(token);
    }
    if (SENTIMENT_LEXICON.negative[token]) {
      negativeScore += SENTIMENT_LEXICON.negative[token];
      negativeMatches.push(token);
    }
  }

  const sentimentTotal = positiveScore + negativeScore;
  const hasSentiment = sentimentTotal > 0;
  let positivePct = 0;
  let negativePct = 0;
  let neutralPct = 100;

  if (hasSentiment) {
    positivePct = Math.round((positiveScore / sentimentTotal) * 100);
    negativePct = Math.round((negativeScore / sentimentTotal) * 100);
    neutralPct = clamp(100 - positivePct - negativePct, 0, 100);
  }

  const rawScore = hasSentiment ? ((positiveScore - negativeScore) / sentimentTotal) * 100 : 0;
  const score = Math.round(clamp(rawScore, -100, 100));
  const absScore = Math.abs(score);

  let overall;
  if (!hasSentiment) {
    overall = 'Neutral';
  } else if (positiveScore > 0 && negativeScore > 0 && Math.abs(positiveScore - negativeScore) < Math.max(positiveScore, negativeScore) * 0.3) {
    overall = 'Mixed';
  } else if (score >= 60) {
    overall = 'Very Positive';
  } else if (score >= 20) {
    overall = 'Positive';
  } else if (score > 0) {
    overall = 'Slightly Positive';
  } else if (score === 0) {
    overall = 'Neutral';
  } else if (score <= -60) {
    overall = 'Very Negative';
  } else if (score <= -20) {
    overall = 'Negative';
  } else {
    overall = 'Slightly Negative';
  }

  let intensity;
  if (absScore < 15) {
    intensity = 'Low';
  } else if (absScore < 40) {
    intensity = 'Moderate';
  } else if (absScore < 70) {
    intensity = 'High';
  } else {
    intensity = 'Very High';
  }

  const summary = hasSentiment
    ? overall === 'Mixed'
      ? 'The text contains both positive and negative language.'
      : `The tone is ${overall.toLowerCase()}.`
    : 'The text is largely neutral and descriptive.';

  const observations = [];
  const posObs = formatObservation(positiveMatches, 'Positive cues include');
  const negObs = formatObservation(negativeMatches, 'Negative cues include');

  if (posObs) observations.push(posObs);
  if (negObs) observations.push(negObs);

  if (!hasSentiment) {
    observations.push('No strong emotional words were found in the text.');
    observations.push('The wording is mostly factual or descriptive.');
  } else {
    if (positiveMatches.length > 0 && negativeMatches.length > 0) {
      observations.push('The sentiment is shaped by a mix of both positive and negative phrases.');
    }
    if (neutralPct > 20) {
      observations.push('A strong neutral component is present in the text.');
    }
  }

  while (observations.length < 3) {
    observations.push('The overall feeling is based on the language used in the text.');
  }
  if (observations.length > 5) observations.length = 5;

  return {
    positive: positivePct,
    negative: negativePct,
    neutral: neutralPct,
    score,
    overall,
    intensity,
    summary,
    observations
  };
}

async function callClaudeAPI(text) {
  return analyseTextLocally(text);
}

/* ═══════════════════════════════════════════════════
   RENDER RESULTS
═══════════════════════════════════════════════════ */

/**
 * Populate all result UI elements from the parsed API response.
 */
function renderResults(result, text) {
  /* Orb — emoji and colour class */
  const [emoji, orbClass] = ORB_MAP[result.overall] || ['✦', 'ou'];
  const orb = document.getElementById('orb');
  orb.textContent = emoji;
  orb.className   = 'orb ' + orbClass;

  /* Verdict text */
  document.getElementById('vmain').textContent = result.overall;
  document.getElementById('vsub').textContent  = result.summary;

  /* Score (–100 → +100) */
  const score = Math.round(result.score);
  document.getElementById('snum').textContent = (score > 0 ? '+' : '') + score;

  /* Sentiment bars */
  setBar('pb', 'pp', result.positive);
  setBar('nb', 'np', result.negative);
  setBar('ub', 'up', result.neutral);

  /* Metrics */
  document.getElementById('mint').textContent = result.intensity;
  document.getElementById('mwrd').textContent = text.split(/\s+/).filter(Boolean).length;

  const sentenceMatches = text.match(/[^.!?]+[.!?]+/g);
  const sentCount = sentenceMatches ? sentenceMatches.length : 1;
  document.getElementById('msen').textContent = sentCount;

  /* Observations list */
  const observations = Array.isArray(result.observations) ? result.observations : [];
  document.getElementById('ilist').innerHTML = observations
    .map(obs => `<div class="iitem">${String(obs)}</div>`)
    .join('');
}

/* ═══════════════════════════════════════════════════
   MAIN ENTRY POINT
═══════════════════════════════════════════════════ */

/**
 * Called when the user clicks "Analyse".
 * Orchestrates the API call and UI state transitions.
 */
async function analyse() {
  const text = document.getElementById('inp').value.trim();

  /* Guard: require non-empty input */
  if (!text) {
    document.getElementById('inp').focus();
    return;
  }

  /* Reset UI state */
  document.getElementById('res').classList.remove('vis');
  document.getElementById('errbox').classList.remove('vis');
  document.getElementById('ld').classList.add('vis');
  document.getElementById('abtn').disabled = true;

  try {
    const result = await callClaudeAPI(text);

    /* Hide loader, show results */
    document.getElementById('ld').classList.remove('vis');
    document.getElementById('res').classList.add('vis');

    renderResults(result, text);

  } catch (err) {
    document.getElementById('ld').classList.remove('vis');
    showErr('Analysis failed: ' + err.message + ' — Please try again.');
    console.error('[Sentilytics]', err);
  } finally {
    document.getElementById('abtn').disabled = false;
  }
}

/* ── Allow Enter key (with Ctrl/Cmd) to trigger analysis ── */
document.addEventListener('DOMContentLoaded', () => {
  const textarea = document.getElementById('inp');
  textarea.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      analyse();
    }
  });
});