"use strict";
document.querySelector("#open").onclick = () =>
  chrome.tabs.create({ url: chrome.runtime.getURL("library.html") });
// Access is granted by the toolbar click and restricted to the Pocket Prep origin.
document.querySelector("#collect").onclick = async () => {
  try {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (!tab?.url || new URL(tab.url).origin !== "https://study.pocketprep.com")
      throw new Error("Open a question on study.pocketprep.com first.");
    const name = document.querySelector("#exam").value.trim(),
      expectedCount = Number(document.querySelector("#total").value);
    if (
      !name ||
      !Number.isInteger(expectedCount) ||
      expectedCount < 1 ||
      expectedCount > 20000
    )
      throw new Error("Enter an exam name and a total between 1 and 20,000.");
    const id =
      "pp-" +
      name
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
      exam: { id, name, expectedCount },
    });
    window.close();
  } catch (e) {
    document.querySelector("#status").textContent = e.message;
  }
};
