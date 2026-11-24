"use strict";
// IndexedDB holds large question banks and embedded images; progress lives separately.
globalThis.ExamStore = {
  db() {
    return new Promise((resolve, reject) => {
      const r = indexedDB.open("exam-library", 1);
      r.onupgradeneeded = () =>
        r.result.createObjectStore("exams", { keyPath: "id" });
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
  },
  async run(mode, action) {
    const db = await this.db();
    return new Promise((resolve, reject) => {
      const tx = db.transaction("exams", mode);
      const r = action(tx.objectStore("exams"));
      tx.oncomplete = () => {
        db.close();
        resolve(r.result);
      };
      tx.onerror = () => {
        db.close();
        reject(tx.error);
      };
      tx.onabort = () => {
        db.close();
        reject(tx.error || new Error("Storage operation cancelled"));
      };
    });
  },
  all() {
    return this.run("readonly", (s) => s.getAll());
  },
  get(id) {
    return this.run("readonly", (s) => s.get(id));
  },
  put(exam) {
    return this.run("readwrite", (s) => s.put(exam));
  },
  // A library restore commits every bank together, or none if a write fails.
  putMany(exams) {
    return this.run("readwrite", (store) => {
      for (const exam of exams) store.put(exam);
      return { result: exams.length };
    });
  },
  // Reject unsupported question types and remote image URLs before persisting imports.
  validate(raw) {
    const fail = (m) => {
      throw new Error(m);
    };
    const str = (v, label) =>
      typeof v === "string" && v.trim() && v.length <= 100000
        ? v
        : fail("Missing or invalid " + label);
    if (!raw || !/^[-a-z0-9]{1,80}$/.test(raw.id) || raw.id === "cysa-original")
      fail(
        "Use a unique exam id containing lowercase letters, numbers and hyphens.",
      );
    if (
      !Array.isArray(raw.questions) ||
      !raw.questions.length ||
      raw.questions.length > 20000
    )
      fail("Provide 1–20,000 questions.");
    const ids = new Set();
    const questions = raw.questions.map((q, i) => {
      if (!Number.isSafeInteger(q.id) || q.id < 1 || ids.has(q.id))
        fail("Duplicate or invalid question number at item " + (i + 1));
      ids.add(q.id);
      if (q.type && !["mcq", "order"].includes(q.type))
        fail("Imported questions support multiple choice and ordering.");
      if (
        !Array.isArray(q.options) ||
        q.options.length < 2 ||
        q.options.length > 20
      )
        fail("Question " + q.id + " needs 2–20 choices.");
      const keys = new Set();
      const options = q.options.map((o) => {
        if (!/^[A-Z]{1,2}$/.test(o.key) || keys.has(o.key))
          fail("Invalid or duplicate choice in question " + q.id);
        keys.add(o.key);
        return { key: o.key, text: str(o.text, "choice text") };
      });
      if (
        !Array.isArray(q.answer) ||
        !q.answer.length ||
        new Set(q.answer).size !== q.answer.length ||
        q.answer.some((k) => !keys.has(k))
      )
        fail("Missing or invalid answer for question " + q.id);
      if (q.type === "order" && q.answer.length !== options.length)
        fail("An ordering answer must contain every item exactly once.");
      const explanation = str(
        q.explanation,
        "explanation for question " + q.id,
      );
      const optionExplanations = {};
      for (const o of options)
        optionExplanations[o.key] = q.optionExplanations?.[o.key]
          ? str(q.optionExplanations[o.key], "choice explanation")
          : "The source provides a shared explanation: " + explanation;
      const images = (q.images || []).map((im) => {
        if (
          typeof im !== "string" ||
          !/^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(im)
        )
          fail(
            "Images must be embedded PNG, JPEG, WebP or GIF data URLs for offline use.",
          );
        return im;
      });
      return {
        id: q.id,
        type: q.type || "mcq",
        stem: str(q.stem, "question text"),
        options,
        answer: [...q.answer],
        explanation,
        optionExplanations,
        images,
      };
    });
    if (
      raw.expectedCount !== undefined &&
      (!Number.isSafeInteger(raw.expectedCount) ||
        raw.expectedCount < questions.length)
    )
      fail("Expected total must be at least the number imported.");
    const serials = {};
    if (raw.serials !== undefined) {
      if (
        !raw.serials ||
        typeof raw.serials !== "object" ||
        Array.isArray(raw.serials)
      )
        fail("Invalid source question identifiers.");
      for (const [serial, id] of Object.entries(raw.serials)) {
        if (!serial || serial.length > 500 || !ids.has(id))
          fail("Invalid source question identifier.");
        Object.defineProperty(serials, serial, { value: id, enumerable: true });
      }
    }
    return {
      id: raw.id,
      name: str(raw.name, "exam name").slice(0, 200),
      expectedCount: raw.expectedCount || questions.length,
      questions,
      serials,
      ...(typeof raw.source === "string"
        ? { source: raw.source.slice(0, 500) }
        : {}),
      updatedAt: new Date().toISOString(),
    };
  },
};
