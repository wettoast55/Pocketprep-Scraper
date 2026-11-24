# Exam Study Library 0.3.0

A local study extension for Microsoft Edge and Google Chrome, with immediate feedback, ordering questions and saved progress. A fresh installation starts empty. No question banks, sample exams, evidence images or test fixtures are bundled.

## Install or update

1. Export a library backup from your existing installation before updating.
2. Extract the ZIP to a permanent folder.
3. Open `edge://extensions` or `chrome://extensions` and enable **Developer mode**.
4. For a new installation, choose **Load unpacked** and select the folder containing `manifest.json`.
5. For an update, replace the files in your existing installed extension folder and click **Reload**. Keep that folder's location to retain its browser storage.
6. Refresh Pocket Prep and reopen the collector. Already injected tabs keep their old collector until refreshed.

Installation follows the [Edge instructions](https://learn.microsoft.com/en-us/microsoft-edge/extensions/getting-started/extension-sideloading) and [Chrome instructions](https://developer.chrome.com/docs/extensions/get-started/tutorial/hello-world).

The ZIP contains application source, documentation and a packaging script only. Removing the extension can remove its browser data. Collected exams are transferred with a library backup, not with the extension ZIP.

## Collect authorized questions

Open a question in your signed-in Pocket Prep account, then open the extension toolbar button.

The popup reads visible, unambiguous exam details. Missing name, bank total, version/code or source version date remain blank. A quiz counter such as “4 / 250” is not treated as the full bank total. A copyright year and the current date are not treated as an exam version date. Enter missing name and full bank total manually; version and source date are optional. Explicitly different versions use separate libraries.

Choose **Open collector on this page**, then:

- **Preview capture** inspects the detected content.
- **Save this question** captures one item.
- **Collect from here** saves and advances through the current set, including already-collected items without saving them twice.
- **Allow submitting answers** enables answer submission to reveal source feedback. This changes Pocket Prep scores and history.
- **Stop** ends collection without discarding earlier captures.

Multiple-choice and ordering formats are supported. Ordering lists support 2–100 items. The collector retries incomplete rendering and requires two matching snapshots before saving. Missing evidence, an unsupported layout, a repeated navigation loop or the end of the set pauses collection. It does not automatically create another quiz after a set ends.

If a layout still fails, the pause message identifies the missing evidence. Do not assume a partial bank contains the entire exam.

## Duplicate handling

Within each exam, repeated question text, choice text and image data identify duplicates even when choice letters or source identifiers differ. Different images or options remain distinct. Conflicting answer keys stop processing for review.

Existing duplicates are consolidated when opening the library or quiz, exporting/importing a bank, or resuming collection. The earliest question number is retained. Saved answers, flags and unfinished arrangements are mapped to that question; the most recent completed attempt is kept. Numbering can have gaps after consolidation. Different exams and versions remain separate.

## Move between browsers

Choose **Export library backup** in the source browser. Install the extension in the destination browser and use **Restore library backup**. Close quiz tabs before restoring. Matching exams and progress are replaced; other exams remain unchanged.

Backups include imported questions, explanations, embedded images, source identifiers, metadata and progress. They exclude passwords, cookies and sign-in sessions. Sign in normally in each browser for further collection. Collector page-setup selections stay browser-local.

Individual question-bank and progress export/import are also available. Importing a replacement bank clears that bank's current local progress, so use a full library backup when transferring everything.

## Source files

| File                           | Purpose                                                |
| ------------------------------ | ------------------------------------------------------ |
| `popup.js`, `page-metadata.js` | Toolbar setup and conservative page metadata detection |
| `collector.js`                 | Visible question extraction and optional submission    |
| `question-identity.js`         | Content matching and progress remapping                |
| `background.js`                | Sequential capture writes                              |
| `store.js`                     | Bank validation and local storage                      |
| `backup.js`                    | Portable library backups                               |
| `library.js`                   | Exam selection and file import/export                  |
| `quiz/boot.js`, `quiz/app.js`  | Quiz loading, interaction, grading and progress        |
| `scripts/package.py`           | Creates the source ZIP and checksum with Python 3      |

Source is formatted and commented. No compilation or runtime dependencies are needed. The collector operates on rendered page content and does not read credentials, cookies or hidden application data.

This is an independent practice tool, not an official answer key.
