import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const page = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");
const stylesheet = readFileSync(new URL("./login.module.css", import.meta.url), "utf8");

test("login page style references are defined by its CSS module", () => {
  const classNames = [...page.matchAll(/styles\.([A-Za-z0-9_]+)/g)].map((match) => match[1]);
  const missing = [...new Set(classNames)].filter(
    (className) => !new RegExp(`\\.${className}(?![A-Za-z0-9_-])`).test(stylesheet),
  );

  assert.deepEqual(missing, []);
});
