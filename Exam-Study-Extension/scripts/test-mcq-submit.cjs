const fs = require("fs"),
  vm = require("vm"),
  assert = require("assert/strict");
const source = fs.readFileSync("./collector.js", "utf8");
const fn = source.slice(
  source.indexOf("async function prepareStudy"),
  source.indexOf("async function saveOne"),
);
async function run({
  multi = false,
  automatic = false,
  missing = false,
  allow = true,
} = {}) {
  let feedback = false,
    submits = 0;
  const choices = Array.from({ length: 4 }, () => ({
    checked: false,
    getAttribute: () => null,
    click() {
      this.checked = true;
      if (automatic) feedback = true;
    },
  }));
  const button = {};
  const c = {
    stop: false,
    visible: () => true,
    get: (k) =>
      k === "stem"
        ? { innerText: multi ? "Choose two." : "Select one." }
        : null,
    answerElements: () => (feedback ? [{}] : []),
    gradedOrder: () => false,
    orderList: () => null,
    ui: { querySelector: () => ({ checked: allow }) },
    document: { querySelectorAll: () => choices },
    label: () => "",
    norm: (s) => s,
    sleep: async () => {},
    autoButton: (pattern) =>
      !missing && pattern.test("Check Answer") ? button : null,
    clickControl: (el) => {
      assert.equal(el, button);
      submits++;
      feedback = true;
    },
  };
  vm.createContext(c);
  vm.runInContext(fn, c);
  if (missing || !allow) {
    await assert.rejects(
      c.prepareStudy(),
      missing ? /Check Answer button/ : /Enable the study-history/,
    );
    assert.equal(submits, 0);
    return;
  }
  await c.prepareStudy();
  assert.equal(submits, automatic ? 0 : 1);
  assert.equal(choices.filter((x) => x.checked).length, multi ? 2 : 1);
  assert.equal(feedback, true);
}
(async () => {
  await run();
  await run({ multi: true });
  await run({ automatic: true });
  await run({ missing: true });
  await run({ allow: false });
  console.log(
    "PASS: single-choice and multi-choice submit automatically, already-graded answers are not resubmitted, missing controls and disabled history permission stop safely.",
  );
})();
