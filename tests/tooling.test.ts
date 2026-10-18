import assert from "node:assert/strict";
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  rmSync,
  readFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { createRequire } from "node:module";
import { test } from "node:test";
import { ESLint } from "eslint";
import postcss from "postcss";
import tailwind from "@tailwindcss/postcss";
import tokens from "../brand/brand-tokens.json";
const require = createRequire(import.meta.url);
const pluginPath = require.resolve("@next/eslint-plugin-next");
const { getRootDirs } = require(
  join(dirname(pluginPath), "utils/get-root-dirs.js"),
);

test("Next lint resolver uses the scoped adapter and preserves directory discovery", () => {
  const pluginRequire = createRequire(pluginPath);
  assert.equal(
    pluginRequire("fast-glob"),
    require("../tools/next-lint-glob/index.cjs"),
  );
  const root = mkdtempSync(join(tmpdir(), "quizone-lint-"));
  try {
    for (const name of ["alpha", "beta"]) mkdirSync(join(root, name));
    writeFileSync(join(root, "note.txt"), "not a directory");
    const toSlash = (value: string) => value.replaceAll("\\", "/");
    const context = (rootDir: unknown) => ({
      cwd: root,
      settings: { next: { rootDir } },
    });
    assert.deepEqual(getRootDirs({ cwd: root, settings: {} }), [root]);
    assert.deepEqual(getRootDirs(context(root)), [toSlash(root)]);
    assert.deepEqual(getRootDirs(context(root + "/*")).sort(), [
      toSlash(join(root, "alpha")),
      toSlash(join(root, "beta")),
    ]);
    assert.deepEqual(getRootDirs(context(root + "/{alpha,beta}")).sort(), [
      toSlash(join(root, "alpha")),
      toSlash(join(root, "beta")),
    ]);
    assert.deepEqual(
      getRootDirs(context([join(root, "alpha"), join(root, "beta")])).sort(),
      [toSlash(join(root, "alpha")), toSlash(join(root, "beta"))],
    );
    assert.deepEqual(
      getRootDirs(context(join(root, "alpha").replaceAll("/", "\\"))),
      [toSlash(join(root, "alpha"))],
    );
    assert.deepEqual(getRootDirs(context(join(root, "missing"))), []);
    assert.deepEqual(getRootDirs(context(join(root, "note.txt"))), []);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("Next, React hook, and accessibility lint rules still reject invalid components", async () => {
  const lint = new ESLint({ cwd: process.cwd() });
  const results = await lint.lintText(
    `'use client';\nimport {useState} from 'react';\nexport default function Example({active}:{active:boolean}) {if(active){useState(0);} return <img src="/image.png"/>;}`,
    { filePath: "app/tooling-check.tsx" },
  );
  const rules = results.flatMap((r) => r.messages.map((m) => m.ruleId));
  assert.ok(rules.includes("@next/next/no-img-element"));
  assert.ok(rules.includes("react-hooks/rules-of-hooks"));
  assert.ok(rules.includes("jsx-a11y/alt-text"));
});

test("Tailwind 4 compiles existing brand tokens and retains app accessibility styles", async () => {
  const original = readFileSync("app/globals.css", "utf8");
  const css =
    original.replace(
      '@import "tailwindcss";',
      '@import "tailwindcss" source(none);',
    ) +
    '\n@source inline("bg-brand-blue text-brand-violet rounded-xl2 font-display shadow-card");';
  const result = await postcss([tailwind()]).process(css, {
    from: resolve("app/globals.css"),
  });
  const rules = new Map<string, postcss.Rule>();
  const variables = new Map<string, string>();
  result.root.walkDecls((decl) => {
    if (decl.prop.startsWith("--")) variables.set(decl.prop, decl.value);
  });
  result.root.walkRules((rule) => {
    rules.set(rule.selector, rule);
  });
  function values(selector: string, property: string) {
    return (
      rules
        .get(selector)
        ?.nodes.filter((n) => n.type === "decl" && n.prop === property)
        .map((n) =>
          n.type === "decl"
            ? n.value.replace(
                /var\((--[a-z0-9-]+)\)/gi,
                (match, name) => variables.get(name) || match,
              )
            : "",
        ) || []
    );
  }
  assert.deepEqual(values(".bg-brand-blue", "background-color"), [
    tokens.brand.primary,
  ]);
  assert.deepEqual(values(".text-brand-violet", "color"), [
    tokens.brand.violet,
  ]);
  assert.deepEqual(values(".rounded-xl2", "border-radius"), [tokens.radius.xl]);
  assert.ok(
    values(".font-display", "font-family").some((value) =>
      value.includes("Poppins"),
    ),
  );
  assert.ok(rules.has(".shadow-card"));
  assert.ok(rules.has(".sr-only"));
  assert.ok(rules.has(".modal-dialog::backdrop"));
  assert.ok(result.css.includes("prefers-reduced-motion"));
});
