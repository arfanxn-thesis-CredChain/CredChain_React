#!/usr/bin/env node
/**
 * Verify that frontend i18n keys are in sync with the Go backend's locale files.
 * Run via: npm run check-locales
 *
 * Exits 0 on success, 1 on drift.
 */

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const FE_BASE = resolve(__dirname, "../src/shared/i18n");
const BE_BASE = resolve(__dirname, "../../CredChain_Golang/locales");

function loadJson(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (e) {
    console.error(`Failed to read ${path}: ${e.message}`);
    process.exit(1);
  }
}

function flatKeys(obj, prefix = "") {
  const keys = new Set();
  for (const [k, v] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) {
      for (const nested of flatKeys(v, path)) keys.add(nested);
    } else {
      keys.add(path);
    }
  }
  return keys;
}

function check(lang) {
  const fePath = `${FE_BASE}/${lang}.json`;
  const bePath = `${BE_BASE}/${lang}.json`;

  const fe = flatKeys(loadJson(fePath));
  const be = flatKeys(loadJson(bePath));

  // Worker-only mail copy is translated by Go and never rendered in React.
  const missingInFe = [...be].filter((k) => !k.startsWith("mail_") && !fe.has(k));
  const extraInFe = [...fe].filter((k) => !be.has(k));

  let problems = 0;
  if (missingInFe.length) {
    console.error(`[${lang}] missing in frontend (${missingInFe.length}):`);
    missingInFe.forEach((k) => console.error(`  - ${k}`));
    problems += missingInFe.length;
  }
  if (extraInFe.length) {
    console.warn(`[${lang}] extra in frontend (${extraInFe.length}):`);
    extraInFe.forEach((k) => console.warn(`  - ${k}`));
    // extras are warnings only - they may be FE-specific (e.g. UI strings)
  }
  return problems;
}

const totalProblems = check("en") + check("id");

if (totalProblems > 0) {
  console.error(`\nLocale drift detected: ${totalProblems} backend key(s) missing from frontend.`);
  process.exit(1);
}

console.log("Locale files in sync with backend.");
