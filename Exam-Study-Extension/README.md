# Exam Study Library

A local study extension for Microsoft Edge and Google Chrome. Includes the original CySA practice bank, multiple exam libraries, immediate feedback, ordering questions and saved sessions.

## Install in Edge or Chrome

1. Extract the ZIP to a permanent folder. Keep that folder after installation.
2. Open `edge://extensions` in Edge or `chrome://extensions` in Chrome.
3. Enable **Developer mode** and choose **Load unpacked**.
4. Select the extracted `Exam-Study-Extension` folder containing `manifest.json`.
5. Open the extension toolbar button and choose **Open exam library**.

The same folder works in both browsers. This is a source ZIP, not a store-signed installer; extract it before loading it. Installation follows the [Edge sideloading instructions](https://learn.microsoft.com/en-us/microsoft-edge/extensions/getting-started/extension-sideloading) and [Chrome unpacked-extension instructions](https://developer.chrome.com/docs/extensions/get-started/tutorial/hello-world).

## Move your exams and progress

In the original browser, open the library and choose **Export library backup**. Install the extension in the destination browser, open its library, then select the file under **Restore library backup**. Close open quiz tabs before restoring.

The backup includes imported banks, explanations, embedded images, source identifiers, answers, flags and unfinished drafts. The original CySA bank is already bundled; its progress is included in the backup. Restoring replaces matching banks and their progress, including original CySA progress. Other banks remain unchanged. Export a destination backup first if you want to retain its current state.

The extension ZIP contains application code and the original bank. It does **not** include your browser's collected Pocket Prep questions or progress. Transfer those with a library backup. Backups do not contain passwords, cookies or login sessions. Each browser needs its own normal Pocket Prep sign-in for further collection. Collection element selections are browser-local.

Individual bank export/import and per-exam **Download progress / Load progress** are also available. Importing a replacement bank clears that bank's local progress. Use the full library backup when moving everything together.

## Collect authorized questions

Open a question in your signed-in Pocket Prep account. Open the extension and enter the exam name and expected total. Choose **Open collector on this page**.

- **Preview capture** shows the detected question before saving.
- **Save this question** captures one question.
- **Collect from here** saves and advances through the current question set.
- **Allow submitting answers** lets the collector choose an answer and submit it to reveal feedback. This changes Pocket Prep scores and study history.
- **Stop** ends collection after the current operation.

The collector supports single-answer, multiple-answer and ordering questions. Unsupported layouts, unavailable images and missing feedback pause collection rather than silently skipping questions. A partial bank is not a complete exam. Collection does not automatically create new quizzes after the current set ends.

## Update an existing installation

Export a library backup first. Replace files in the existing extension folder, then click **Reload** on its extensions page. Refresh the Pocket Prep tab and reopen the collector. Keep the same installed folder to retain the existing extension storage; removing the extension can remove its local data.

## Source layout

| File            | Responsibility                                             |
| --------------- | ---------------------------------------------------------- |
| `manifest.json` | Shared Manifest V3 configuration for Edge and Chrome       |
| `popup.js`      | Toolbar actions and current-tab collection setup           |
| `collector.js`  | Visible question extraction and optional answer submission |
| `background.js` | Sequential capture writes and source deduplication         |
| `store.js`      | IndexedDB persistence and bank validation                  |
| `backup.js`     | Portable library backup validation and restoration         |
| `library.js`    | Exam selection and import/export interface                 |
| `quiz/boot.js`  | Loads the selected exam                                    |
| `quiz/app.js`   | Question rendering, grading and progress                   |
| `quiz/bank.js`  | Bundled CySA question data                                 |
| `quiz/assets/`  | Original evidence images                                   |

All runtime source is included, formatted and commented. No compilation or network dependencies are required to run the extension. See `DEVELOPMENT.md` for tests and packaging.

## Permissions

`storage` and `unlimitedStorage` support local study data. `activeTab` and `scripting` let a toolbar click start the collector on the current Pocket Prep tab. There are no permanent host permissions. The collector does not read credentials, cookies or hidden application data.

This is an independent practice tool. Source references and study notes are retained; the original CySA material is not an official answer key.
