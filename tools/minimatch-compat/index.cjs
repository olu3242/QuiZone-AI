"use strict";
// ESLint 9, eslint-plugin-import/react/jsx-a11y and @eslint/config-array call
// minimatch as a function (v3 shape) or destructure { Minimatch } (v5+ shape).
// minimatch@11 exposes only named exports, so wrap it in a callable facade that
// satisfies both shapes. Development tooling only; never imported by app code.
const patched = require("minimatch-patched");
function minimatch(path, pattern, options) {
  return patched.minimatch(path, pattern, options);
}
Object.assign(minimatch, patched);
minimatch.minimatch = minimatch;
minimatch.default = minimatch;
module.exports = minimatch;
