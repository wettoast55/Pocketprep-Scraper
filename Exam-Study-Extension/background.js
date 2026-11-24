"use strict";
// The service worker serializes captures to avoid lost updates from overlapping saves.
importScripts("store.js");
let writes = Promise.resolve();
chrome.runtime.onMessage.addListener((message, sender, reply) => {
  if (!["saveQuestion", "collectorStatus"].includes(message.type)) return;
  if (
    !sender.tab ||
    new URL(sender.url).origin !== "https://study.pocketprep.com"
  ) {
    reply({ error: "Unsupported source." });
    return;
  }
  const job = async () => {
    const meta = message.exam;
    if (
      !meta ||
      !/^pp-[a-z0-9-]{1,70}$/.test(meta.id) ||
      typeof meta.name !== "string" ||
      !Number.isInteger(meta.expectedCount) ||
      meta.expectedCount < 1 ||
      meta.expectedCount > 20000
    )
      throw new Error("Invalid exam settings.");
    const old = await ExamStore.get(meta.id);
    if (message.type === "collectorStatus")
      return { count: old?.questions.length || 0 };
    const serial = message.serial;
    if (typeof serial !== "string" || !serial || serial.length > 500)
      throw new Error("Question identity unavailable.");
    // Source identifiers make repeated visits idempotent.
    const serials = old?.serials || {};
    if (Object.hasOwn(serials, serial))
      return { count: old.questions.length, duplicate: true };
    const id =
      (old?.questions.reduce((max, q) => Math.max(max, q.id), 0) || 0) + 1;
    const checked = ExamStore.validate({
      ...meta,
      questions: [{ ...message.question, id }],
    });
    const questions = [...(old?.questions || []), checked.questions[0]];
    if (questions.length > meta.expectedCount)
      throw new Error(
        "Collected count exceeds the configured exam total. Check the exam selection.",
      );
    await ExamStore.put({
      ...checked,
      questions,
      serials: { ...serials, [serial]: id },
      source: "Pocket Prep signed-in question pages",
    });
    return { count: questions.length };
  };
  const task = writes.then(job);
  writes = task.catch(() => {});
  task.then(reply, (error) => reply({ error: error.message }));
  return true;
});
