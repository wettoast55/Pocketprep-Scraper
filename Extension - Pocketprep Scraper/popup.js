"use strict";
const fields = {
  name: "exam",
  expectedCount: "total",
  version: "version",
  versionDate: "version-date",
};
const edited = new Set();
for (const [name, id] of Object.entries(fields))
  document.getElementById(id).addEventListener("input", () => edited.add(name));
document.querySelector("#open").onclick = () =>
  chrome.tabs.create({ url: chrome.runtime.getURL("library.html") });
async function pocketPrepTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.url || new URL(tab.url).origin !== "https://study.pocketprep.com")
    throw new Error("Open an exam question on study.pocketprep.com first.");
  return tab;
}
// Never reuse another exam's defaults or infer bank size from a quiz counter.
(async () => {
  try {
    const tab = await pocketPrepTab();
    const [result] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: readExamMetadata,
    });
    for (const [name, id] of Object.entries(fields))
      if (!edited.has(name))
        document.getElementById(id).value = result.result?.[name] || "";
    document.querySelector("#status").textContent =
      "Only unambiguous page details are filled in. Enter the name and full bank total if blank. Version and source date are optional.";
  } catch (error) {
    document.querySelector("#status").textContent = error.message;
  }
})();
document.querySelector("#collect").onclick = async () => {
  try {
    const tab = await pocketPrepTab();
    const name = document.getElementById("exam").value.trim();
    const expectedCount = Number(document.getElementById("total").value);
    const version = document.getElementById("version").value.trim();
    const versionDate = document.getElementById("version-date").value.trim();
    if (
      !name ||
      !Number.isInteger(expectedCount) ||
      expectedCount < 1 ||
      expectedCount > 20000
    )
      throw new Error(
        "Enter an exam name and full bank total between 1 and 20,000.",
      );
    // Keep explicitly named editions separate; do not invent a missing version.
    const id =
      "pp-" +
      [name, version]
        .filter(Boolean)
        .join("-")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 70);
    if (id === "pp-")
      throw new Error("Use letters or numbers in the exam name.");
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["collector.js"],
    });
    await chrome.tabs.sendMessage(tab.id, {
      type: "openCollector",
      exam: { id, name, expectedCount, version, versionDate },
    });
    window.close();
  } catch (error) {
    document.querySelector("#status").textContent = error.message;
  }
};
