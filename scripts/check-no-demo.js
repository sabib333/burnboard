#!/usr/bin/env node

/**
 * BURNBOARD No-Demo Check (v2)
 *
 * Run before build to ensure no demo/mock/dummy data exists.
 * Exits with code 1 if any violations found.
 *
 * Usage: node scripts/check-no-demo.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

// Patterns that indicate demo/mock data
// These are specifically looking for hardcoded demo data, NOT HTML attributes
const FORBIDDEN_PATTERNS = [
  // Demo data indicators
  { regex: /\bdummy\b/i, desc: 'dummy data' },
  { regex: /\bmock\b(?!ing)/i, desc: 'mock data' },
  { regex: /\bfakeProfiles?\b/i, desc: 'fake profiles' },
  { regex: /\bfakeRoasts?\b/i, desc: 'fake roasts' },
  { regex: /\btestData\b/i, desc: 'test data' },
  { regex: /\bseedData\b/i, desc: 'seed data' },
  { regex: /\bdemo\s+(user|data|profile|roast)\b/i, desc: 'demo content' },

  // Hardcoded celebrity names (only when used as demo data, not in placeholder text)
  { regex: /['"]Elon['"]/i, desc: 'hardcoded Elon' },
  { regex: /name:\s*['"]Elon['"]/i, desc: 'hardcoded Elon name' },
  { regex: /username:\s*['"]elon/i, desc: 'hardcoded elon username' },
  { regex: /\btim cook\b/i, desc: 'hardcoded Tim Cook' },
  { regex: /\bmark zuckerberg\b/i, desc: 'hardcoded Mark Zuckerberg' },
  { regex: /\bsatya nadella\b/i, desc: 'hardcoded Satya Nadella' },

  // Hardcoded demo users
  { regex: /github\s+dev\s+profiles/i, desc: 'github dev profiles' },
  { regex: /initial\s+\d+\s+roastee/i, desc: 'initial roastee data' },
];

// Files/dirs to skip
const SKIP_DIRS = ['node_modules', 'dist', '.git', '.next'];
const SKIP_FILES = ['check-no-demo.js', 'seed.js', 'package-lock.json', 'bun.lock'];

// File extensions to check
const CHECK_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx'];

function checkFile(filePath) {
  const relativePath = path.relative(ROOT, filePath);
  const violations = [];

  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');

    lines.forEach((line, lineNum) => {
      const trimmed = line.trim();
      // Skip comments
      if (trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')) {
        return;
      }

      for (const { regex, desc } of FORBIDDEN_PATTERNS) {
        if (regex.test(line)) {
          // Skip in SQL migration files and this script
          if (relativePath.includes('migrations/') || relativePath.includes('check-no-demo')) {
            continue;
          }
          violations.push({
            file: relativePath,
            line: lineNum + 1,
            desc,
            content: line.trim().substring(0, 100),
          });
          break; // One violation per line is enough
        }
      }
    });
  } catch (err) {
    // Can't read file — skip
  }

  return violations;
}

function walkDir(dir) {
  let results = [];

  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        if (SKIP_DIRS.includes(entry.name)) continue;
        results = results.concat(walkDir(fullPath));
      } else if (entry.isFile()) {
        if (SKIP_FILES.includes(entry.name)) continue;
        const ext = path.extname(entry.name);
        if (CHECK_EXTENSIONS.includes(ext)) {
          results.push(fullPath);
        }
      }
    }
  } catch (err) {
    // Can't read directory — skip
  }

  return results;
}

// ── Main ─────────────────────────────────────────────────────
console.log('🔍 BURNBOARD No-Demo Check\n');
console.log(`Scanning: ${ROOT}\n`);

const files = walkDir(ROOT);
console.log(`Found ${files.length} files to scan\n`);

let totalViolations = 0;

for (const file of files) {
  const violations = checkFile(file);
  if (violations.length > 0) {
    totalViolations += violations.length;
    for (const v of violations) {
      console.log(`❌ ${v.file}:${v.line} [${v.desc}]`);
      console.log(`   ${v.content}\n`);
    }
  }
}

if (totalViolations > 0) {
  console.log(`\n🚫 FAILED: Found ${totalViolations} demo/mock data violations.`);
  console.log('Remove all demo data before building for production.\n');
  process.exit(1);
} else {
  console.log('✅ PASSED: No demo/mock/dummy data found.');
  console.log('Safe to build for production.\n');
  process.exit(0);
}
