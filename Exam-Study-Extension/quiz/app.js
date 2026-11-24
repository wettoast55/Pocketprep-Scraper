"use strict";
const BANK = window.QUESTION_BANK;
const KEY =
  window.EXAM.id === "cysa-original"
    ? "cysa-practice-v1"
    : "exam-progress:" + window.EXAM.id;
const $ = (s) => document.querySelector(s);
const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
// Keep completed answers and unfinished drafts separate so a retry does not erase a result.
let state = {
    answers: {},
    flags: [],
    current: BANK[0].id,
    inProgress: {},
    console: {},
  },
  mode = "all",
  query = "",
  status = "all",
  order = null,
  draft = {},
  activeTab = 0,
  submitted = false,
  feedbackView = null;
try {
  const saved = JSON.parse(localStorage.getItem(KEY));
  if (saved && saved.answers && Array.isArray(saved.flags))
    state = { ...state, ...saved };
} catch (e) {}
// Persist after every meaningful change; report storage failures in the page header.
function save() {
  state.savedAt = new Date().toISOString();
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
    $("#save-status").textContent = "Saved on this device";
  } catch (e) {
    $("#save-status").textContent =
      "Storage unavailable — export to keep progress";
  }
}
const getQ = () => BANK.find((q) => q.id === state.current) || BANK[0];
// A submitted answer keeps its current review list until the learner navigates away.
function filtered() {
  if (feedbackView)
    return feedbackView.map((id) => BANK.find((q) => q.id === id));
  let a = BANK.filter(
    (q) =>
      (mode === "all" ||
        mode === q.type ||
        (mode === "pbq" && q.type === "order") ||
        (mode === "flagged" && state.flags.includes(q.id)) ||
        (mode === "missed" && state.answers[q.id]?.correct === false)) &&
      (!query ||
        ("#" + q.id).includes(query) ||
        q.stem.toLowerCase().includes(query) ||
        q.options.some((o) => o.text.toLowerCase().includes(query))) &&
      (status === "all" ||
        (status === "new" && !state.answers[q.id]) ||
        (status === "done" && state.answers[q.id]) ||
        (status === "noted" && q.note)),
  );
  if (order) a.sort((x, y) => order.indexOf(x.id) - order.indexOf(y.id));
  return a;
}
function stats() {
  let entries = Object.entries(state.answers).filter(([id]) =>
    BANK.some((q) => q.id === +id),
  );
  let graded = entries.filter(([, v]) => v.correct !== null),
    correct = graded.filter(([, v]) => v.correct).length,
    pct = Math.round((entries.length / BANK.length) * 100);
  $("#done-count").textContent = entries.length;
  $("#percent").textContent = pct + "%";
  $("#progress-fill").style.width = pct + "%";
  $("#accuracy").textContent = graded.length
    ? Math.round((correct / graded.length) * 100) + "% accuracy"
    : "— accuracy";
  $("#missed-count").textContent = graded.length - correct;
  $("#flag-count").textContent = state.flags.length;
}
function map() {
  const a = filtered();
  $("#list-count").textContent = a.length;
  $("#question-list").innerHTML = a
    .map((q) => {
      let r = state.answers[q.id];
      return `<button class="qnum ${q.id === state.current ? "current" : ""} ${r ? (r.correct === null ? "neutral" : r.correct ? "correct" : "wrong") : ""} ${state.flags.includes(q.id) ? "bookmarked" : ""}" data-go="${q.id}" aria-label="Question ${q.id}${r ? ", " + (r.correct === null ? "reviewed" : r.correct ? "correct" : "needs review") : ""}" ${q.id === state.current ? 'aria-current="true"' : ""}>${q.id}</button>`;
    })
    .join("");
  $("#question-list")
    .querySelectorAll("[data-go]")
    .forEach((b) => (b.onclick = () => go(+b.dataset.go)));
  stats();
}
function imageHTML(im, i) {
  let src = typeof im === "string" ? im : im.src;
  return `<button class="evidence-image" data-image="${esc(src)}" aria-label="Enlarge evidence image ${i + 1}"><img src="${esc(src)}" loading="lazy" alt="Original evidence for question ${getQ().id}, image ${i + 1}"><span class="image-caption">SOURCE EVIDENCE ${i + 1} · Click to enlarge</span></button>`;
}
function openImage(src) {
  $("#modal-content").innerHTML =
    `<img src="${esc(src)}" alt="Enlarged source evidence"><p><a href="${esc(src)}" target="_blank" rel="noopener">Open full-size image in a new tab</a></p>`;
  $("#modal").showModal();
}
function bindImages() {
  document
    .querySelectorAll("[data-image]")
    .forEach((b) => (b.onclick = () => openImage(b.dataset.image)));
}
function sources(q) {
  return q.sources?.length
    ? `<div class="link-list">Further reading: ${q.sources.map((s) => `<a target="_blank" rel="noopener" href="${esc(s.url)}">${esc(s.title)}</a>`).join(" · ")}</div>`
    : "";
}
function mcq(q) {
  const result = submitted ? state.answers[q.id] : null,
    selected = draft.selected || [],
    multi =
      q.answer.length > 1 ||
      /choose (two|three|four|all)|select (two|three|four|all)/i.test(q.stem);
  return `${q.images.length ? '<div class="images">' + q.images.map(imageHTML).join("") + "</div>" : ""}<p class="instruction">${multi ? "Select all required answers, then check your answer." : "Select one answer, then check your answer."}</p><div class="options">${q.options
    .map((o) => {
      let yes = q.answer.includes(o.key),
        picked = selected.includes(o.key);
      return `<label class="option ${picked ? "selected" : ""} ${result && !q.unscored ? (yes ? "correct" : picked ? "incorrect" : "") : ""}"><input type="${multi ? "checkbox" : "radio"}" name="choice" value="${o.key}" ${picked ? "checked" : ""} ${result ? "disabled" : ""}><span class="letter">${o.key}</span><span class="choice-content">${esc(o.text)}${result ? `<p><strong>${q.unscored ? "Study note" : yes ? "Correct option" : picked ? "Your selection · Incorrect" : "Why this is incorrect"}.</strong> ${esc(q.optionExplanations[o.key])}</p>` : ""}</span></label>`;
    })
    .join(
      "",
    )}</div>${result ? `<div class="feedback ${result.correct === null ? "neutral" : result.correct ? "" : "wrong"}" role="status"><h3>${result.correct === null ? "Study review — excluded from accuracy" : result.correct ? "Correct. Nicely reasoned." : "Not quite. Review the evidence."}</h3><p>${esc(q.explanation)}</p>${!q.unscored ? `<p><b>Expected answer: ${q.answer.join(" + ")}</b></p>` : ""}${sources(q)}</div>` : ""}`;
}

