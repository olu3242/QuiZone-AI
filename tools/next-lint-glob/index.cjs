"use strict";
const path = require("node:path");
const fs = require("node:fs");
const { globSync: find, isDynamicPattern } = require("tinyglobby");
// The pinned Next plugin calls only globSync(string, { onlyDirectories: true }).
// Preserve fast-glob's static-directory, absolute-path and trailing-slash behavior.
function globSync(pattern, options = {}) {
  if (typeof pattern !== "string" || pattern.length === 0)
    throw new TypeError("Expected one directory pattern");
  if (options.onlyDirectories !== true)
    throw new TypeError(
      "This adapter supports Next.js directory discovery only",
    );
  if (!isDynamicPattern(pattern)) {
    try {
      return fs
        .statSync(path.resolve(options.cwd || process.cwd(), pattern))
        .isDirectory()
        ? [pattern.length > 1 ? pattern.replace(/\/$/, "") : pattern]
        : [];
    } catch (error) {
      if (error.code === "ENOENT" || error.code === "ENOTDIR") return [];
      throw error;
    }
  }
  return find(pattern, {
    ...options,
    expandDirectories: false,
    absolute: path.isAbsolute(pattern),
  }).map((entry) => (entry.length > 1 ? entry.replace(/\/$/, "") : entry));
}
module.exports = { globSync };
