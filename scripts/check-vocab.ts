#!/usr/bin/env node
// Banned-vocabulary CI gate. Fails if any banned alias appears in source files.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, extname } from "node:path";

const BANNED = [
  "phone_number", "phoneNumber",
  "full_name", "fullName",
  "email_address", "emailAddress",
  "estimated_value", "estimatedValue",
  "opp_status", "oppStatus",
  "job_number", "jobNumber",
  "assignee_id", "assigneeId",
];

const ROOTS = ["apps/web/src", "apps/worker/src", "packages"];
const SKIP = new Set(["node_modules", ".next", "dist", "shared-types"]);
const EXTS = new Set([".ts", ".tsx", ".sql"]);

let failures = 0;

function walk(dir: string) {
  let entries: string[];
  try { entries = readdirSync(dir); } catch { return; }
  for (const e of entries) {
    if (SKIP.has(e)) continue;
    const p = join(dir, e);
    const s = statSync(p);
    if (s.isDirectory()) walk(p);
    else if (EXTS.has(extname(p))) check(p);
  }
}

function check(file: string) {
  const text = readFileSync(file, "utf8");
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i++) {
    for (const bad of BANNED) {
      if (lines[i].includes(bad)) {
        console.error(`VOCAB: ${file}:${i + 1}  banned token "${bad}"`);
        failures++;
      }
    }
  }
}

for (const r of ROOTS) walk(r);

if (failures > 0) {
  console.error(`\n${failures} vocab violation(s).`);
  process.exit(1);
}
console.log("vocab check: clean");