function validSequence(q, v) {
  return (
    Array.isArray(v) &&
    v.length === q.options.length &&
    new Set(v).size === v.length &&
    v.every((k) => q.options.some((o) => o.key === k))
  );
}
function orderCorrect(q, v) {
  return validSequence(q, v) && v.every((k, i) => k === q.answer[i]);
}
// Ordering answers are permutations, so grading compares positions rather than membership.
function ordering(q) {
  if (!validSequence(q, draft.sequence))
    draft.sequence = q.options.map((o) => o.key);
  const result = submitted ? state.answers[q.id] : null;
  return `${q.images.length ? '<div class="images">' + q.images.map(imageHTML).join("") + "</div>" : ""}<p class="instruction">Arrange the steps from first to last using Move up and Move down, then check your answer. Your arrangement saves automatically.</p><ol class="order-list">${draft.sequence
    .map((key, i) => {
      const o = q.options.find((x) => x.key === key);
      return `<li class="option ${result ? (q.answer[i] === key ? "correct" : "incorrect") : ""}"><span class="choice-content">${esc(o.text)}${result ? `<p>${q.answer[i] === key ? "Correct position." : "Incorrect position. This step belongs at position " + (q.answer.indexOf(key) + 1) + "."}</p>` : ""}</span>${!result ? `<button class="secondary" data-move="${i}" data-direction="-1" aria-label="Move item ${i + 1} up" ${i === 0 ? "disabled" : ""}>↑ Move up</button><button class="secondary" data-move="${i}" data-direction="1" aria-label="Move item ${i + 1} down" ${i === draft.sequence.length - 1 ? "disabled" : ""}>↓ Move down</button>` : ""}</li>`;
    })
    .join(
      "",
    )}</ol>${result ? `<div class="feedback ${result.correct ? "" : "wrong"}" role="status"><h3>${result.correct ? "Correct sequence." : "Review the correct sequence."}</h3><ol>${q.answer.map((k) => "<li>" + esc(q.options.find((o) => o.key === k).text) + "</li>").join("")}</ol><p>${esc(q.explanation)}</p>${sources(q)}</div>` : ""}`;
}

