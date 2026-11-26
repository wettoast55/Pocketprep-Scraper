"use strict";
// This adapter uses displayed controls only. It never requests hidden question
// APIs. Unexpected screens stop the run instead of guessing at a destructive action.
globalThis.ExamSmartFlow = {
  visible(element) {
    return (
      element &&
      element.getClientRects().length &&
      getComputedStyle(element).visibility !== "hidden"
    );
  },
  name(element) {
    const labelled = element.getAttribute("aria-labelledby");
    return (
      element.getAttribute("aria-label") ||
      (labelled &&
        labelled
          .split(/\s+/)
          .map((id) => document.getElementById(id)?.textContent || "")
          .join(" ")) ||
      element.getAttribute("title") ||
      element.innerText ||
      element.textContent ||
      ""
    )
      .replace(/\s+/g, " ")
      .trim();
  },
  find(pattern, selector = 'button,[role="button"],a,[aria-label],[title]') {
    return [...document.querySelectorAll(selector)].find(
      (element) => this.visible(element) && pattern.test(this.name(element)),
    );
  },
  checked(element) {
    return (
      element.checked === true ||
      element.getAttribute("aria-checked") === "true"
    );
  },
  async wait(predicate, stopped, description, timeout = 15000) {
    const start = Date.now();
    while (!stopped() && Date.now() - start < timeout) {
      const value = predicate();
      if (value) return value;
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    throw new Error(
      stopped()
        ? "Collection stopped."
        : "Timed out waiting for " + description + ".",
    );
  },
  click(element) {
    if (
      !element ||
      element.disabled ||
      element.getAttribute("aria-disabled") === "true"
    )
      throw new Error("A required quiz control is unavailable.");
    (element.closest('button,[role="button"],a') || element).dispatchEvent(
      new MouseEvent("click", {
        bubbles: true,
        cancelable: true,
        view: window,
      }),
    );
  },
  async toggle(pattern, required, stopped) {
    const selector =
      'input[type="checkbox"],input[type="radio"],[role="checkbox"],[role="radio"]';
    const control = await this.wait(
      () => this.find(pattern, selector),
      stopped,
      "quiz setting " + pattern,
    );
    if (this.checked(control) !== required) this.click(control);
    await this.wait(
      () => {
        const current = this.find(pattern, selector);
        return current && this.checked(current) === required;
      },
      stopped,
      "confirmation of quiz setting " + pattern,
    );
  },
  async build(stopped, report) {
    report("Smart Collect: configuring Build Your Own for new questions only.");
    await this.toggle(/^All Subjects$/i, true, stopped);
    await this.toggle(/^Show answers as I go$/i, true, stopped);
    await this.toggle(/^Manual Submit/i, true, stopped);
    await this.toggle(/^New Questions$/i, true, stopped);
    for (const name of [
      "Answered Questions",
      "Flagged Questions",
      "Incorrect Questions",
    ])
      await this.toggle(new RegExp("^" + name + "$", "i"), false, stopped);
    // Vue replaces the slider when the pool changes. Read the current element
    // until the maximum settles instead of retaining a detached old slider.
    let lastMaximum = null,
      stableSince = Date.now();
    const slider = await this.wait(
      () => {
        const current = document.querySelector("#questions-slider");
        if (!current) return false;
        const limit = Number(
          current.max || current.getAttribute("aria-valuemax"),
        );
        if (limit !== lastMaximum) {
          lastMaximum = limit;
          stableSince = Date.now();
        }
        return Date.now() - stableSince >= 1500 ? current : false;
      },
      stopped,
      "stable question limit",
    );
    const maximum = lastMaximum;
    if (!Number.isInteger(maximum) || maximum < 0)
      throw new Error("Could not read the builder's question limit.");
    if (maximum === 0) return { exhausted: true };
    const input =
      document.querySelector(".byoq__questions-count input") ||
      [...document.querySelectorAll('input[type="number"],input[type="text"]')]
        .filter((element) => this.visible(element))
        .find((element) =>
          element.closest(".byoq__questions-right,.byoq__questions"),
        );
    if (!input)
      throw new Error("Could not identify the builder's question-count input.");
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    ).set.call(input, String(maximum));
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
    input.blur();
    await this.wait(
      () => {
        const current = document.querySelector("#questions-slider");
        return (
          Number(input.value) === maximum &&
          current &&
          Number(current.value || current.getAttribute("aria-valuenow")) ===
            maximum
        );
      },
      stopped,
      "maximum quiz size",
    );
    const start = await this.wait(
      () => {
        const button = this.find(/^Start Quiz$/i);
        return button && !button.disabled ? button : null;
      },
      stopped,
      "Start Quiz",
    );
    // Check the live controls again after the builder finishes updating. A
    // missing or changed filter must stop collection, never broaden the pool.
    this.verifyNewOnly();
    report("Smart Collect: starting " + maximum + " new questions.");
    this.click(start);
    await this.wait(
      () =>
        location.pathname === "/quiz" &&
        document.querySelector(".uikit-question__prompt"),
      stopped,
      "quiz start",
    );
    return { exhausted: false, maximum };
  },
  verifyNewOnly() {
    for (const [name, required] of [
      ["New Questions", true],
      ["Answered Questions", false],
      ["Flagged Questions", false],
      ["Incorrect Questions", false],
    ]) {
      const control = this.find(
        new RegExp("^" + name + "$", "i"),
        '[role="checkbox"],input[type="checkbox"]',
      );
      if (!control || this.checked(control) !== required) {
        throw new Error(
          "New-only quiz filters could not be verified: " + name + ".",
        );
      }
    }
  },
  async navigateToBuilder(stopped, report) {
    if (location.pathname === "/build-your-own-quiz") return;
    // The results page offers a study/home/close control. Do not quit an active question.
    if (location.pathname !== "/study") {
      const exit = await this.wait(
        () => {
          const close = [
            ...document.querySelectorAll(".quiz-result-header__close-icon"),
          ].find((element) => this.visible(element));
          return (
            close ||
            this.find(
              /^(?:Back to Study|Return to Study|Back to Home|Done|Close)$/i,
            )
          );
        },
        stopped,
        "results Close control",
        30000,
      );
      if (exit) this.click(exit);
      else
        throw new Error(
          "Smart Collect needs the study, results, builder or quiz screen.",
        );
      await this.wait(
        () => location.pathname === "/study",
        stopped,
        "study screen",
      );
    }
    report("Smart Collect: opening Build Your Own.");
    this.click(
      await this.wait(
        () => this.find(/^(?:Start )?Build Your Own(?: quiz)?$/i),
        stopped,
        "Build Your Own",
      ),
    );
    await this.wait(
      () =>
        location.pathname === "/build-your-own-quiz" ||
        this.find(/^Yes,? Resume/i),
      stopped,
      "quiz builder",
    );
    const resume = this.find(/^Yes,? Resume/i);
    if (resume) {
      this.click(resume);
      await this.wait(
        () => location.pathname === "/quiz",
        stopped,
        "resumed quiz",
      );
    }
  },
  async finish(stopped, report) {
    const submit = this.find(/^Submit Quiz$/i);
    if (!submit)
      throw new Error("The last question has no Submit Quiz control.");
    report("Smart Collect: finishing this batch.");
    this.click(submit);
    // Only a button inside a confirmation dialog counts as confirmation. The
    // original Submit Quiz can remain visible while the site saves the batch.
    const confirmation = () =>
      [
        ...document.querySelectorAll(
          '[role="dialog"],.submit-quiz,.submit-exam',
        ),
      ]
        .filter((dialog) => this.visible(dialog))
        .flatMap((dialog) => [
          ...dialog.querySelectorAll('button,[role="button"]'),
        ])
        .find(
          (button) =>
            this.visible(button) &&
            /^(?:Yes,? )?Submit(?: Quiz)?$/i.test(this.name(button)),
        );
    await this.wait(
      () => location.pathname !== "/quiz" || confirmation(),
      stopped,
      "quiz submission",
      45000,
    );
    if (location.pathname === "/quiz") {
      const confirm = confirmation();
      if (!confirm)
        throw new Error(
          "Quiz submission requires an unsupported confirmation.",
        );
      this.click(confirm);
      await this.wait(
        () => location.pathname !== "/quiz",
        stopped,
        "quiz results",
        45000,
      );
    }
  },
};
