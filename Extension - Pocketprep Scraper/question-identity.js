"use strict";

// Compare content rather than display letters or source IDs: Pocket Prep can
// shuffle choices and expose the same question through different quiz routes.
globalThis.QuestionIdentity = {
  text(value) {
    return String(value || "")
      .normalize("NFKC")
      .replace(/\s+/g, " ")
      .trim();
  },
  key(question) {
    return JSON.stringify([
      question.type || "mcq",
      this.text(question.stem),
      question.options.map((option) => this.text(option.text)).sort(),
      (question.images || [])
        .map((image) => (typeof image === "string" ? image : image.src))
        .sort(),
    ]);
  },
  solution(question) {
    const answer = question.answer.map((key) =>
      this.text(question.options.find((option) => option.key === key)?.text),
    );
    return JSON.stringify(question.type === "order" ? answer : answer.sort());
  },
  deduplicate(bank) {
    const seen = new Map(),
      questions = [],
      aliases = { ...(bank.duplicateIds || {}) };
    for (const question of bank.questions) {
      const key = this.key(question),
        existing = seen.get(key);
      if (!existing) {
        seen.set(key, question);
        questions.push(question);
        continue;
      }
      if (this.solution(existing) !== this.solution(question)) {
        throw new Error(
          "Repeated question has conflicting answers. Review question " +
            question.id +
            ".",
        );
      }
      // Keep the earliest ID. Translate shuffled letters when restoring progress.
      const keys = Object.fromEntries(
        question.options.map((option) => [
          option.key,
          existing.options.find(
            (item) => this.text(item.text) === this.text(option.text),
          ).key,
        ]),
      );
      aliases[question.id] = { id: existing.id, keys };
    }
    const serials = Object.fromEntries(
      Object.entries(bank.serials || {}).map(([serial, id]) => [
        serial,
        aliases[id]?.id || id,
      ]),
    );
    return { ...bank, questions, serials, duplicateIds: aliases };
  },
  remapProgress(state, bank) {
    const aliases = bank.duplicateIds || {},
      result = structuredClone(state);
    const resolve = (id) => aliases[id]?.id || Number(id);
    const translate = (id, draft) => {
      const copy = structuredClone(draft),
        mapping = aliases[id]?.keys;
      if (mapping && copy)
        for (const field of ["selected", "sequence"]) {
          if (Array.isArray(copy[field]))
            copy[field] = copy[field].map((key) => mapping[key] || key);
        }
      return copy;
    };
    result.current = resolve(result.current);
    result.flags = [...new Set((result.flags || []).map(resolve))];
    result.answers = {};
    for (const [id, answer] of Object.entries(state.answers || {})) {
      const target = resolve(id),
        previous = result.answers[target];
      if (!previous || String(answer.at || "") > String(previous.at || ""))
        result.answers[target] = {
          ...answer,
          draft: translate(id, answer.draft),
        };
    }
    result.inProgress = {};
    for (const [id, draft] of Object.entries(state.inProgress || {}))
      result.inProgress[resolve(id)] = translate(id, draft);
    return result;
  },
};
