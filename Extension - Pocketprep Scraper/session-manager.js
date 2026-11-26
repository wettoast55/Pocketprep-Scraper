"use strict";

// Each sidebar controls its original Pocket Prep tab, even when focus changes.
const sessionKey = (tabId) => "collector-session:" + tabId;
let sessionWrites = Promise.resolve();
const serializedSession = (task) => {
  const result = sessionWrites.then(task);
  sessionWrites = result.catch(() => {});
  return result;
};
async function getSession(tabId) {
  return (await chrome.storage.session.get(sessionKey(tabId)))[
    sessionKey(tabId)
  ];
}
async function setSession(tabId, change) {
  return serializedSession(async () => {
    const value = {
      ...(await getSession(tabId)),
      ...change,
      tabId,
      updatedAt: Date.now(),
    };
    await chrome.storage.session.set({ [sessionKey(tabId)]: value });
    return value;
  });
}
async function updatePower() {
  const values = Object.entries(await chrome.storage.session.get(null));
  const awake = values.some(
    ([key, value]) =>
      key.startsWith("collector-session:") &&
      value.running &&
      value.keepAwake &&
      Date.now() - value.updatedAt < 90000,
  );
  if (awake) chrome.power.requestKeepAwake("system");
  else chrome.power.releaseKeepAwake();
}
async function injectCollector(tabId, session, resume = false) {
  const tab = await chrome.tabs.get(tabId);
  if (!tab.url || new URL(tab.url).origin !== "https://study.pocketprep.com")
    throw new Error("Return to the Pocket Prep tab and reopen the extension.");
  await chrome.scripting.executeScript({
    target: { tabId },
    files: ["smart-flow.js", "collector.js"],
  });
  const response = await chrome.tabs.sendMessage(tabId, {
    type: "openCollector",
    exam: session.exam,
    settings: session,
    resume,
  });
  if (response?.error) throw new Error(response.error);
}
chrome.action.onClicked.addListener(async (tab) => {
  try {
    const options = chrome.sidePanel.setOptions({
      tabId: tab.id,
      path: "popup.html?tabId=" + tab.id,
      enabled: true,
    });
    // Open during the toolbar gesture; awaiting another API first can consume
    // the gesture in Edge and prevent the sidebar from appearing.
    const opened = chrome.sidePanel.open({ tabId: tab.id });
    await Promise.all([options, opened]);
  } catch (error) {
    console.error("Could not open the study sidebar:", error);
  }
});
chrome.runtime.onMessage.addListener((message, sender, reply) => {
  const source =
    sender.tab && sender.url?.startsWith("https://study.pocketprep.com/");
  const panel = sender.url?.startsWith(chrome.runtime.getURL("popup.html"));
  if (!source && !panel) return;
  const tabId = source ? sender.tab.id : message.tabId;
  if (!Number.isInteger(tabId)) return;
  const task = async () => {
    if (message.type === "sessionGet")
      return { session: await getSession(tabId) };
    if (message.type === "sessionPulse" && source) {
      const session = await getSession(tabId);
      if (!session) return {};
      await setSession(tabId, {
        running: Boolean(message.running),
        smart: Boolean(message.smart),
        status: String(message.status || "").slice(0, 2000),
      });
      await updatePower();
      return {};
    }
    if (message.type === "sessionStart" && panel) {
      const previous = await getSession(tabId);
      if (previous?.running)
        throw new Error(
          "Stop the current collection before changing its settings.",
        );
      const session = await setSession(tabId, {
        exam: message.exam,
        keepAwake: message.keepAwake !== false,
        allowHistory: Boolean(message.allowHistory),
        smart: false,
        running: false,
        status: "Collector ready.",
      });
      await injectCollector(tabId, session);
      return { session };
    }
    if (message.type === "sessionCommand" && panel) {
      const session = await getSession(tabId);
      if (!session?.exam) throw new Error("Open the collector first.");
      return await chrome.tabs.sendMessage(tabId, {
        type: "collectorCommand",
        command: message.command,
      });
    }
  };
  if (
    !["sessionGet", "sessionPulse", "sessionStart", "sessionCommand"].includes(
      message.type,
    )
  )
    return;
  task().then(reply, (error) => reply({ error: error.message }));
  return true;
});
// Reattach the collector after same-origin full-page navigation. The original
// activeTab grant is still required; sign-out or browser restart never bypasses it.
chrome.tabs.onUpdated.addListener((tabId, change) => {
  if (change.status !== "complete") return;
  (async () => {
    const session = await getSession(tabId);
    if (!session?.exam) return;
    await injectCollector(tabId, session, Boolean(session.running));
  })().catch(async (error) => {
    await setSession(tabId, { running: false, status: error.message });
    await updatePower();
  });
});
chrome.tabs.onRemoved.addListener((tabId) => {
  chrome.storage.session
    .remove([
      sessionKey(tabId),
      "panel-window:" + tabId,
      "collector-draft:" + tabId,
    ])
    .then(updatePower);
});
chrome.alarms.create("collector-watchdog", { periodInMinutes: 1 });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "collector-watchdog") updatePower();
});
