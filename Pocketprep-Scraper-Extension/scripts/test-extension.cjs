const fs = require("fs"),
  vm = require("vm"),
  assert = require("assert/strict"),
  path = require("path");
const root = ".";
for (const f of [
  "store.js",
  "library.js",
  "popup.js",
  "collector.js",
  "background.js",
  "backup.js",
  "quiz/boot.js",
  "quiz/app.js",
])
  new vm.Script(fs.readFileSync(path.join(root, f), "utf8"), { filename: f });
const context = {};
vm.createContext(context);
vm.runInContext(fs.readFileSync(root + "/store.js", "utf8"), context);
const validate = (x) =>
  context.ExamStore.validate(JSON.parse(JSON.stringify(x)));
const sample = {
  id: "ccna",
  name: "Cisco CCNA",
  expectedCount: 650,
  questions: [
    {
      id: 1,
      stem: "Which layer routes packets?",
      options: [
        { key: "A", text: "Network" },
        { key: "B", text: "Physical" },
      ],
      answer: ["A"],
      explanation: "The network layer routes packets.",
    },
  ],
};
assert.equal(validate(sample).questions.length, 1);
assert.match(
  validate(sample).questions[0].optionExplanations.B,
  /shared explanation/,
);
for (const bad of [
  { ...sample, id: "cysa-original" },
  { ...sample, questions: [...sample.questions, ...sample.questions] },
  { ...sample, questions: [{ ...sample.questions[0], answer: ["C"] }] },
  {
    ...sample,
    questions: [
      { ...sample.questions[0], images: ["https://example.com/image.png"] },
    ],
  },
  { ...sample, expectedCount: 0 },
  { ...sample, questions: [{ ...sample.questions[0], answer: ["A", "A"] }] },
])
  assert.throws(() => validate(bad));
const manifest = JSON.parse(fs.readFileSync(root + "/manifest.json"));
assert.equal(manifest.manifest_version, 3);
assert.ok(!manifest.host_permissions);
assert.ok(manifest.permissions.includes("activeTab"));
const bankctx = { window: {} };
vm.runInNewContext(fs.readFileSync(root + "/quiz/bank.js", "utf8"), bankctx);
assert.equal(bankctx.window.QUESTION_BANK.length, 625);
assert.equal(
  bankctx.window.QUESTION_BANK.filter((q) => q.type === "pbq").length,
  11,
);
for (const q of bankctx.window.QUESTION_BANK)
  for (const im of q.images || [])
    assert.ok(
      fs.existsSync(root + "/quiz/" + (typeof im === "string" ? im : im.src)),
    );
const app = fs.readFileSync(root + "/quiz/app.js", "utf8");
const keyExpression = app.slice(
  app.indexOf("const KEY"),
  app.indexOf("const $"),
);
for (const [id, expected] of [
  ["cysa-original", "cysa-practice-v1"],
  ["pp-ccna", "exam-progress:pp-ccna"],
]) {
  const scope = { window: { EXAM: { id } } };
  vm.runInNewContext(keyExpression + ";result=KEY", scope);
  assert.equal(scope.result, expected);
}
console.log(
  "PASS: JS syntax, import validation, invalid/duplicate answers, offline-only images, isolated progress keys, manifest, 625 original questions and 11 PBQs.",
);
