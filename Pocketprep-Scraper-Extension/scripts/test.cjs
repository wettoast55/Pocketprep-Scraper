// Run each regression suite in isolation so globals cannot leak between tests.
const { spawnSync } = require("node:child_process");
const path = require("node:path");
for (const suite of ["extension", "ordering", "mcq-submit", "backup"]) {
  const result = spawnSync(
    process.execPath,
    [path.join(__dirname, `test-${suite}.cjs`)],
    {
      cwd: path.resolve(__dirname, ".."),
      stdio: "inherit",
    },
  );
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}
