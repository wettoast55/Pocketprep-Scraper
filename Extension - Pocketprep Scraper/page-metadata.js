"use strict";

// This function is injected by a toolbar click. Read rendered page content only;
// quiz length, question counters, copyright years and today's date are not exam metadata.
function readExamMetadata() {
  const visible = (element) =>
    element.getClientRects().length &&
    getComputedStyle(element).visibility !== "hidden";
  const text = (element) =>
    (element.innerText || "").replace(/\s+/g, " ").trim();
  const unique = (values) => {
    const found = [...new Set(values.filter(Boolean))];
    return found.length === 1 ? found[0] : "";
  };
  const names = [
    ...document.querySelectorAll(
      ".head__exam-mobile-name,.exam-menu__selected-exam .exam-card__name",
    ),
  ]
    .filter(visible)
    .map(text);
  const lines = (document.body.innerText || "")
    .split(/\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const explicitName = lines.flatMap((line) => {
    const match = line.match(/^Exam name\s*:\s*(.+)$/i);
    return match ? [match[1]] : [];
  });
  const total = unique(
    lines.flatMap((line) => {
      const match =
        line.match(
          /^(?:Question bank total|Total (?:exam |bank )?questions|Total questions in (?:this |the )?exam)\s*:\s*([\d,]+)$/i,
        ) || line.match(/^([\d,]+)\s+(?:total|unique|distinct)\s+questions$/i);
      return match ? [match[1].replace(/,/g, "")] : [];
    }),
  );
  const version = unique(
    lines.flatMap((line) => {
      const match = line.match(
        /^(?:Exam version|Exam code|Version)\s*:\s*(.+)$/i,
      );
      return match ? [match[1]] : [];
    }),
  );
  const date = unique(
    lines.flatMap((line) => {
      const match = line.match(
        /^(?:Exam version date|Version date|Exam updated|Exam last updated|Exam effective date)\s*:\s*(.+)$/i,
      );
      return match ? [match[1]] : [];
    }),
  );
  return {
    name: unique([...names, ...explicitName]),
    expectedCount: total,
    version,
    versionDate: date,
  };
}
