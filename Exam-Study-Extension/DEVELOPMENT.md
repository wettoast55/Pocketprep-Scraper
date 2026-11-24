# Development

The extension folder is the source of truth. Edit its files directly and reload the extension in the browser. There is no bundler, transpiler or runtime package installation.

## Checks

With Node.js installed, run from this folder:

```sh
node scripts/test.cjs
```

The suites cover syntax, bank validation, original question/image coverage, ordering extraction and grading, multiple-choice submission, and portable backup/restore. Backup tests check source identifier preservation, unfinished arrangements, score recalculation, malformed input and rollback after a failed database write. DOM fixtures test collector logic; they do not replace a live Pocket Prep check after that site's layout changes.

## Formatting

Source uses two-space indentation and standard Prettier formatting. To reformat with Prettier installed in your own development environment:

```sh
prettier --write "**/*.{js,cjs,html,css,json,md}"
```

Do not minify release source. Keep comments focused on storage boundaries, grading rules, extraction assumptions and error handling.

## Packaging

With Python 3 installed:

```sh
python scripts/package.py
```

This writes `Exam-Study-Library-Edge-Chrome.zip` and its SHA-256 checksum next to the extension folder. The archive contains source, bundled question data, images, documentation and tests. Browser storage is deliberately separate and is transferred through **Export library backup**.

## Manual release checks

Load the same unpacked folder in Edge and Chrome. Confirm the original bank opens, switch exams, answer a multiple-choice and ordering question, reload and resume, then export and restore a library backup in the other browser. Confirm the collector can save a reviewed question and submit an unseen question when its history option is enabled.

The original CySA bank contains 625 questions and 11 performance labs. Collector support is limited to the layouts described in the README. Do not change source question identifiers when revising a bank; they are used to prevent duplicate captures.
