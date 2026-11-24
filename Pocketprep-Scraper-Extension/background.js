"use strict";
// The service worker serializes captures to avoid lost updates from overlapping saves.
importScripts("question-identity.js", "store.js");
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
    const stored = await ExamStore.get(meta.id);
    const old = stored ? QuestionIdentity.deduplicate(stored) : null;
    if (old && old.questions.length !== stored.questions.length)
      await ExamStore.put(old);
    if (message.type === "collectorStatus")
      return { count: old?.questions.length || 0 };
    const serial = message.serial;
    if (typeof serial !== "string" || !serial || serial.length > 500)
      throw new Error("Question identity unavailable.");
    // Source identifiers make repeated visits idempotent.
    const serials = old?.serials || {};
    const id =
      (old?.questions.reduce((max, q) => Math.max(max, q.id), 0) || 0) + 1;
    const checked = ExamStore.validate({
      ...meta,
      questions: [{ ...message.question, id }],
    });
    const incoming = checked.questions[0];
    const key = QuestionIdentity.key(incoming);
    const duplicate = old?.questions.find(
      (question) => QuestionIdentity.key(question) === key,
    );
    if (duplicate) {
      if (
        QuestionIdentity.solution(duplicate) !==
        QuestionIdentity.solution(incoming)
      )
        throw new Error(
          "The source gives conflicting answers for an existing question. Review it before continuing.",
        );
      await ExamStore.put({
        ...old,
        serials: { ...serials, [serial]: duplicate.id },
      });
      return { count: old.questions.length, duplicate: true };
    }
    const questions = [...(old?.questions || []), checked.questions[0]];
    if (questions.length > meta.expectedCount)
      throw new Error(
        "Collected count exceeds the configured exam total. Check the exam selection.",
      );
    await ExamStore.put({
      ...checked,
      questions,
      serials: { ...serials, [serial]: id },
      duplicateIds: old?.duplicateIds || {},
      source: "Pocket Prep signed-in question pages",
    });
    return { count: questions.length };
  };
  const task = writes.then(job);
  writes = task.catch(() => {});
  task.then(reply, (error) => reply({ error: error.message }));
  return true;
});
