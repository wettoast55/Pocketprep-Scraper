"use strict";
// The library is the entry point for exam selection and portable data files.
function download(value, name) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(
    new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }),
  );
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
async function show() {
  const exams = [];
  for (const stored of await ExamStore.all()) {
    const exam = QuestionIdentity.deduplicate(stored);
    const key = "exam-progress:" + exam.id;
    const saved = localStorage.getItem(key);
    if (saved)
      localStorage.setItem(
        key,
        JSON.stringify(QuestionIdentity.remapProgress(JSON.parse(saved), exam)),
      );
    exams.push(exam);
  }
  const list = document.querySelector("#exams");
  list.replaceChildren();
  if (!exams.length)
    list.textContent =
      "No exams yet. Collect authorized questions or import a bank to begin.";
  for (const exam of exams) {
    const card = document.createElement("article");
    card.className = "exam";
    const h = document.createElement("h2");
    h.textContent = exam.name;
    const p = document.createElement("p");
    const count = exam.count || exam.questions.length;
    p.textContent =
      count +
      " / " +
      exam.expectedCount +
      " questions · " +
      (count === exam.expectedCount
        ? "Expected count reached"
        : "Partial bank");
    const a = document.createElement("a");
    a.className = "button";
    a.href = "quiz/index.html?exam=" + encodeURIComponent(exam.id);
    a.textContent = "Study / Resume";
    card.append(h, p, a);
    if (exam.version || exam.versionDate) {
      const detail = document.createElement("p");
      detail.textContent = [exam.version, exam.versionDate]
        .filter(Boolean)
        .join(" · ");
      card.append(detail);
    }
    if (exam.questions) {
      const b = document.createElement("button");
      b.className = "secondary";
      b.textContent = "Export question bank";
      b.onclick = () => download(exam, exam.id + ".json");
      card.append(b);
    }
    list.append(card);
  }
}
document.querySelector("#file").onchange = async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    if (file.size > 100 * 1024 * 1024)
      throw new Error("Maximum import size is 100 MB.");
    const exam = ExamStore.validate(JSON.parse(await file.text()));
    const old = await ExamStore.get(exam.id);
    if (
      old &&
      !confirm(
        "Replace " +
          old.name +
          "? Existing progress for this imported exam will be cleared. Export its progress first if needed.",
      )
    )
      return;
    await ExamStore.put(exam);
    if (old) localStorage.removeItem("exam-progress:" + exam.id);
    document.querySelector("#message").textContent =
      "Imported " +
      exam.questions.length +
      " distinct question numbers. " +
      (exam.questions.length === exam.expectedCount
        ? "Expected total reached."
        : "This bank is incomplete: " +
          (exam.expectedCount - exam.questions.length) +
          " questions remain.");
    await show();
  } catch (err) {
    document.querySelector("#message").textContent = err.message;
  } finally {
    e.target.value = "";
  }
};
show().catch(
  (e) => (document.querySelector("#message").textContent = e.message),
);

document.querySelector("#backup-export").onclick = async () => {
  try {
    download(await LibraryBackup.create(), "exam-study-library-backup.json");
    document.querySelector("#backup-message").textContent =
      "Backup downloaded. It includes imported exams and saved progress.";
  } catch (error) {
    document.querySelector("#backup-message").textContent = error.message;
  }
};
document.querySelector("#backup-import").onchange = async (event) => {
  const file = event.target.files[0];
  if (!file) return;
  try {
    if (file.size > 100 * 1024 * 1024)
      throw new Error("Maximum backup size is 100 MB.");
    const backup = LibraryBackup.validate(JSON.parse(await file.text()));
    if (
      !confirm(
        "Restore " +
          backup.exams.length +
          " imported exams and the included progress? Matching exams and their progress, will be replaced. Other exams stay unchanged. Export a backup first if needed.",
      )
    )
      return;
    await LibraryBackup.restore(backup);
    await show();
    document.querySelector("#backup-message").textContent =
      "Library restored. Close and reopen any quiz tabs to use the restored progress.";
  } catch (error) {
    document.querySelector("#backup-message").textContent = error.message;
  } finally {
    event.target.value = "";
  }
};
