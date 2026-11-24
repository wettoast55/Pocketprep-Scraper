const fs = require("fs"),
  vm = require("vm"),
  assert = require("assert/strict");
const root = "./";
const ctx = {};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(root + "store.js", "utf8"), ctx);
const question = {
  id: 1,
  type: "order",
  stem: "Arrange the steps",
  options: [
    { key: "A", text: "Request" },
    { key: "B", text: "Compare" },
    { key: "C", text: "Receive" },
    { key: "D", text: "Correct" },
  ],
  answer: ["A", "C", "B", "D"],
  explanation: "Request, receive, compare, then correct.",
  images: [],
};
const bank = { id: "test-order", name: "Order test", questions: [question] };
assert.equal(ctx.ExamStore.validate(bank).questions[0].type, "order");
for (const answer of [
  ["A", "C"],
  ["A", "C", "C", "D"],
  ["A", "C", "B", "E"],
])
  assert.throws(() =>
    ctx.ExamStore.validate({ ...bank, questions: [{ ...question, answer }] }),
  );
const code = fs.readFileSync(root + "quiz/app.js", "utf8");
vm.runInContext(
  code.slice(
    code.indexOf("function validSequence"),
    code.indexOf("function ordering"),
  ),
  ctx,
);
assert.equal(ctx.orderCorrect(question, ["A", "C", "B", "D"]), true);
assert.equal(ctx.orderCorrect(question, ["A", "B", "C", "D"]), false);
assert.equal(ctx.orderCorrect(question, ["A", "C", "B", "B"]), false);
assert.equal(
  ctx.validSequence(question, JSON.parse(JSON.stringify(["D", "A", "B", "C"]))),
  true,
);
const collector = fs.readFileSync(root + "collector.js", "utf8");
const rows = [
  ["Request", null],
  ["Compare", "3"],
  ["Receive", "2"],
  ["Correct", null],
].map(([text, position]) => ({
  querySelector: (s) =>
    s.endsWith("__choice-text")
      ? { innerText: text }
      : position
        ? { textContent: position }
        : null,
}));
ctx.orderList = () => ({ querySelectorAll: () => rows });
ctx.gradedOrder = () => true;
vm.runInContext(
  collector.slice(
    collector.indexOf("function extractOrder"),
    collector.indexOf("function autoButton"),
  ),
  ctx,
);
assert.equal(
  JSON.stringify(ctx.extractOrder().answer),
  JSON.stringify(["A", "C", "B", "D"]),
);
ctx.gradedOrder = () => false;
assert.throws(() => ctx.extractOrder(), /not been revealed/);
ctx.gradedOrder = () => true;
rows[1].querySelector = (s) =>
  s.endsWith("__choice-text") ? { innerText: "Compare" } : { textContent: "2" };
assert.throws(() => ctx.extractOrder(), /incomplete/);
console.log(
  "PASS: correct-position extraction, unrevealed/incomplete rejection, full-permutation validation, sequence-sensitive grading, serializable saved arrangements.",
);
