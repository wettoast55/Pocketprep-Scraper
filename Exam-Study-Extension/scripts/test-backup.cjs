const fs = require("fs"),
  vm = require("vm"),
  assert = require("assert/strict");
const values = new Map(),
  context = {
    localStorage: {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value),
      removeItem: (key) => values.delete(key),
    },
  };
vm.createContext(context);
for (const file of ["store.js", "backup.js"])
  vm.runInContext(fs.readFileSync("./" + file, "utf8"), context);
const question = {
  id: 1,
  type: "order",
  stem: "Order these steps.",
  options: [
    { key: "A", text: "First" },
    { key: "B", text: "Second" },
  ],
  answer: ["A", "B"],
  explanation: "First before second.",
  images: [],
};
const exam = {
  id: "pp-example",
  name: "Example",
  expectedCount: 2,
  questions: [question],
  serials: { "source-123": 1 },
};
const session = {
  current: 1,
  flags: [1],
  answers: { 1: { draft: { sequence: ["B", "A"] }, correct: true } },
  inProgress: { 1: { sequence: ["A", "B"] } },
};
const data = {
  format: "exam-study-library",
  version: 1,
  exams: [exam],
  progress: { "pp-example": session },
};
const api = context.LibraryBackup;
const clean = api.validate(data);
assert.equal(clean.exams[0].serials["source-123"], 1);
assert.equal(clean.progress["pp-example"].answers[1].correct, false);
assert.equal(
  JSON.stringify(clean.progress["pp-example"].inProgress[1].sequence),
  '["A","B"]',
);
for (const bad of [
  { ...data, version: 2 },
  { ...data, exams: [exam, exam] },
  { ...data, exams: [{ ...exam, serials: { bad: 999 } }] },
  { ...data, progress: { "pp-example": { ...session, current: 999 } } },
  {
    ...data,
    progress: {
      "pp-example": { ...session, inProgress: { 1: { sequence: ["A", "A"] } } },
    },
  },
])
  assert.throws(() => api.validate(bad));
(async () => {
  values.set("exam-progress:pp-example", "old progress");
  context.ExamStore.putMany = async () => {
    throw Error("transaction failed");
  };
  await assert.rejects(api.restore(clean), /transaction failed/);
  assert.equal(values.get("exam-progress:pp-example"), "old progress");
  let restored;
  context.ExamStore.putMany = async (exams) => {
    restored = exams;
  };
  await api.restore(clean);
  assert.equal(restored.length, 1);
  context.ExamStore.all = async () => restored;
  const exported = await api.create();
  assert.equal(exported.exams[0].serials["source-123"], 1);
  assert.equal(exported.progress["pp-example"].current, 1);
  assert.equal(api.validate(exported).exams.length, 1);
  console.log(
    "PASS: portable backup round-trip, source deduplication, draft preservation, score recalculation, invalid input rejection and restore rollback.",
  );
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