function normalize(s) {
  return String(s ?? "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}
function fieldCorrect(f, v) {
  if (f.unscored) return null;
  let accepted = f.answer || [];
  if (f.type === "multiselect")
    return (
      Array.isArray(v) &&
      v.length === accepted.length &&
      accepted.every((x) => v.map(normalize).includes(normalize(x)))
    );
  return accepted.map(normalize).includes(normalize(v));
}
function pbq(q) {
  const p = q.lab,
    result = submitted ? state.answers[q.id] : null;
  if (!p) return "<p>Lab content is unavailable.</p>";
  let tabs = [...(p.tabs || [])];
  if (q.images.length)
    tabs.push({ label: "Original PDF evidence", original: true });
  activeTab = Math.min(activeTab, Math.max(0, tabs.length - 1));
  let t = tabs[activeTab];
  return `<p class="instruction">${esc(p.title)} · Inspect the evidence, complete each task, then check your work.</p>${tabs.length ? `<div class="tabs" role="tablist" aria-label="Investigation evidence">${tabs.map((t, i) => `<button class="tab ${activeTab === i ? "active" : ""}" role="tab" aria-selected="${activeTab === i}" data-tab="${i}">${esc(t.label)}</button>`).join("")}</div><div class="tab-panel">${t.original ? q.images.map(imageHTML).join("") : (t.image ? imageHTML(t.image, 0) : "") + (t.text ? "<pre>" + esc(t.text) + "</pre>" : "")}</div>` : ""}${p.terminal ? `<div class="terminal"><b>SIMULATED INVESTIGATION CONSOLE</b><pre id="terminal-output">${esc(state.console?.[q.id] || "Type help for available commands. Commands run only inside this practice simulation.")}</pre><form id="terminal-form"><input id="terminal-input" type="text" aria-label="Simulation command" placeholder="Enter command…" autocomplete="off"><button class="secondary">Run</button></form></div>` : ""}<div class="fields">${p.fields
    .map((f, i) => {
      let value = draft[f.id],
        correct = result ? fieldCorrect(f, value) : null;
      return `<div class="field"><label class="field-label" for="field-${i}">${i + 1}. ${esc(f.label)}</label>${f.type === "select" ? `<select id="field-${i}" data-field="${esc(f.id)}" ${result ? "disabled" : ""}><option value="">Select an answer…</option>${(f.options || []).map((o) => `<option value="${esc(o)}" ${value === o ? "selected" : ""}>${esc(o)}</option>`).join("")}</select>` : f.type === "multiselect" ? `<div class="checks">${(f.options || []).map((o) => `<label><input type="checkbox" data-multi="${esc(f.id)}" value="${esc(o)}" ${(value || []).includes(o) ? "checked" : ""} ${result ? "disabled" : ""}>${esc(o)}</label>`).join("")}</div>` : `<input id="field-${i}" type="text" data-field="${esc(f.id)}" value="${esc(value || "")}" ${result ? "disabled" : ""} placeholder="Enter your answer…">`}${result ? `<p class="field-feedback ${correct === null ? "" : correct ? "good" : "bad"}"><b>${correct === null ? "Study note" : correct ? "✓ Correct" : "↻ Review"}.</b> ${esc(f.explanation)}${correct === false ? "<br><b>Expected: " + esc(f.answer.join(f.type === "multiselect" ? " + " : " or ")) + "</b>" : ""}</p>` : ""}</div>`;
    })
    .join(
      "",
    )}</div>${result ? `<div class="feedback ${result.correct === null ? "neutral" : result.correct ? "" : "wrong"}" role="status"><h3>${result.correct === null ? "Lab reviewed" : result.correct ? "Investigation complete — all tasks correct" : `${result.points} of ${result.total} tasks correct`}</h3><p>${esc(p.explanation)}</p>${sources(p)}</div>` : ""}`;
}
function render() {
  let q = getQ(),
    a = filtered();
  if (!a.length) {
    $("#question-area").innerHTML =
      '<div class="empty"><h2>No matching questions</h2><p>Try another search, filter, or workspace.</p></div>';
    map();
    return;
  }
  let idx = a.findIndex((x) => x.id === q.id);
  if (idx < 0) {
    go(a[0].id);
    return;
  }
  $("#question-area").innerHTML =
    `<article class="question-card"><div class="card-head"><div><span class="badge">${q.type === "order" ? "ORDERING" : q.type === "pbq" ? "PERFORMANCE LAB" : "MULTIPLE CHOICE"}</span><span class="source">Question #${q.id}${q.page ? ` · PDF page ${q.page}` : ""}</span></div><button id="bookmark" class="quiet" aria-pressed="${state.flags.includes(q.id)}">${state.flags.includes(q.id) ? "⚑ Flagged for review" : "⚐ Flag for review"}</button></div><div class="card-body">${q.note ? `<div class="note"><strong>Study note.</strong> ${esc(q.note)}</div>` : ""}${q.lab?.note ? `<div class="note"><strong>Lab context.</strong> ${esc(q.lab.note)}</div>` : ""}<h2 class="question-title">${esc(q.stem)}</h2>${q.type === "order" ? ordering(q) : q.type === "mcq" ? mcq(q) : pbq(q)}<div class="actions"><button id="prev" class="secondary" ${idx === 0 ? "disabled" : ""}>← Previous</button><div class="answer-actions">${submitted ? '<button id="retry" class="secondary">Try again</button>' : `<button id="check" class="primary">${q.type === "pbq" ? "Check my work" : "Check answer"} →</button>`}${q.type === "pbq" ? '<button id="reset-lab" class="quiet">Reset All</button>' : ""}<span id="validation" class="sr-status" role="status"></span></div><button id="next" class="${submitted ? "primary" : "quiet"}" ${idx === a.length - 1 ? "disabled" : ""}>${submitted ? "Next question" : "Skip for now"} →</button></div></div></article><div class="question-bottom"><span>${idx + 1} / ${a.length} in this view</span><span>Feedback after every answer</span></div>`;
  $("#bookmark").onclick = () => {
    state.flags = state.flags.includes(q.id)
      ? state.flags.filter((x) => x !== q.id)
      : [...state.flags, q.id];
    save();
    render();
  };
  $("#next").onclick = () => step(1);
  $("#prev").onclick = () => step(-1);
  if ($("#retry"))
    $("#retry").onclick = () => {
      submitted = false;
      draft = {};
      persistDraft();
      render();
    };
  if ($("#check")) $("#check").onclick = check;
  if ($("#reset-lab"))
    $("#reset-lab").onclick = () => {
      submitted = false;
      draft = {};
      if (state.console) delete state.console[q.id];
      persistDraft();
      render();
    };
  document.querySelectorAll("[data-move]").forEach(
    (el) =>
      (el.onclick = () => {
        const i = Number(el.dataset.move),
          j = i + Number(el.dataset.direction);
        if (j < 0 || j >= draft.sequence.length) return;
        [draft.sequence[i], draft.sequence[j]] = [
          draft.sequence[j],
          draft.sequence[i],
        ];
        persistDraft();
        render();
        document
          .querySelector(
            '[data-move=\"' +
              j +
              '\"][data-direction=\"' +
              el.dataset.direction +
              '\"]',
          )
          ?.focus();
      }),
  );
  document.querySelectorAll("input[name=choice]").forEach(
    (el) =>
      (el.onchange = () => {
        draft.selected = [
          ...document.querySelectorAll("input[name=choice]:checked"),
        ].map((x) => x.value);
        persistDraft();
        document
          .querySelectorAll(".option")
          .forEach((o) =>
            o.classList.toggle("selected", o.querySelector("input").checked),
          );
      }),
  );
  document.querySelectorAll("[data-field]").forEach(
    (el) =>
      (el.oninput = () => {
        draft[el.dataset.field] = el.value;
        persistDraft();
      }),
  );
  document.querySelectorAll("[data-multi]").forEach(
    (el) =>
      (el.onchange = () => {
        let id = el.dataset.multi;
        draft[id] = [...document.querySelectorAll("[data-multi]")]
          .filter((x) => x.dataset.multi === id && x.checked)
          .map((x) => x.value);
        persistDraft();
      }),
  );
  document.querySelectorAll("[data-tab]").forEach(
    (el) =>
      (el.onclick = () => {
        activeTab = +el.dataset.tab;
        render();
      }),
  );
  if ($("#terminal-form"))
    $("#terminal-form").onsubmit = (e) => {
      e.preventDefault();
      let cmd = $("#terminal-input").value.trim(),
        commands = q.lab.terminal.commands;
      let match = commands.find((c) => normalize(c.command) === normalize(cmd));
      $("#terminal-output").textContent +=
        "\n> " +
        cmd +
        "\n" +
        (cmd === "help"
          ? commands.map((c) => c.command).join("\n")
          : match
            ? match.output
            : "Command not available in this simulation. Type help.");
      state.console ??= {};
      state.console[q.id] = $("#terminal-output").textContent.slice(-50000);
      save();
      $("#terminal-input").value = "";
    };
  bindImages();
  map();
}
// Grade the active question and retain the submitted draft for later review.
function check() {
  let q = getQ(),
    r;
  const currentView = filtered().map((x) => x.id);
  if (q.type === "order") {
    r = {
      draft: structuredClone(draft),
      correct: orderCorrect(q, draft.sequence),
    };
  } else if (q.type === "mcq") {
    let values = draft.selected || [];
    if (!values.length) {
      $("#validation").textContent = " Select an answer first.";
      return;
    }
    r = {
      draft: structuredClone(draft),
      correct: q.unscored
        ? null
        : values.length === q.answer.length &&
          values.every((x) => q.answer.includes(x)),
    };
  } else {
    let f = q.lab.fields,
      missing = f.find(
        (x) =>
          !x.unscored &&
          (!draft[x.id] || (Array.isArray(draft[x.id]) && !draft[x.id].length)),
      );
    if (missing) {
      $("#validation").textContent = " Complete every scored task first.";
      return;
    }
    let checks = f
      .map((x) => fieldCorrect(x, draft[x.id]))
      .filter((x) => x !== null);
    r = {
      draft: structuredClone(draft),
      correct: q.lab.unscored || !checks.length ? null : checks.every(Boolean),
      points: checks.filter(Boolean).length,
      total: checks.length,
    };
  }
  r.at = new Date().toISOString();
  state.answers[q.id] = r;
  delete (state.inProgress || {})[q.id];
  submitted = true;
  feedbackView = currentView;
  save();
  render();
  $(".feedback")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
}
// Restore an unfinished draft ahead of the last completed attempt.
function go(id) {
  feedbackView = null;
  state.current = id;
  let r = state.answers[id],
    pending = state.inProgress?.[id];
  draft = pending
    ? structuredClone(pending)
    : r
      ? structuredClone(r.draft)
      : {};
  submitted = !!r && !pending;
  activeTab = 0;
  save();
  render();
}
function step(delta) {
  let a = filtered(),
    i = a.findIndex((q) => q.id === state.current),
    next = a[i + delta];
  if (next) {
    go(next.id);
    $("#question-area").scrollIntoView({ behavior: "smooth", block: "start" });
  }
}
document.querySelectorAll("[data-mode]").forEach(
  (b) =>
    (b.onclick = () => {
      feedbackView = null;
      mode = b.dataset.mode;
      document
        .querySelectorAll("[data-mode]")
        .forEach((x) => x.classList.toggle("active", x === b));
      render();
    }),
);
$("#search").oninput = (e) => {
  feedbackView = null;
  query = e.target.value.trim().toLowerCase();
  render();
};
$("#status-filter").onchange = (e) => {
  feedbackView = null;
  status = e.target.value;
  render();
};
$("#shuffle").onclick = () => {
  feedbackView = null;
  order = BANK.map((q) => q.id);
  for (let i = order.length - 1; i > 0; i--) {
    let j = Math.floor(Math.random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  $("#ordered").hidden = false;
  let a = filtered();
  if (a.length) go(a[0].id);
};
$("#ordered").onclick = () => {
  feedbackView = null;
  order = null;
  $("#ordered").hidden = true;
  render();
};
$("#close-modal").onclick = () => {
  state.paused = false;
  save();
  $("#modal").close();
};
$("#modal").onclick = (e) => {
  if (e.target === $("#modal")) $("#modal").close();
};
$("#about").onclick = () => {
  if (window.EXAM.id !== "cysa-original") {
    $("#modal-content").innerHTML =
      "<h2>" +
      esc(window.EXAM.name) +
      "</h2><p>" +
      BANK.length +
      " questions stored on this device. Answers and explanations come from the imported material. Progress is saved separately for this exam. Download progress for a portable backup.</p>";
    $("#modal").showModal();
    return;
  }
  $("#modal-content").innerHTML =
    "<h2>Your complete practice bank</h2><p>625 questions, numbered 3–627, from all 231 pages of your PDF: 614 multiple-choice questions, 11 performance labs, and 138 original evidence images. Repeated questions are retained.</p><p>The PDF does not supply an answer key. Explanations are a reasoned study key; questions with missing or contradictory evidence are labeled. Unscored questions provide study feedback but do not affect accuracy.</p><p>Some PBQs refer to interactive tabs that were not captured in the PDF. Those labs clearly identify reconstructed practice evidence. The original screenshots remain available in the evidence tabs.</p><p>Selections and answers are automatically saved in this browser on this device. Save &amp; exit pauses your session; reopening the quiz lets you resume at the same question. Download progress creates a backup file; Load progress restores it on this or another device. Accuracy reflects the most recent submitted attempt for each graded question. Retrying does not erase an earlier attempt until you submit again. Export your progress to keep a record.</p>";
  $("#modal").showModal();
};
$("#reset-progress").onclick = () => {
  if (confirm("Clear all saved answers and bookmarks on this device?")) {
    state = {
      answers: {},
      flags: [],
      current: BANK[0].id,
      inProgress: {},
      console: {},
    };
    mode = "all";
    query = "";
    status = "all";
    $("#search").value = "";
    $("#status-filter").value = "all";
    document
      .querySelectorAll("[data-mode]")
      .forEach((b) => b.classList.toggle("active", b.dataset.mode === "all"));
    save();
    go(BANK[0].id);
  }
};
function downloadProgress() {
  save();
  let blob = new Blob(
      [
        JSON.stringify(
          {
            format: "cysa-practice-progress",
            version: 2,
            exported: new Date().toISOString(),
            source:
              window.EXAM.id === "cysa-original"
                ? "QUIZ PRACTICeee.pdf"
                : window.EXAM.id,
            ...state,
          },
          null,
          2,
        ),
      ],
      { type: "application/json" },
    ),
    a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = window.EXAM.id + "-progress.json";
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
function persistDraft() {
  state.inProgress ??= {};
  state.inProgress[state.current] = structuredClone(draft);
  save();
}
function showResume(savedAt) {
  const reviewed = Object.keys(state.answers).length,
    pending = Object.keys(state.inProgress || {}).length;
  $("#modal-content").innerHTML =
    `<h2>${state.paused ? "Session saved" : "Welcome back"}</h2><div class="resume-info"><p><b>Your place: question #${state.current}</b></p><p>${reviewed} reviewed · ${pending} unfinished question${pending === 1 ? "" : "s"} saved</p><p>${savedAt ? "Last saved " + esc(new Date(savedAt).toLocaleString()) : "Your answers and flags are stored on this device."}</p></div><p>You can close this page and return later. For another device or a backup, download your progress file and use <b>Load progress</b> to restore it.</p><div class="session-controls"><button class="primary" id="resume-now">Resume practice →</button><button class="secondary" id="backup-now">Download progress</button><button class="secondary" id="restore-now">Load progress</button></div>`;
  $("#resume-now").onclick = () => {
    state.paused = false;
    save();
    $("#modal").close();
  };
  $("#backup-now").onclick = downloadProgress;
  $("#restore-now").onclick = () => $("#import-file").click();
  if (!$("#modal").open) $("#modal").showModal();
}
$("#pause").onclick = () => {
  if (!submitted) persistDraft();
  state.paused = true;
  save();
  showResume(state.savedAt);
};
$("#import").onclick = () => $("#import-file").click();
$("#import-file").onchange = async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  try {
    if (file.size > 5_000_000)
      throw new Error("This progress file is too large.");
    const incoming = JSON.parse(await file.text());
    if (
      incoming.source !==
        (window.EXAM.id === "cysa-original"
          ? "QUIZ PRACTICeee.pdf"
          : window.EXAM.id) ||
      !incoming.answers ||
      typeof incoming.answers !== "object" ||
      Array.isArray(incoming.answers) ||
      !Array.isArray(incoming.flags) ||
      !BANK.some((q) => q.id === incoming.current)
    )
      throw new Error("Choose a progress file downloaded from this quiz.");
    const clean = {
      answers: {},
      flags: incoming.flags.filter((id) => BANK.some((q) => q.id === id)),
      current: incoming.current,
      inProgress: {},
      console: {},
      paused: false,
    };
    // Validate portable progress against the destination bank, then recompute scores.
    function validateDraft(q, d) {
      if (!d || typeof d !== "object" || Array.isArray(d))
        throw new Error("The file contains an invalid answer.");
      let next = {};
      if (q.type === "order") {
        if (d.sequence !== undefined) {
          if (!validSequence(q, d.sequence))
            throw new Error("Invalid saved sequence.");
          next.sequence = [...d.sequence];
        }
      } else if (q.type === "mcq") {
        if (d.selected !== undefined) {
          if (
            !Array.isArray(d.selected) ||
            d.selected.some((k) => !q.options.some((o) => o.key === k))
          )
            throw new Error("The file contains invalid choices.");
          next.selected = [...new Set(d.selected)];
        }
      } else {
        for (const f of q.lab.fields) {
          if (d[f.id] === undefined) continue;
          let v = d[f.id];
          if (f.type === "multiselect") {
            if (!Array.isArray(v) || v.some((x) => !f.options.includes(x)))
              throw new Error("The file contains invalid lab choices.");
            next[f.id] = [...new Set(v)];
          } else {
            if (
              typeof v !== "string" ||
              v.length > 5000 ||
              (f.type === "select" && v !== "" && !f.options.includes(v))
            )
              throw new Error("The file contains an invalid lab answer.");
            next[f.id] = v;
          }
        }
      }
      return next;
    }
    for (const [id, r] of Object.entries(incoming.answers)) {
      const q = BANK.find((q) => q.id === +id);
      if (!q) throw new Error("The file contains an unknown question.");
      const d = validateDraft(q, r.draft);
      let result;
      if (q.type === "order") {
        result = { correct: orderCorrect(q, d.sequence) };
      } else if (q.type === "mcq") {
        const v = d.selected || [];
        result = {
          correct: q.unscored
            ? null
            : v.length === q.answer.length &&
              v.every((x) => q.answer.includes(x)),
        };
      } else {
        const checks = q.lab.fields
          .map((f) => fieldCorrect(f, d[f.id]))
          .filter((x) => x !== null);
        result = {
          correct:
            q.lab.unscored || !checks.length ? null : checks.every(Boolean),
          points: checks.filter(Boolean).length,
          total: checks.length,
        };
      }
      clean.answers[id] = {
        ...result,
        draft: d,
        at: typeof r.at === "string" ? r.at : new Date().toISOString(),
      };
    }
    if (incoming.inProgress && typeof incoming.inProgress === "object")
      for (const [id, d] of Object.entries(incoming.inProgress)) {
        const q = BANK.find((q) => q.id === +id);
        if (!q) throw new Error("The file contains an unknown draft question.");
        clean.inProgress[id] = validateDraft(q, d);
      }
    if (
      (Object.keys(state.answers).length ||
        Object.keys(state.inProgress || {}).length) &&
      !confirm(
        "Replace the progress on this device with the selected saved progress file?",
      )
    )
      return;
    if (incoming.console && typeof incoming.console === "object")
      for (const [id, v] of Object.entries(incoming.console)) {
        if (BANK.some((q) => q.id === +id) && typeof v === "string")
          clean.console[id] = v.slice(-50000);
      }
    state = clean;
    mode = "all";
    query = "";
    status = "all";
    order = null;
    $("#ordered").hidden = true;
    $("#search").value = "";
    $("#status-filter").value = "all";
    document
      .querySelectorAll("[data-mode]")
      .forEach((b) => b.classList.toggle("active", b.dataset.mode === "all"));
    save();
    if ($("#modal").open) $("#modal").close();
    go(state.current);
    showResume(state.savedAt);
  } catch (err) {
    $("#modal-content").innerHTML =
      '<h2>Progress could not be loaded</h2><p class="import-error">' +
      esc(err.message) +
      "</p><p>Your existing progress has not been changed.</p>";
    if (!$("#modal").open) $("#modal").showModal();
  } finally {
    e.target.value = "";
  }
};

$("#review-toggle").onclick = () => {
  const opened = document.body.classList.toggle("review-open");
  $("#review-toggle").setAttribute("aria-expanded", String(opened));
  $("#review-toggle").textContent = opened
    ? "Return to question"
    : "Question review";
};
$("#export").onclick = downloadProgress;
const hadProgress = !!(
  Object.keys(state.answers).length ||
  Object.keys(state.inProgress || {}).length ||
  state.paused
);
const lastSaved = state.savedAt;
go(state.current);
if (hadProgress) showResume(lastSaved);
