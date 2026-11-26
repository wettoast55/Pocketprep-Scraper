# Pocketprep-Scraper

Web extension to scrape PocketPrep questions and saves them offline in a similar exam-styled format. Collect Pocket Prep questions and practice them locally in Edge or Chrome. The extension opens in the browser sidebar: setup, preview, progress and collection share one interface. A fresh installation contains no exams or test data.

## Known issues / to-do

Original project checklist retained for review; items are not marked complete automatically.

- [ ] Improve detection of exam title, number, version and date; avoid retyping after closing the collector and remove the old CCNA / 650 defaults.
- [ ] Make collection controls movable or minimizable so they do not cover Submit at the end of a quiz.
- [ ] Improve “Open exam library” or show saved exams and question counts without opening a new page.
- [ ] Add exam removal and star / unstar controls.
- [ ] Clear the old CySA exam and show an import note when the library is empty.


## Download, install and update

1. Open the [newest release](https://github.com/wettoast55/Pocketprep-Scraper/releases/latest). Expand **Assets** and download the extension ZIP attached to that release. The local build may be newer than the published release until its maintainer uploads it.
2. Extract the ZIP into a permanent folder. If using GitHub's **Source code (zip)** instead, locate `Extension - Pocketprep Scraper` inside the extracted repository. Select whichever folder directly contains `manifest.json`.
3. In Edge, open `edge://extensions`. In Chrome, open `chrome://extensions`.
4. Turn on **Developer mode**. Edge may put this inside the Extensions menu on a narrow window; Chrome shows it at the top right.
5. Click **Load unpacked** and select the extracted extension folder. Pin **Exam Study Library** from your browser's Extensions menu if desired.
6. To update: export a library backup first, replace the files in the same installed folder, then click **Reload** on the extension card. Refresh Pocket Prep and reopen the extension. Keep the folder location unchanged to preserve its browser storage.

![Illustrated download and installation steps](docs/images/install.svg)

The diagram is an installation guide, not a screenshot. Official instructions: [Edge](https://learn.microsoft.com/en-us/microsoft-edge/extensions/getting-started/extension-sideloading) and [Chrome](https://developer.chrome.com/docs/extensions/get-started/tutorial/hello-world). The sidebar uses the browsers' [Side Panel support](https://learn.microsoft.com/en-us/microsoft-edge/extensions/developer-guide/sidebar).

## Two starting choices

| Button             | What it does                                                       |
| ------------------ | ------------------------------------------------------------------ |
| **My saved exams** | Opens the library for practice, bank imports, exports and backups. |
| **Start scraping** | Opens setup and collection controls in this same sidebar.          |

![Illustrated home and collection controls](docs/images/collection.svg)

## Collect questions

1. Sign in to Pocket Prep, select the intended exam and open **Study**, **Build Your Own**, an existing quiz, or its results screen.
2. Click the extension icon, then **Start scraping**.
3. Check **Exam name** and **Expected questions** (the full bank total, not the current quiz size). **Version** and **Date** are optional. Unavailable source metadata remains blank; the extension does not assume CCNA or 650 questions.
4. Enable **Allow submitting answers to unseen questions** when collecting new questions. This allows automatic answer submission to reveal feedback and changes Pocket Prep scores/history.
5. Click **Begin question collection**. That same button becomes **End / pause question collection** while running. While running, setup fields are replaced by the exam name, version/date when supplied, and live status. Pausing restores the fields and keeps every saved question.

The collector resumes unfinished quizzes, selects all subjects, chooses **New Questions**, unchecks **Answered**, **Flagged** and **Incorrect**, and uses the site's maximum available batch size. At the end it submits the quiz, closes results, opens **Build Your Own**, and repeats. It stops at the configured total, when no new questions remain, or on a capture/navigation error. Previously seen questions missing from the library are not included in a new-only batch; the status reports that gap.

**Preview capture** displays the current reviewed question and explanation without saving it. Pause before previewing. It does not submit an answer by itself. There are no separate Save question, Collect from here, Stop or Hide controls, and no floating page widget.

The sidebar remains open when focus changes. Typed settings survive closing/reopening it in the same browser session. Closing the sidebar does not stop collection; closing the source tab or browser does. The computer is kept awake while a live collection is running, and that request is released after pause/completion. This does not prevent browser tab throttling or make the window always on top. After a browser restart, reopen Pocket Prep and begin again; saved questions and practice progress remain available.

## Library and practice controls

- **Study / Resume** opens an exam and restores its saved progress.
- **Export question bank** downloads one exam for import elsewhere.
- **Import an exam** loads a question-bank JSON file; a fresh library starts empty.
- **Export library backup** saves all exams and their progress together.
- **Restore library backup** restores that backup in Edge or Chrome; close quiz tabs first.
- Inside a quiz, select an answer (or arrange ordering items), then check it for immediate feedback. Navigation, flagging and progress export/import remain available.

Multiple-choice and ordering questions are supported. Ordering lists support 2–100 items. The collector waits for stable question content before saving and pauses rather than skipping unsupported content.

## Duplicate handling

Within each exam, repeated question text, choice text and image data identify duplicates even when choice letters or source identifiers differ. Different images or options remain distinct. Conflicting answer keys stop processing for review.

Existing duplicates are consolidated when opening the library or quiz, exporting/importing a bank, or resuming collection. The earliest question number is retained. Saved answers, flags and unfinished arrangements are mapped to that question; the most recent completed attempt is kept. Numbering can have gaps after consolidation. Different exams and versions remain separate.

## Move between browsers

Choose **Export library backup** in the source browser. Install the extension in the destination browser and use **Restore library backup**. Close quiz tabs before restoring. Matching exams and progress are replaced; other exams remain unchanged.

Backups include imported questions, explanations, embedded images, source identifiers, metadata and progress. They exclude passwords, cookies and sign-in sessions. Sign in normally in each browser for further collection. Collector settings stay browser-local.

Individual question-bank and progress export/import are also available. Importing a replacement bank clears that bank's current local progress, so use a full library backup when transferring everything.

Source is formatted and commented. No compilation or runtime dependencies are needed. The collector operates on rendered page content and does not read credentials, cookies or hidden application data.

This is an independent practice tool, not an official answer key; we are not affiliated with any exam producing entity nor PocketPrep, check your sources and use at your own discretion.
