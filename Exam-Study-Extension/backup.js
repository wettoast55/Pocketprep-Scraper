"use strict";

// Portable backups contain study data only. Browser permissions, sign-in sessions,
// and page-specific collector selectors remain with the original browser.
globalThis.LibraryBackup = {
  progressKey(examId) {
    return examId === "cysa-original"
      ? "cysa-practice-v1"
      : "exam-progress:" + examId;
  },

  async create() {
    const exams = await ExamStore.all();
    const progress = {};
    for (const id of ["cysa-original", ...exams.map((exam) => exam.id)]) {
      const saved = localStorage.getItem(this.progressKey(id));
      if (saved) progress[id] = JSON.parse(saved);
    }
    return {
      format: "exam-study-library",
      version: 1,
      exportedAt: new Date().toISOString(),
      exams,
      progress,
    };
  },

  // Validate every record before changing storage. Preserve source identifiers so
  // collecting in the destination browser does not duplicate existing questions.
  validate(data) {
    if (
      data?.format !== "exam-study-library" ||
      data.version !== 1 ||
      !Array.isArray(data.exams)
    ) {
      throw new Error(
        "Choose a library backup exported by Exam Study Library.",
      );
    }
    const ids = new Set(["cysa-original"]);
    const exams = data.exams.map((raw) => {
      const exam = ExamStore.validate(raw);
      if (ids.has(exam.id)) throw new Error("Duplicate exam in backup.");
      ids.add(exam.id);
      return exam;
    });
    if (
      !data.progress ||
      typeof data.progress !== "object" ||
      Array.isArray(data.progress)
    ) {
      throw new Error("Invalid progress in backup.");
    }
    const progress = {};
    for (const [id, state] of Object.entries(data.progress)) {
      if (
        !ids.has(id) ||
        !state ||
        typeof state !== "object" ||
        Array.isArray(state) ||
        !Number.isSafeInteger(state.current) ||
        !state.answers ||
        Array.isArray(state.answers) ||
        typeof state.answers !== "object" ||
        !Array.isArray(state.flags) ||
        state.flags.some((value) => !Number.isSafeInteger(value))
      ) {
        throw new Error("Invalid saved session in backup.");
      }
      const questions =
        id === "cysa-original"
          ? globalThis.QUESTION_BANK
          : exams.find((exam) => exam.id === id).questions;
      progress[id] = this.cleanProgress(state, questions);
    }
    return { exams, progress };
  },

  // Validate drafts against the destination bank and recompute scores. A backup
  // cannot introduce unknown questions or a result that contradicts its answers.
  cleanProgress(state, questions) {
    const byId = new Map(questions.map((question) => [question.id, question]));
    if (!byId.has(state.current))
      throw new Error("Saved position is not in this exam.");
    const clean = {
      current: state.current,
      answers: {},
      flags: state.flags.filter((id) => byId.has(id)),
      inProgress: {},
      console: {},
      paused: Boolean(state.paused),
    };
    const normalize = (value) =>
      String(value ?? "")
        .toLowerCase()
        .trim()
        .replace(/\s+/g, " ");
    const validateDraft = (question, draft) => {
      if (!draft || typeof draft !== "object" || Array.isArray(draft))
        throw new Error("Invalid answer draft.");
      if (question.type === "mcq" || question.type === "order") {
        const key = question.type === "order" ? "sequence" : "selected";
        if (draft[key] === undefined) return {};
        const values = draft[key];
        if (
          !Array.isArray(values) ||
          new Set(values).size !== values.length ||
          values.some(
            (value) => !question.options.some((option) => option.key === value),
          ) ||
          (key === "sequence" && values.length !== question.options.length)
        )
          throw new Error("Invalid answer choices.");
        return { [key]: [...values] };
      }
      const result = {};
      for (const field of question.lab.fields) {
        const value = draft[field.id];
        if (value === undefined) continue;
        if (field.type === "multiselect") {
          if (
            !Array.isArray(value) ||
            value.some((item) => !field.options.includes(item))
          )
            throw new Error("Invalid lab choices.");
          result[field.id] = [...new Set(value)];
        } else {
          if (
            typeof value !== "string" ||
            value.length > 5000 ||
            (field.type === "select" &&
              value !== "" &&
              !field.options.includes(value))
          )
            throw new Error("Invalid lab answer.");
          result[field.id] = value;
        }
      }
      return result;
    };
    for (const [id, attempt] of Object.entries(state.answers)) {
      const question = byId.get(Number(id));
      if (!question || !attempt) throw new Error("Unknown saved question.");
      const draft = validateDraft(question, attempt.draft);
      let result;
      if (question.type === "mcq") {
        const values = draft.selected || [];
        result = {
          correct: question.unscored
            ? null
            : values.length === question.answer.length &&
              values.every((value) => question.answer.includes(value)),
        };
      } else if (question.type === "order") {
        result = {
          correct:
            draft.sequence?.length === question.answer.length &&
            draft.sequence.every(
              (value, index) => value === question.answer[index],
            ),
        };
      } else {
        const checks = question.lab.fields
          .filter((field) => !field.unscored)
          .map((field) => {
            const value = draft[field.id],
              accepted = field.answer || [];
            return field.type === "multiselect"
              ? Array.isArray(value) &&
                  value.length === accepted.length &&
                  accepted.every((item) =>
                    value.map(normalize).includes(normalize(item)),
                  )
              : accepted.map(normalize).includes(normalize(value));
          });
        result = {
          correct:
            question.lab.unscored || !checks.length
              ? null
              : checks.every(Boolean),
          points: checks.filter(Boolean).length,
          total: checks.length,
        };
      }
      clean.answers[id] = {
        ...result,
        draft,
        at:
          typeof attempt.at === "string"
            ? attempt.at
            : new Date().toISOString(),
      };
    }
    for (const [id, draft] of Object.entries(state.inProgress || {})) {
      const question = byId.get(Number(id));
      if (!question) throw new Error("Unknown unfinished question.");
      clean.inProgress[id] = validateDraft(question, draft);
    }
    for (const [id, value] of Object.entries(state.console || {})) {
      if (byId.has(Number(id)) && typeof value === "string")
        clean.console[id] = value.slice(-50000);
    }
    if (typeof state.savedAt === "string") clean.savedAt = state.savedAt;
    return clean;
  },

  async restore(backup) {
    const ids = ["cysa-original", ...backup.exams.map((exam) => exam.id)];
    const previous = new Map(
      ids.map((id) => [
        this.progressKey(id),
        localStorage.getItem(this.progressKey(id)),
      ]),
    );
    try {
      // localStorage cannot join an IndexedDB transaction. Write progress first,
      // then commit all banks together; restore progress if either write fails.
      for (const id of ids) {
        const key = this.progressKey(id);
        if (backup.progress[id])
          localStorage.setItem(key, JSON.stringify(backup.progress[id]));
        else localStorage.removeItem(key);
      }
      await ExamStore.putMany(backup.exams);
    } catch (error) {
      for (const [key, value] of previous) {
        if (value === null) localStorage.removeItem(key);
        else localStorage.setItem(key, value);
      }
      throw error;
    }
  },
};
