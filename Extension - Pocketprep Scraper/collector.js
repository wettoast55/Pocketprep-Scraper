// Operates only on the currently authorized, signed-in Pocket Prep tab.
// No cookies, tokens, hidden application state or undocumented endpoints are read.
(() => {
  "use strict";
  if (globalThis.__examCollector) return;
  globalThis.__examCollector = true;
  let exam,
    config = {},
    running = false,
    stop = false,
    smartMode = false,
    lastStatus = "",
    settings = {};
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const visible = (el) =>
    el &&
    el.getClientRects().length &&
    getComputedStyle(el).visibility !== "hidden";
  const norm = (s) =>
    String(s || "")
      .replace(/\s+/g, " ")
      .trim();
  const label = (el) =>
    norm(
      el.getAttribute("aria-label") ||
        el.getAttribute("alt") ||
        el.innerText ||
        el.textContent,
    );
  const defaults = {
    stem: ".uikit-question__prompt",
    explanation:
      ".uikit-question-summary__summary-dropdown-explanation-text,.uikit-question-dropdown-explanation__dropdown-explanation-text,.uikit-question-explanation__explanation-text",
    images: ".uikit-question__main",
  };
  const get = (key) => {
    try {
      return (
        [
          ...document.querySelectorAll(
            defaults[key] || config[key] || ":not(*)",
          ),
        ].find(visible) || null
      );
    } catch {
      return null;
    }
  };
  function pulse() {
    if (!exam) return;
    chrome.runtime
      .sendMessage({
        type: "sessionPulse",
        running,
        smart: smartMode,
        status: lastStatus,
      })
      .catch(() => {});
  }
  function status(message) {
    lastStatus = message;
    pulse();
  }
  setInterval(pulse, 15000);
  function answerElements() {
    return [...document.querySelectorAll("[aria-label]")].filter(
      (el) =>
        visible(el) && /^(?:Incorrect|Correct) Answer\s*,/i.test(label(el)),
    );
  }
  function orderList() {
    return [
      ...document.querySelectorAll(
        ".uikit-question-build-list-choices-container",
      ),
    ].find(visible);
  }
  function gradedOrder() {
    const list = orderList();
    return (
      list &&
      ["--correct", "--incorrect"].some((s) =>
        list.classList.contains(
          "uikit-question-build-list-choices-container" + s,
        ),
      )
    );
  }
  // Incorrectly positioned rows show a correction number; unchanged rows retain their position.
  function extractOrder() {
    const list = orderList();
    if (!gradedOrder())
      throw new Error("The correct sequence has not been revealed yet.");
    const rows = [
      ...list.querySelectorAll(
        ".uikit-question-build-list-choices-container__choice-container",
      ),
    ];
    const positions = rows.map((row, i) => {
      const marker = row.querySelector(
        ".uikit-question-build-list-choices-container__correct-position-order-number",
      );
      return marker ? Number(marker.textContent.trim()) : i + 1;
    });
    const advertisedCount = Number(
      list.getAttribute?.("aria-label")?.match(/List with (\d+) items/i)?.[1],
    );
    if (
      rows.length < 2 ||
      rows.length > 100 ||
      (advertisedCount && advertisedCount !== rows.length) ||
      new Set(positions).size !== rows.length ||
      positions.some((n) => !Number.isInteger(n) || n < 1 || n > rows.length)
    )
      throw new Error("The displayed correct sequence is incomplete.");
    const options = rows.map((row, i) => ({
      key:
        i < 26
          ? String.fromCharCode(65 + i)
          : String.fromCharCode(64 + Math.floor(i / 26)) +
            String.fromCharCode(65 + (i % 26)),
      text: (() => {
        const element = row.querySelector(
          ".uikit-question-build-list-choices-container__choice-text",
        );
        return (element?.innerText || element?.textContent || "").trim();
      })(),
    }));
    if (options.some((o) => !o.text))
      throw new Error("An ordering item is missing its text.");
    return {
      type: "order",
      options,
      answer: positions
        .map((n, i) => ({ n, key: options[i].key }))
        .sort((a, b) => a.n - b.n)
        .map((x) => x.key),
    };
  }
  function autoButton(pattern) {
    return [
      ...document.querySelectorAll(
        "button,[role=button],img[alt],[aria-label]",
      ),
    ].find((el) => visible(el) && pattern.test(label(el)));
  }
  function clickControl(el) {
    if (!el)
      throw new Error(
        "The expected quiz control was not found. Collection paused.",
      );
    const target = el.closest("button,[role=button],a") || el;
    if (
      target.disabled ||
      target.getAttribute("aria-disabled") === "true" ||
      el.getAttribute("aria-disabled") === "true"
    )
      throw new Error("End of available questions, or control disabled.");
    target.dispatchEvent(
      new MouseEvent("click", {
        bubbles: true,
        cancelable: true,
        view: window,
      }),
    );
  }
  function identity() {
    return (
      new URL(location.href).searchParams.get("questionSerial") ||
      norm(get("stem")?.innerText)
    );
  }
  // Embed evidence in the saved bank so the quiz does not need a network connection.
  async function embed(im) {
    if (!im.complete || !im.naturalWidth)
      throw new Error("An evidence image has not loaded.");
    const src = im.currentSrc || im.src;
    if (/^data:image\/(png|jpeg|webp|gif);base64,/.test(src)) return src;
    const canvas = document.createElement("canvas");
    canvas.width = im.naturalWidth;
    canvas.height = im.naturalHeight;
    try {
      canvas.getContext("2d").drawImage(im, 0, 0);
      return canvas.toDataURL("image/png");
    } catch {
      throw new Error(
        "An image cannot be saved offline from this page. Capture stopped to avoid losing evidence.",
      );
    }
  }
  async function extract() {
    const stemEl = get("stem"),
      explanationEl = get("explanation");
    if (!visible(stemEl) || !visible(explanationEl))
      throw new Error("Open a reviewed question with its explanation visible.");
    const stem = stemEl.innerText.trim(),
      explanation = explanationEl.innerText.trim();
    if (!stem || !explanation)
      throw new Error("Question or explanation is empty.");
    const ordered = orderList() ? extractOrder() : null;
    const els = answerElements();
    if (!ordered && (els.length < 2 || els.length > 20))
      throw new Error(
        "Could not identify graded answers. Collection stopped without skipping this item.",
      );
    const options = els.map((el, i) => ({
      key: String.fromCharCode(65 + i),
      text: label(el).replace(/^(Incorrect|Correct) Answer\s*,\s*/i, ""),
    }));
    const answer = els.flatMap((el, i) =>
      /^Correct Answer\s*,/i.test(label(el)) ? [options[i].key] : [],
    );
    if (!ordered && !answer.length)
      throw new Error("The correct answer is not visible yet.");
    if (
      options.some((o) => stem === o.text) ||
      /^(Show|Hide) Explanation$/i.test(explanation)
    )
      throw new Error(
        "Select the actual question/explanation text, not a choice or toggle button.",
      );
    const roots = [stemEl, explanationEl, get("images")].filter(Boolean);
    const imgs = [
      ...new Set(
        roots.flatMap((el) =>
          el.matches("img") ? [el] : [...el.querySelectorAll("img")],
        ),
      ),
    ].filter(visible);
    const images = await Promise.all(imgs.map(embed));
    return {
      stem,
      explanation,
      options,
      answer,
      images,
      optionExplanations: Object.fromEntries(
        options.map((o) => [o.key, "Source explanation: " + explanation]),
      ),
      ...ordered,
    };
  }
  async function reveal() {
    const button = autoButton(/^Show Explanation$/i) || get("reveal");
    if (
      button &&
      button.getAttribute("aria-expanded") !== "true" &&
      !/^Hide Explanation$/i.test(label(button))
    ) {
      clickControl(button);
      await sleep(500);
    }
  }
  // Submitting an arbitrary selection reveals source feedback only when the user opts in.
  async function prepareStudy() {
    if (!visible(get("stem")))
      throw new Error(
        "Question text not found. Wait for the quiz to finish loading before retrying.",
      );
    if (answerElements().length || gradedOrder()) return;
    if (!settings.allowHistory)
      throw new Error(
        "This question is unanswered. Enable the study-history option to submit an answer.",
      );
    if (orderList()) {
      const submit = autoButton(/^Check (?:answer|order)$/i) || get("submit");
      if (!submit)
        throw new Error(
          "The ordering question’s Check Answer control is unavailable. Wait for the question to load, then retry.",
        );
      clickControl(submit);
      for (let i = 0; i < 60 && !stop && !gradedOrder(); i++) await sleep(250);
      if (!gradedOrder())
        throw new Error(
          "The ordering feedback did not appear. Saved questions are retained.",
        );
      return;
    }
    const choices = [
      ...document.querySelectorAll(
        "input[type=radio],input[type=checkbox],[role=radio],[role=checkbox]",
      ),
    ].filter(
      (el) =>
        visible(el) && !el.disabled && !/flag|community|stats/i.test(label(el)),
    );
    if (!choices.length) throw new Error("No supported study choices found.");
    const stem = norm(get("stem")?.innerText);
    const match = stem.match(/(?:choose|select)\s+(two|three|four|\d+)/i);
    const n = match
      ? { two: 2, three: 3, four: 4 }[match[1].toLowerCase()] ||
        Number(match[1])
      : 1;
    if (n > choices.length)
      throw new Error("Required choice count could not be determined.");
    for (let i = 0; i < n; i++)
      if (
        !choices[i].checked &&
        choices[i].getAttribute("aria-checked") !== "true"
      )
        choices[i].click();
    await sleep(250);
    if (stop) return;
    if (!answerElements().length) {
      const submit = autoButton(/^Check Answer$/i) || get("submit");
      if (!submit)
        throw new Error(
          "The Check Answer button was not found. Wait for the question to finish loading before retrying.",
        );
      clickControl(submit);
    }
    for (let i = 0; i < 20 && !stop && !answerElements().length; i++)
      await sleep(250);
    if (!answerElements().length)
      throw new Error(
        "Answer feedback did not appear. Select the submit/check-answer control or finish this question manually.",
      );
  }
  async function saveOne() {
    await prepareStudy();
    const serial = identity();
    if (!serial) throw new Error("Question identity is unavailable.");
    // Long lists and their explanations can render in separate updates. Require
    // two matching captures before saving, and retry incomplete DOM snapshots.
    let question,
      previous = "",
      lastError;
    for (let attempt = 0; attempt < 40 && !stop; attempt++) {
      if (identity() !== serial)
        throw new Error("The question changed during capture. Please retry.");
      try {
        await reveal();
        const candidate = await extract();
        const snapshot = JSON.stringify(candidate);
        if (snapshot === previous) {
          question = candidate;
          break;
        }
        previous = snapshot;
      } catch (error) {
        lastError = error;
        previous = "";
      }
      await sleep(250);
    }
    if (stop) throw new Error("Collection stopped.");
    if (!question)
      throw (
        lastError ||
        new Error("Question content did not finish rendering. Please retry.")
      );
    const sourceSerial =
      new URL(location.href).searchParams.get("questionSerial") ||
      "content-" +
        Array.from(
          new Uint8Array(
            await crypto.subtle.digest(
              "SHA-256",
              new TextEncoder().encode(serial),
            ),
          ),
          (byte) => byte.toString(16).padStart(2, "0"),
        ).join("");
    const result = await chrome.runtime.sendMessage({
      type: "saveQuestion",
      exam,
      serial: sourceSerial,
      question,
    });
    if (result.error) throw new Error(result.error);
    status(
      result.count +
        " / " +
        exam.expectedCount +
        " distinct questions saved" +
        (result.duplicate ? " (already collected)" : "") +
        ".",
    );
    return result;
  }
  // Smart mode walks the same visible quiz controls as a learner. Only the
  // builder adapter creates another batch; extraction failures always pause.
  async function collect(all, smart = false) {
    if (running) return;
    if (smart && !settings.allowHistory && location.pathname !== "/quiz") {
      status("Enable answer submission before starting Smart Collect.");
      return;
    }
    running = true;
    stop = false;
    smartMode = smart;
    pulse();
    try {
      const visited = new Set();
      let batchStartCount = null;
      while (!stop) {
        if (smart && location.pathname !== "/quiz") {
          await ExamSmartFlow.navigateToBuilder(() => stop, status);
          if (location.pathname !== "/quiz") {
            if (!settings.allowHistory)
              throw new Error(
                "Enable submitting answers to unseen questions to start another batch.",
              );
            const current = await chrome.runtime.sendMessage({
              type: "collectorStatus",
              exam,
            });
            if (current.error) throw new Error(current.error);
            const built = await ExamSmartFlow.build(() => stop, status);
            if (built.exhausted) {
              status(
                "No new questions remain. " +
                  current.count +
                  " / " +
                  exam.expectedCount +
                  " saved." +
                  (current.count < exam.expectedCount
                    ? " Previously seen questions may still need collection from Review."
                    : ""),
              );
              break;
            }
            batchStartCount = current.count;
          }
        }
        // Resuming a saved quiz changes the URL before its question is mounted.
        await ExamSmartFlow.wait(
          () => visible(get("stem")),
          () => stop,
          "question content",
          30000,
        );
        const before = identity();
        if (visited.has(before))
          throw new Error("This question set looped back to an earlier item.");
        visited.add(before);
        const result = await saveOne();
        if (!all || stop) break;
        if (smart && ExamSmartFlow.find(/^Submit Quiz$/i)) {
          if (batchStartCount !== null && result.count === batchStartCount)
            throw new Error(
              "The last batch added no new captures. Collection paused.",
            );
          await ExamSmartFlow.finish(() => stop, status);
          if (result.count >= exam.expectedCount) {
            status(
              "Collection complete. " +
                result.count +
                " distinct questions saved.",
            );
            break;
          }
          continue;
        }
        if (result.count >= exam.expectedCount) {
          status(
            "Collection complete. " +
              result.count +
              " distinct questions saved.",
          );
          break;
        }
        clickControl(autoButton(/^Next question$/i) || get("next"));
        await ExamSmartFlow.wait(
          () => identity() && identity() !== before,
          () => stop,
          "next question",
        );
        await sleep(600);
      }
    } catch (error) {
      status("Paused: " + error.message + " Earlier captures are saved.");
    } finally {
      running = false;
      smartMode = false;
      pulse();
    }
  }
  // The content script has no separate window or widget. The browser sidebar
  // owns setup, preview, status and the single begin/pause control.
  chrome.runtime.onMessage.addListener((message, sender, reply) => {
    if (message.type === "collectorCommand") {
      if (message.command === "stop") {
        stop = true;
        status("Pausing after the current operation.");
        reply({ ok: true });
      } else if (message.command === "smart") {
        collect(true, true);
        reply({ ok: true });
      } else if (message.command === "preview") {
        if (running) {
          reply({ error: "Pause collection before previewing." });
          return;
        }
        (async () => {
          await reveal();
          return { question: await extract() };
        })().then(reply, (error) => reply({ error: error.message }));
        return true;
      }
      return;
    }
    if (message.type !== "openCollector") return;
    if (running) {
      reply({ ok: true });
      return;
    }
    exam = message.exam;
    settings = message.settings || {};
    (async () => {
      config =
        (await chrome.storage.local.get("mapping:" + exam.id))[
          "mapping:" + exam.id
        ] || {};
      const result = await chrome.runtime.sendMessage({
        type: "collectorStatus",
        exam,
      });
      if (result.error) throw new Error(result.error);
      status(
        result.count +
          " / " +
          exam.expectedCount +
          " distinct questions saved.",
      );
      reply({ ok: true });
      if (message.resume) collect(true, Boolean(settings.smart));
    })().catch((error) => reply({ error: error.message }));
    return true;
  });
})();
