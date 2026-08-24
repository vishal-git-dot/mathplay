/* ============================================================
   MathPlay — app logic
   Every question is generated procedurally, so the pool of
   possible problems is effectively unlimited for each category.
   ============================================================ */

(function(){
  "use strict";

  /* ---------------- utilities ---------------- */
  function randInt(min, max){ return Math.floor(Math.random() * (max - min + 1)) + min; }
  function pick(arr){ return arr[randInt(0, arr.length - 1)]; }
  function gcd(a, b){ return b === 0 ? a : gcd(b, a % b); }
  function formatTime(totalSeconds){
    const s = Math.max(0, Math.floor(totalSeconds));
    const m = Math.floor(s / 60);
    const r = s % 60;
    return m + ":" + String(r).padStart(2, "0");
  }

  /* ---------------- question generators ---------------- */
  // Each generator returns:
  // { kind: 'equation'|'question', left, text, answer, explain, sig }

  function genAddition(diff){
    let a, b, c = null;
    if (diff === "easy"){ a = randInt(1, 20); b = randInt(1, 20); }
    else if (diff === "medium"){ a = randInt(10, 100); b = randInt(10, 100); }
    else {
      if (Math.random() < 0.35){ a = randInt(10, 90); b = randInt(10, 90); c = randInt(10, 90); }
      else { a = randInt(100, 999); b = randInt(100, 999); }
    }
    const answer = c !== null ? a + b + c : a + b;
    const left = c !== null ? `${a} + ${b} + ${c} =` : `${a} + ${b} =`;
    const explain = c !== null ? `${a} + ${b} + ${c} = ${answer}` : `${a} + ${b} = ${answer}`;
    return { kind: "equation", left, answer, explain, sig: `add-${a}-${b}-${c}` };
  }

  function genSubtraction(diff){
    let a, b;
    if (diff === "easy"){ a = randInt(5, 20); b = randInt(1, a); }
    else if (diff === "medium"){ a = randInt(30, 150); b = randInt(1, a); }
    else { a = randInt(150, 999); b = randInt(50, a); }
    const answer = a - b;
    return { kind: "equation", left: `${a} − ${b} =`, answer, explain: `${a} − ${b} = ${answer}`, sig: `sub-${a}-${b}` };
  }

  function genMultiplication(diff){
    let a, b;
    if (diff === "easy"){ a = randInt(1, 10); b = randInt(1, 10); }
    else if (diff === "medium"){ a = randInt(2, 20); b = randInt(2, 12); }
    else { a = randInt(11, 99); b = randInt(11, 99); }
    const answer = a * b;
    return { kind: "equation", left: `${a} × ${b} =`, answer, explain: `${a} × ${b} = ${answer}`, sig: `mul-${a}-${b}` };
  }

  function genDivision(diff){
    let divisor, quotient;
    if (diff === "easy"){ divisor = randInt(1, 10); quotient = randInt(1, 10); }
    else if (diff === "medium"){ divisor = randInt(2, 12); quotient = randInt(2, 20); }
    else { divisor = randInt(2, 25); quotient = randInt(10, 50); }
    const dividend = divisor * quotient;
    return { kind: "equation", left: `${dividend} ÷ ${divisor} =`, answer: quotient, explain: `${dividend} ÷ ${divisor} = ${quotient}`, sig: `div-${dividend}-${divisor}` };
  }

  const PCT_EASY = [5, 10, 20, 25, 50, 75, 100];
  const PCT_MED  = [5, 10, 15, 20, 25, 30, 40, 50, 60, 70, 75, 80, 90];
  const PCT_HARD = PCT_MED.concat([12, 35, 45, 55, 65, 85, 95]);

  function cleanBase(p, maxK){
    const denom = 100 / gcd(p, 100);
    const k = randInt(1, maxK);
    return denom * k;
  }

  function genPercentage(diff){
    let pool, maxK;
    if (diff === "easy"){ pool = PCT_EASY; maxK = 4; }
    else if (diff === "medium"){ pool = PCT_MED; maxK = 6; }
    else { pool = PCT_HARD; maxK = 9; }

    const p = pick(pool);
    let base = cleanBase(p, maxK);
    if (diff === "hard") base *= randInt(1, 3);
    const result = Math.round((p / 100) * base);

    let type = "A";
    if (diff !== "easy"){
      const r = Math.random();
      type = r < 0.6 ? "A" : (r < 0.85 ? "B" : "C");
    }

    if (type === "A"){
      return { kind: "question", text: `What is ${p}% of ${base}?`, answer: result, explain: `${p}% of ${base} = ${result}`, sig: `pctA-${p}-${base}` };
    } else if (type === "B"){
      return { kind: "question", text: `${result} is what percent of ${base}?`, answer: p, explain: `${result} ÷ ${base} × 100 = ${p}%`, sig: `pctB-${p}-${base}` };
    } else {
      return { kind: "question", text: `${p}% of a number is ${result}. What is the number?`, answer: base, explain: `${result} ÷ ${p}% = ${base}`, sig: `pctC-${p}-${base}` };
    }
  }

  function genMixed(diff){
    const gens = [genAddition, genSubtraction, genMultiplication, genDivision, genPercentage];
    return pick(gens)(diff);
  }

  const CATEGORY_META = {
    addition:       { name: "Addition",        symbol: "+", gen: genAddition,       tip: "Tip: Add the tens first, then the ones." },
    subtraction:    { name: "Subtraction",     symbol: "−", gen: genSubtraction,    tip: "Tip: Round the number you're subtracting, then adjust." },
    multiplication: { name: "Multiplication",  symbol: "×", gen: genMultiplication, tip: "Tip: Break big numbers into tens and ones, then combine." },
    division:       { name: "Division",        symbol: "÷", gen: genDivision,       tip: "Tip: Ask \u2018what times the divisor gets close to this?\u2019" },
    percentage:     { name: "Percentages",     symbol: "%", gen: genPercentage,     tip: "Tip: Find 10% first — it's just moving the decimal point." },
    mixed:          { name: "Mixed Challenge", symbol: "✦", gen: genMixed,          tip: "Tip: Read the symbol first so you know which skill to use." }
  };

  const TIMER_SECONDS = { easy: 15, medium: 12, hard: 9 };

  function generateUnique(genFn, diff, askedSet, maxTries){
    let q;
    for (let i = 0; i < (maxTries || 15); i++){
      q = genFn(diff);
      if (!askedSet.has(q.sig)){ askedSet.add(q.sig); return q; }
    }
    askedSet.add(q.sig + "-" + Math.random());
    return q;
  }

  /* ---------------- DOM references ---------------- */
  const $ = (id) => document.getElementById(id);

  const el = {
    body: document.body,
    navChip: $("navStatsChip"),
    categories: $("categories"),
    heroCta: $("heroCta"),
    categoriesTitle: $("categoriesTitle"),

    setupBack: $("setupBack"),
    setupIcon: $("setupIcon"),
    setupTitle: $("setupTitle"),
    setupMode: $("setupMode"),
    setupTip: $("setupTip"),
    difficultyRow: $("difficultyRow"),
    countGroup: $("countGroup"),
    countRow: $("countRow"),
    startBtn: $("startBtn"),

    exitPlayBtn: $("exitPlayBtn"),
    playProgress: $("playProgress"),
    playTimerWrap: $("playTimerWrap"),
    timerRingFg: $("timerRingFg"),
    timerText: $("timerText"),
    progressBarTrack: $("progressBarTrack"),
    progressBarFill: $("progressBarFill"),
    practiceStats: $("practiceStats"),
    statSolved: $("statSolved"),
    statAccuracy: $("statAccuracy"),
    statStreak: $("statStreak"),
    statTime: $("statTime"),
    promptCard: $("promptCard"),
    questionText: $("questionText"),
    equationRow: $("equationRow"),
    eqLeft: $("eqLeft"),
    answerInput: $("answerInput"),
    feedbackText: $("feedbackText"),
    submitBtn: $("submitBtn"),
    nextBtn: $("nextBtn"),
    quizStreak: $("quizStreak"),
    quizStreakVal: $("quizStreakVal"),

    resultsHeadline: $("resultsHeadline"),
    resultsSub: $("resultsSub"),
    scoreLabel: $("scoreLabel"),
    resultScore: $("resultScore"),
    resultAccuracy: $("resultAccuracy"),
    resultStreak: $("resultStreak"),
    resultTime: $("resultTime"),
    playAgainBtn: $("playAgainBtn"),
    chooseCatBtn: $("chooseCatBtn"),
    confettiLayer: $("confettiLayer"),

    reelA: $("reelA"), reelOp: $("reelOp"), reelB: $("reelB"), reelResult: $("reelResult")
  };

  const CIRCUM = 2 * Math.PI * 26;

  /* ---------------- global (session) stats ---------------- */
  const globalStats = { solved: 0, correct: 0 };
  function updateNavChip(){
    const acc = globalStats.solved ? Math.round((globalStats.correct / globalStats.solved) * 100) : 0;
    el.navChip.textContent = `Solved ${globalStats.solved} · ${acc}% accuracy`;
  }

  /* ---------------- app state ---------------- */
  const state = {
    category: "addition",
    mode: "practice",
    difficulty: "medium",
    totalQuestions: 15,
    index: 0,
    score: 0,
    streak: 0,
    bestStreak: 0,
    askedSigs: new Set(),
    current: null,
    locked: false,
    sessionSolved: 0,
    sessionCorrect: 0,
    startTs: 0,
    questionTimerId: null,
    tickId: null,
    timeLeft: 0
  };

  /* ---------------- screen navigation ---------------- */
  function showScreen(name){
    document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
    const target = document.querySelector(`.screen[data-screen="${name}"]`);
    if (target) target.classList.add("active");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  /* ---------------- setup screen ---------------- */
  function openSetup(category, mode){
    state.category = category;
    state.mode = mode;
    el.body.setAttribute("data-cat", category);

    const meta = CATEGORY_META[category];
    el.setupIcon.textContent = meta.symbol;
    el.setupTitle.textContent = meta.name;
    el.setupMode.textContent = mode === "quiz" ? "Timed quiz" : "Practice mode";
    el.setupTip.textContent = meta.tip;
    el.startBtn.textContent = mode === "quiz" ? "Start Quiz" : "Start Practicing";
    el.countGroup.hidden = mode !== "quiz";

    showScreen("setup");
  }

  function setupOptionRow(row, onSelect){
    row.querySelectorAll(".option-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        row.querySelectorAll(".option-btn").forEach(b => b.classList.remove("selected"));
        btn.classList.add("selected");
        onSelect(btn.dataset.value);
      });
    });
  }
  setupOptionRow(el.difficultyRow, (v) => { state.difficulty = v; });
  setupOptionRow(el.countRow, (v) => { state.totalQuestions = parseInt(v, 10); });

  el.setupBack.addEventListener("click", () => {
    showScreen("home");
    el.categoriesTitle.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  el.startBtn.addEventListener("click", startSession);

  /* ---------------- category card wiring ---------------- */
  el.categories.querySelectorAll(".cat-card").forEach(card => {
    const category = card.dataset.category;
    card.querySelectorAll("button[data-mode]").forEach(btn => {
      btn.addEventListener("click", () => openSetup(category, btn.dataset.mode));
    });
  });

  el.heroCta.addEventListener("click", () => {
    el.categoriesTitle.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  /* ---------------- session lifecycle ---------------- */
  function startSession(){
    state.index = 0;
    state.score = 0;
    state.streak = 0;
    state.bestStreak = 0;
    state.sessionSolved = 0;
    state.sessionCorrect = 0;
    state.askedSigs = new Set();
    state.startTs = Date.now();
    state.locked = false;

    const isQuiz = state.mode === "quiz";
    el.playProgress.hidden = !isQuiz;
    el.playTimerWrap.hidden = !isQuiz;
    el.progressBarTrack.hidden = !isQuiz;
    el.practiceStats.hidden = isQuiz;
    el.quizStreak.hidden = !isQuiz;
    el.progressBarFill.style.width = "0%";

    clearInterval(state.tickId);
    state.tickId = setInterval(tick, 1000);

    showScreen("play");
    nextQuestion();
  }

  function tick(){
    if (state.mode !== "practice") return;
    const elapsed = (Date.now() - state.startTs) / 1000;
    el.statTime.textContent = formatTime(elapsed);
  }

  function nextQuestion(){
    if (state.mode === "quiz" && state.index >= state.totalQuestions){
      finishSession();
      return;
    }
    state.locked = false;
    const meta = CATEGORY_META[state.category];
    state.current = generateUnique(meta.gen, state.difficulty, state.askedSigs);
    state.index += 1;

    renderQuestion();

    if (state.mode === "quiz"){
      el.playProgress.textContent = `Question ${state.index} of ${state.totalQuestions}`;
      el.progressBarFill.style.width = `${((state.index - 1) / state.totalQuestions) * 100}%`;
      startQuestionTimer(TIMER_SECONDS[state.difficulty]);
    }

    el.submitBtn.hidden = false;
    el.nextBtn.hidden = true;
    el.answerInput.disabled = false;
    el.answerInput.value = "";
    el.answerInput.focus();
  }

  function renderQuestion(){
    const q = state.current;
    el.promptCard.classList.remove("state-correct", "state-wrong");
    el.feedbackText.textContent = "";
    el.feedbackText.className = "feedback";

    if (q.kind === "equation"){
      el.questionText.hidden = true;
      el.eqLeft.textContent = q.left;
    } else {
      el.questionText.hidden = false;
      el.questionText.textContent = q.text;
      el.eqLeft.textContent = "";
    }
  }

  /* ---------------- per-question timer (quiz) ---------------- */
  function startQuestionTimer(seconds){
    clearInterval(state.questionTimerId);
    state.timeLeft = seconds;
    el.timerRingFg.style.strokeDasharray = CIRCUM;
    el.timerRingFg.style.strokeDashoffset = 0;
    el.timerText.textContent = seconds;
    el.playTimerWrap.classList.remove("urgent");

    state.questionTimerId = setInterval(() => {
      state.timeLeft -= 1;
      const ratio = Math.max(0, state.timeLeft / seconds);
      el.timerRingFg.style.strokeDashoffset = CIRCUM * (1 - ratio);
      el.timerText.textContent = Math.max(0, state.timeLeft);
      if (state.timeLeft <= 3) el.playTimerWrap.classList.add("urgent");

      if (state.timeLeft <= 0){
        clearInterval(state.questionTimerId);
        handleSubmit(true);
      }
    }, 1000);
  }

  /* ---------------- answer handling ---------------- */
  function handleSubmit(isTimeout){
    if (state.locked) return;
    const raw = el.answerInput.value.trim();
    if (!isTimeout && raw === ""){
      el.answerInput.focus();
      el.promptCard.classList.add("state-wrong");
      setTimeout(() => el.promptCard.classList.remove("state-wrong"), 400);
      return;
    }

    state.locked = true;
    clearInterval(state.questionTimerId);

    const userVal = Number(raw);
    const isCorrect = !isTimeout && userVal === state.current.answer;

    globalStats.solved += 1;
    if (isCorrect) globalStats.correct += 1;
    updateNavChip();

    state.sessionSolved += 1;
    if (isCorrect){
      state.sessionCorrect += 1;
      state.score += 1;
      state.streak += 1;
      state.bestStreak = Math.max(state.bestStreak, state.streak);
    } else {
      state.streak = 0;
    }

    el.statStreak.textContent = state.streak;
    el.quizStreakVal.textContent = state.streak;
    if (state.mode === "practice"){
      el.statSolved.textContent = state.sessionSolved;
      const acc = Math.round((state.sessionCorrect / state.sessionSolved) * 100);
      el.statAccuracy.textContent = acc + "%";
    }

    el.answerInput.disabled = true;

    if (isCorrect){
      el.promptCard.classList.add("state-correct");
      el.feedbackText.textContent = "Correct!";
      el.feedbackText.className = "feedback is-correct";
    } else {
      el.promptCard.classList.add("state-wrong");
      const prefix = isTimeout ? "Time's up — it was " : "Not quite — it was ";
      el.feedbackText.textContent = prefix + state.current.answer + ".";
      el.feedbackText.className = "feedback is-wrong";
    }

    if (state.mode === "practice"){
      el.feedbackText.textContent += "  " + state.current.explain;
      el.submitBtn.hidden = true;
      el.nextBtn.hidden = false;
      el.nextBtn.focus();
    } else {
      el.progressBarFill.style.width = `${(state.index / state.totalQuestions) * 100}%`;
      setTimeout(nextQuestion, 900);
    }
  }

  el.submitBtn.addEventListener("click", () => handleSubmit(false));
  el.nextBtn.addEventListener("click", nextQuestion);
  el.answerInput.addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    if (!el.nextBtn.hidden){ nextQuestion(); }
    else { handleSubmit(false); }
  });

  el.exitPlayBtn.addEventListener("click", () => {
    clearInterval(state.questionTimerId);
    clearInterval(state.tickId);
    showScreen("home");
    el.categoriesTitle.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  /* ---------------- results ---------------- */
  function finishSession(){
    clearInterval(state.questionTimerId);
    clearInterval(state.tickId);

    const elapsedSeconds = (Date.now() - state.startTs) / 1000;
    const meta = CATEGORY_META[state.category];
    const isQuiz = state.mode === "quiz";

    let headline, sub;
    if (isQuiz){
      const acc = state.totalQuestions ? Math.round((state.score / state.totalQuestions) * 100) : 0;
      if (acc >= 90) headline = "Outstanding!";
      else if (acc >= 70) headline = "Great work!";
      else if (acc >= 50) headline = "Nice effort!";
      else headline = "Keep practicing!";
      sub = `You scored ${state.score}/${state.totalQuestions} on the ${meta.name} quiz.`;
      el.scoreLabel.textContent = "Score";
      el.resultScore.textContent = `${state.score}/${state.totalQuestions}`;
      el.resultAccuracy.textContent = acc + "%";
      if (acc >= 60) spawnConfetti();
    } else {
      headline = state.sessionSolved > 0 ? "Nice work!" : "Session ended";
      sub = `You solved ${state.sessionSolved} ${meta.name.toLowerCase()} question${state.sessionSolved === 1 ? "" : "s"} this session.`;
      const acc = state.sessionSolved ? Math.round((state.sessionCorrect / state.sessionSolved) * 100) : 0;
      el.scoreLabel.textContent = "Solved";
      el.resultScore.textContent = `${state.sessionSolved}`;
      el.resultAccuracy.textContent = acc + "%";
    }

    el.resultsHeadline.textContent = headline;
    el.resultsSub.textContent = sub;
    el.resultStreak.textContent = state.bestStreak;
    el.resultTime.textContent = formatTime(elapsedSeconds);

    showScreen("results");
  }

  el.playAgainBtn.addEventListener("click", startSession);
  el.chooseCatBtn.addEventListener("click", () => {
    showScreen("home");
    el.categoriesTitle.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  /* ---------------- confetti ---------------- */
  const CONFETTI_COLORS = ["#1F9D7C", "#E8604B", "#7C5CE0", "#DB9A1F", "#D6478E", "#2E7DD1"];
  function spawnConfetti(){
    el.confettiLayer.innerHTML = "";
    const count = 26;
    for (let i = 0; i < count; i++){
      const piece = document.createElement("div");
      piece.className = "confetti-piece";
      piece.style.left = randInt(2, 96) + "%";
      piece.style.background = pick(CONFETTI_COLORS);
      piece.style.animationDuration = (1.2 + Math.random() * 1.1) + "s";
      piece.style.animationDelay = (Math.random() * 0.3) + "s";
      piece.style.transform = `rotate(${randInt(0, 360)}deg)`;
      el.confettiLayer.appendChild(piece);
    }
    setTimeout(() => { el.confettiLayer.innerHTML = ""; }, 2800);
  }

  /* ---------------- hero equation reel ---------------- */
  function rollHero(){
    const gens = [genAddition, genSubtraction, genMultiplication, genDivision];
    const q = pick(gens)("easy");
    const parts = q.left.replace("=", "").trim().split(" ");
    const [a, op, b] = parts;

    [el.reelA, el.reelOp, el.reelB, el.reelResult].forEach(t => t.classList.add("rolling"));
    setTimeout(() => {
      el.reelA.textContent = a;
      el.reelOp.textContent = op;
      el.reelB.textContent = b;
      el.reelResult.textContent = q.answer;
      [el.reelA, el.reelOp, el.reelB, el.reelResult].forEach(t => t.classList.remove("rolling"));
    }, 260);
  }
  setInterval(rollHero, 3400);

  /* ---------------- init ---------------- */
  updateNavChip();
})();
