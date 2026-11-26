"use strict";
// One sidebar, one source tab. Drafts persist separately from the running worker.
const tabId = Number(new URLSearchParams(location.search).get("tabId"));
const draftKey = "collector-draft:" + tabId;
const fields = {
  name: "exam",
  expectedCount: "total",
  version: "version",
  versionDate: "version-date",
};
const element = (id) => document.getElementById(id);
let running = false,
  activeExam = null,
  busy = false,
  writes = Promise.resolve();
const edited = new Set();
const status = (message) => {
  element("status").textContent = message;
};
function showCollector() {
  element("home").hidden = true;
  element("collector").hidden = false;
}
function render() {
  // Keep setup values intact while showing only the active job and pause control.
  element("collection-setup").hidden = running;
  element("preview-controls").hidden = running;
  element("collecting-exam").hidden = !running;
  if (running) {
    const exam = activeExam || readDraft();
    element("collecting-exam").textContent =
      "Currently collecting questions from: " +
      exam.name +
      (exam.version ? " · Version " + exam.version : "") +
      (exam.versionDate ? " · " + exam.versionDate : "");
  }
  element("toggle").textContent = running
    ? "End / pause question collection"
    : "Begin question collection";
  element("toggle").disabled = busy;
  element("preview-button").disabled = busy || running;
  for (const id of [...Object.values(fields), "allow-history"])
    element(id).disabled = busy || running;
}
function readDraft() {
  return {
    ...Object.fromEntries(
      Object.entries(fields).map(([key, id]) => [key, element(id).value]),
    ),
    allowHistory: element("allow-history").checked,
  };
}
function saveDraft() {
  const draft = readDraft();
  writes = writes
    .catch(() => {})
    .then(() => chrome.storage.session.set({ [draftKey]: draft }));
  writes.catch((error) => status("Could not save settings: " + error.message));
  return writes;
}
for (const [key, id] of Object.entries(fields))
  element(id).addEventListener("input", () => {
    edited.add(key);
    saveDraft();
  });
element("allow-history").addEventListener("change", () => {
  edited.add("allowHistory");
  saveDraft();
});
async function send(type, details = {}) {
  const result = await chrome.runtime.sendMessage({ type, tabId, ...details });
  if (result?.error) throw new Error(result.error);
  return result;
}
async function sourceTab() {
  if (!Number.isInteger(tabId) || tabId < 1)
    throw new Error("Click the extension icon from your Pocket Prep tab.");
  const tab = await chrome.tabs.get(tabId);
  if (!tab.url || new URL(tab.url).origin !== "https://study.pocketprep.com")
    throw new Error(
      "Open your exam on Pocket Prep, then click the extension icon there.",
    );
  return tab;
}
async function refreshSession() {
  const { session } = await send("sessionGet");
  running = Boolean(session?.running);
  activeExam = session?.exam || null;
  if (running) showCollector();
  if (session?.status) status(session.status);
  render();
}
const ready = (async () => {
  const saved = (await chrome.storage.session.get(draftKey))[draftKey];
  if (saved) {
    for (const [key, id] of Object.entries(fields))
      if (!edited.has(key)) element(id).value = saved[key] || "";
    if (!edited.has("allowHistory"))
      element("allow-history").checked = Boolean(saved.allowHistory);
  }
  try {
    await sourceTab();
    const [{ result: metadata }] = await chrome.scripting.executeScript({
      target: { tabId },
      func: readExamMetadata,
    });
    if (!saved)
      for (const [key, id] of Object.entries(fields))
        if (!edited.has(key)) element(id).value = metadata?.[key] || "";
    await saveDraft();
    await refreshSession();
  } catch (error) {
    status(error.message);
  }
})();
async function configure() {
  await ready;
  await sourceTab();
  await saveDraft();
  const draft = readDraft(),
    name = draft.name.trim(),
    version = draft.version.trim(),
    expectedCount = Number(draft.expectedCount);
  if (
    !name ||
    !Number.isInteger(expectedCount) ||
    expectedCount < 1 ||
    expectedCount > 20000
  )
    throw new Error(
      "Enter an exam name and full bank total between 1 and 20,000.",
    );
  const id =
    "pp-" +
    [name, version]
      .filter(Boolean)
      .join("-")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 70);
  if (id === "pp-") throw new Error("Use letters or numbers in the exam name.");
  await send("sessionStart", {
    exam: {
      id,
      name,
      expectedCount,
      version,
      versionDate: draft.versionDate.trim(),
    },
    allowHistory: draft.allowHistory,
    keepAwake: true,
  });
}
async function action(task) {
  if (busy) return;
  busy = true;
  render();
  try {
    await task();
  } catch (error) {
    status(error.message);
  } finally {
    busy = false;
    render();
  }
}
element("open").onclick = () =>
  chrome.tabs.create({ url: chrome.runtime.getURL("library.html") });
element("scrape").onclick = showCollector;
element("toggle").onclick = () =>
  action(async () => {
    await ready;
    if (running) {
      await send("sessionCommand", { command: "stop" });
      status(
        "Pausing after the current operation. Saved questions are retained.",
      );
    } else {
      await configure();
      await send("sessionCommand", { command: "smart" });
    }
    await refreshSession();
  });
element("preview-button").onclick = () =>
  action(async () => {
    await configure();
    const result = await send("sessionCommand", { command: "preview" });
    element("preview").textContent = JSON.stringify(result.question, null, 2);
    element("preview").hidden = false;
    status(
      "Preview only. This question has not been saved by the preview action.",
    );
  });
// Storage events synchronize the button instantly, including pause/error/completion.
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "session" && changes["collector-session:" + tabId])
    refreshSession().catch((error) => status(error.message));
});
render();
