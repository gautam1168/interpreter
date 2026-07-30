#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

// ---------------------------------------------------------------------------
// ANSI helpers (mirrors tool/lib/src/term.dart)
// ---------------------------------------------------------------------------
const allowAnsi = process.stdout.isTTY && process.platform !== 'win32';
const ansi = (s, fb = '') => (allowAnsi ? s : fb);
const C = {
  cyan: ansi('\x1b[36m'),
  gray: ansi('\x1b[1;30m'),
  green: ansi('\x1b[32m'),
  magenta: ansi('\x1b[35m'),
  pink: ansi('\x1b[91m'),
  red: ansi('\x1b[31m'),
  yellow: ansi('\x1b[33m'),
  none: ansi('\x1b[0m'),
  resetColor: ansi('\x1b[39m'),
};
const color = (c, msg) => `${c}${msg}${C.none}`;
const green = m => color(C.green, m);
const red = m => color(C.red, m);
const yellow = m => color(C.yellow, m);
const gray = m => color(C.gray, m);
const pink = m => color(C.pink, m);
const magenta = m => color(C.magenta, m);

function clearLine() {
  if (allowAnsi) process.stdout.write('\x1b[2K\r');
  else process.stdout.write('\n');
}
function writeLine(line) {
  clearLine();
  if (line != null) process.stdout.write(line);
}

// ---------------------------------------------------------------------------
// Patterns (mirrors tool/bin/test.dart:12-18)
// ---------------------------------------------------------------------------
const expectedOutputPattern = /\/\/ expect: ?(.*)/;
const expectedErrorPattern = /\/\/ (Error.*)/;
const errorLinePattern = /\/\/ \[((java|c) )?line (\d+)\] (Error.*)/;
const expectedRuntimeErrorPattern = /\/\/ expect runtime error: (.+)/;
const syntaxErrorPattern = /\[.*line (\d+)\] (Error.+)/;
const stackTracePattern = /\[line (\d+)\]/;
const nonTestPattern = /\/\/ nontest/;

// ---------------------------------------------------------------------------
// Glob: collect test/**/*.lox
// ---------------------------------------------------------------------------
function* walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else yield full;
}
function globLox(testRoot) {
  const out = [];
  for (const f of walk(testRoot)) if (f.endsWith('.lox')) out.push(f);
  // Sort for determinism (Dart's Glob.listSync returns a consistent order).
  out.sort();
  return out;
}

// ---------------------------------------------------------------------------
// Suite definitions — mirrors _defineTestSuites() in test.dart.
//
// Each suite is: { language, executable, args, tests } where `tests` is a Map
// of path-prefix -> "pass" | "skip". Looked up by longest matching prefix.
// ---------------------------------------------------------------------------
function defineSuite(language, executable, args, tests) {
  return { language, executable, args, tests };
}

// Shared skip blocks copied verbatim from test.dart.
const earlyChapters = {
  'test/scanning': 'skip',
  'test/expressions': 'skip',
};
const javaNaNEquality = {
  'test/number/nan_equality.lox': 'skip',
};
const noJavaLimits = {
  'test/limit/loop_too_large.lox': 'skip',
  'test/limit/no_reuse_constants.lox': 'skip',
  'test/limit/too_many_constants.lox': 'skip',
  'test/limit/too_many_locals.lox': 'skip',
  'test/limit/too_many_upvalues.lox': 'skip',
  'test/limit/stack_overflow.lox': 'skip',
};
const noJavaClasses = {
  'test/assignment/to_this.lox': 'skip',
  'test/call/object.lox': 'skip',
  'test/class': 'skip',
  'test/closure/close_over_method_parameter.lox': 'skip',
  'test/constructor': 'skip',
  'test/field': 'skip',
  'test/inheritance': 'skip',
  'test/method': 'skip',
  'test/number/decimal_point_at_eof.lox': 'skip',
  'test/number/trailing_dot.lox': 'skip',
  'test/operator/equals_class.lox': 'skip',
  'test/operator/equals_method.lox': 'skip',
  'test/operator/not_class.lox': 'skip',
  'test/regression/394.lox': 'skip',
  'test/super': 'skip',
  'test/this': 'skip',
  'test/return/in_method.lox': 'skip',
  'test/variable/local_from_method.lox': 'skip',
};
const noJavaFunctions = {
  'test/call': 'skip',
  'test/closure': 'skip',
  'test/for/closure_in_body.lox': 'skip',
  'test/for/return_closure.lox': 'skip',
  'test/for/return_inside.lox': 'skip',
  'test/for/syntax.lox': 'skip',
  'test/function': 'skip',
  'test/operator/not.lox': 'skip',
  'test/regression/40.lox': 'skip',
  'test/return': 'skip',
  'test/unexpected_character.lox': 'skip',
  'test/while/closure_in_body.lox': 'skip',
  'test/while/return_closure.lox': 'skip',
  'test/while/return_inside.lox': 'skip',
};
const noJavaResolution = {
  'test/closure/assign_to_shadowed_later.lox': 'skip',
  'test/function/local_mutual_recursion.lox': 'skip',
  'test/variable/collide_with_parameter.lox': 'skip',
  'test/variable/duplicate_local.lox': 'skip',
  'test/variable/duplicate_parameter.lox': 'skip',
  'test/variable/early_bound.lox': 'skip',
  // Broken because we haven't fixed it yet by detecting the error.
  'test/return/at_top_level.lox': 'skip',
  'test/variable/use_local_in_initializer.lox': 'skip',
};
const noCControlFlow = {
  'test/block/empty.lox': 'skip',
  'test/for': 'skip',
  'test/if': 'skip',
  'test/limit/loop_too_large.lox': 'skip',
  'test/logical_operator': 'skip',
  'test/variable/unreached_undefined.lox': 'skip',
  'test/while': 'skip',
};
const noCFunctions = {
  'test/call': 'skip',
  'test/closure': 'skip',
  'test/for/closure_in_body.lox': 'skip',
  'test/for/return_closure.lox': 'skip',
  'test/for/return_inside.lox': 'skip',
  'test/for/syntax.lox': 'skip',
  'test/function': 'skip',
  'test/limit/no_reuse_constants.lox': 'skip',
  'test/limit/stack_overflow.lox': 'skip',
  'test/limit/too_many_constants.lox': 'skip',
  'test/limit/too_many_locals.lox': 'skip',
  'test/limit/too_many_upvalues.lox': 'skip',
  'test/regression/40.lox': 'skip',
  'test/return': 'skip',
  'test/unexpected_character.lox': 'skip',
  'test/variable/collide_with_parameter.lox': 'skip',
  'test/variable/duplicate_parameter.lox': 'skip',
  'test/variable/early_bound.lox': 'skip',
  'test/while/closure_in_body.lox': 'skip',
  'test/while/return_closure.lox': 'skip',
  'test/while/return_inside.lox': 'skip',
};
const noCClasses = {
  'test/assignment/to_this.lox': 'skip',
  'test/call/object.lox': 'skip',
  'test/class': 'skip',
  'test/closure/close_over_method_parameter.lox': 'skip',
  'test/constructor': 'skip',
  'test/field': 'skip',
  'test/inheritance': 'skip',
  'test/method': 'skip',
  'test/number/decimal_point_at_eof.lox': 'skip',
  'test/number/trailing_dot.lox': 'skip',
  'test/operator/equals_class.lox': 'skip',
  'test/operator/equals_method.lox': 'skip',
  'test/operator/not.lox': 'skip',
  'test/operator/not_class.lox': 'skip',
  'test/regression/394.lox': 'skip',
  'test/return/in_method.lox': 'skip',
  'test/super': 'skip',
  'test/this': 'skip',
  'test/variable/local_from_method.lox': 'skip',
};
const noCInheritance = {
  'test/class/local_inherit_other.lox': 'skip',
  'test/class/local_inherit_self.lox': 'skip',
  'test/class/inherit_self.lox': 'skip',
  'test/class/inherited_method.lox': 'skip',
  'test/inheritance': 'skip',
  'test/regression/394.lox': 'skip',
  'test/super': 'skip',
};

const Suites = {};

function defineSuites() {
  // JLox - the finished interpreter.
  suites.jlox = defineSuite(
    'java',
    'java',
    ['-cp', 'build/java', 'com.craftinginterpreters.lox.Lox'],
    {
      'test': 'pass',
      ...earlyChapters,
      ...javaNaNEquality,
      ...noJavaLimits,
    }
  );

  // CLox - the finished interpreter.
  suites.clox = defineSuite('c', 'build/cloxd', [], {
    'test': 'pass',
    ...earlyChapters,
  });

  // Per-chapter C builds. Chapter 14 has no test suite.
  suites['chap17_compiling'] = defineSuite('c', 'build/chap17_compiling', [], {
    'test': 'skip',
    'test/expressions/evaluate.lox': 'pass',
  });
  suites['chap18_types'] = defineSuite('c', 'build/chap18_types', [], {
    'test': 'skip',
    'test/expressions/evaluate.lox': 'pass',
  });
  suites['chap19_strings'] = defineSuite('c', 'build/chap19_strings', [], {
    'test': 'skip',
    'test/expressions/evaluate.lox': 'pass',
  });
  suites['chap20_hash'] = defineSuite('c', 'build/chap20_hash', [], {
    'test': 'skip',
    'test/expressions/evaluate.lox': 'pass',
  });
  suites['chap21_global'] = defineSuite('c', 'build/chap21_global', [], {
    'test': 'pass',
    ...earlyChapters,
    ...noCControlFlow,
    ...noCFunctions,
    ...noCClasses,
    'test/assignment/local.lox': 'skip',
    'test/variable/in_middle_of_block.lox': 'skip',
    'test/variable/in_nested_block.lox': 'skip',
    'test/variable/scope_reuse_in_different_blocks.lox': 'skip',
    'test/variable/shadow_and_local.lox': 'skip',
    'test/variable/undefined_local.lox': 'skip',
    'test/block/scope.lox': 'skip',
    'test/variable/duplicate_local.lox': 'skip',
    'test/variable/shadow_global.lox': 'skip',
    'test/variable/shadow_local.lox': 'skip',
    'test/variable/use_local_in_initializer.lox': 'skip',
  });
  suites['chap22_local'] = defineSuite('c', 'build/chap22_local', [], {
    'test': 'pass',
    ...earlyChapters,
    ...noCControlFlow,
    ...noCFunctions,
    ...noCClasses,
  });
  suites['chap23_jumping'] = defineSuite('c', 'build/chap23_jumping', [], {
    'test': 'pass',
    ...earlyChapters,
    ...noCFunctions,
    ...noCClasses,
  });
  suites['chap24_calls'] = defineSuite('c', 'build/chap24_calls', [], {
    'test': 'pass',
    ...earlyChapters,
    ...noCClasses,
    'test/closure': 'skip',
    'test/for/closure_in_body.lox': 'skip',
    'test/for/return_closure.lox': 'skip',
    'test/function/local_recursion.lox': 'skip',
    'test/limit/too_many_upvalues.lox': 'skip',
    'test/regression/40.lox': 'skip',
    'test/while/closure_in_body.lox': 'skip',
    'test/while/return_closure.lox': 'skip',
  });
  suites['chap25_closures'] = defineSuite('c', 'build/chap25_closures', [], {
    'test': 'pass',
    ...earlyChapters,
    ...noCClasses,
  });
  suites['chap26_garbage'] = defineSuite('c', 'build/chap26_garbage', [], {
    'test': 'pass',
    ...earlyChapters,
    ...noCClasses,
  });
  suites['chap27_classes'] = defineSuite('c', 'build/chap27_classes', [], {
    'test': 'pass',
    ...earlyChapters,
    ...noCInheritance,
    'test/assignment/to_this.lox': 'skip',
    'test/class/local_reference_self.lox': 'skip',
    'test/class/reference_self.lox': 'skip',
    'test/closure/close_over_method_parameter.lox': 'skip',
    'test/constructor': 'skip',
    'test/field/get_and_set_method.lox': 'skip',
    'test/field/method.lox': 'skip',
    'test/field/method_binds_this.lox': 'skip',
    'test/method': 'skip',
    'test/operator/equals_class.lox': 'skip',
    'test/operator/equals_method.lox': 'skip',
    'test/return/in_method.lox': 'skip',
    'test/this': 'skip',
    'test/variable/local_from_method.lox': 'skip',
  });
  suites['chap28_methods'] = defineSuite('c', 'build/chap28_methods', [], {
    'test': 'pass',
    ...earlyChapters,
    ...noCInheritance,
  });
  suites['chap29_superclasses'] = defineSuite('c', 'build/chap29_superclasses', [], {
    'test': 'pass',
    ...earlyChapters,
  });
  suites['chap30_optimization'] = defineSuite('c', 'build/chap30_optimization', [], {
    'test': 'pass',
    ...earlyChapters,
  });

  // Convenience groups.
  suites.c = { group: Object.keys(suites).filter(n =>
    n === 'clox' ||
    /^chap\d+_/.test(n) && n !== 'chap14_chunks' && n !== 'chap15_virtual' && n !== 'chap16_scanning'
  ) };
  suites.all = { group: ['clox', 'jlox'] };
}

const suites = {};

// ---------------------------------------------------------------------------
// Test class — mirrors Test in test.dart:185-429
// ---------------------------------------------------------------------------
class Test {
  constructor(filePath, suite) {
    this.path = filePath;
    this.suite = suite;
    this.expectedOutput = [];      // { line, output }
    this.expectedErrors = new Set();
    this.expectedRuntimeError = null;
    this.runtimeErrorLine = 0;
    this.expectedExitCode = 0;
    this.failures = [];
  }

  // Determine the pass/skip state by walking each path prefix from root down.
  // More specific (longer) prefixes override more general ones.
  resolveState() {
    const parts = this.path.split('/');
    let subpath = '';
    let state;
    for (const part of parts) {
      subpath = subpath ? `${subpath}/${part}` : part;
      if (this.suite.tests.has(subpath)) {
        state = this.suite.tests.get(subpath);
      }
    }
    return state;
  }

  parse() {
    const state = this.resolveState();
    if (state == null) {
      throw `Unknown test state for '${this.path}'.`;
    }
    if (state === 'skip') return false;

    const lines = fs.readFileSync(this.path, 'utf8').split(/\r?\n/);
    for (let lineNum = 1; lineNum <= lines.length; lineNum++) {
      const line = lines[lineNum - 1];
      let m;

      if (nonTestPattern.test(line)) return false;

      m = line.match(expectedOutputPattern);
      if (m) {
        this.expectedOutput.push({ line: lineNum, output: m[1] });
        expectations++;
        continue;
      }

      m = line.match(expectedErrorPattern);
      if (m) {
        this.expectedErrors.add(`[${lineNum}] ${m[1]}`);
        this.expectedExitCode = 65;
        expectations++;
        continue;
      }

      m = line.match(errorLinePattern);
      if (m) {
        const language = m[2];
        if (language == null || language === this.suite.language) {
          this.expectedErrors.add(`[${m[3]}] ${m[4]}`);
          this.expectedExitCode = 65;
          expectations++;
        }
        continue;
      }

      m = line.match(expectedRuntimeErrorPattern);
      if (m) {
        this.runtimeErrorLine = lineNum;
        this.expectedRuntimeError = m[1];
        this.expectedExitCode = 70;
        expectations++;
      }
    }

    if (this.expectedErrors.size > 0 && this.expectedRuntimeError != null) {
      writeLine(`${magenta('TEST ERROR')} ${this.path}`);
      process.stdout.write('     Cannot expect both compile and runtime errors.\n\n');
      return false;
    }

    return true;
  }

  run() {
    const args = [...this.suite.args, this.path];
    let stdout = '', stderr = '';
    let exitCode = 0;
    try {
      const buf = execFileSync(this.suite.executable, args, {
        encoding: 'utf8',
        maxBuffer: 50 * 1024 * 1024,
      });
      stdout = buf;
    } catch (err) {
      // Node throws on non-zero exit. Recover stdout/stderr/exit if available.
      stdout = err.stdout ? err.stdout.toString('utf8') : '';
      stderr = err.stderr ? err.stderr.toString('utf8') : '';
      exitCode = err.status == null ? 1 : err.status;
    }

    const outputLines = stdout ? stdout.split(/\r?\n/) : [];
    if (outputLines.length && outputLines[outputLines.length - 1] === '') {
      // The trailing newline produces a final empty element; keep it for parity
      // with Dart's LineSplitter, then strip later in validateOutput.
    }
    const errorLines = stderr ? stderr.split(/\r?\n/) : [];

    if (this.expectedRuntimeError != null) {
      this.validateRuntimeError(errorLines);
    } else {
      this.validateCompileErrors(errorLines);
    }

    this.validateExitCode(exitCode, errorLines);
    this.validateOutput(outputLines);
    return this.failures;
  }

  fail(msg, lines) {
    this.failures.push(msg);
    if (lines) for (const l of lines) this.failures.push(l);
  }

  validateRuntimeError(errorLines) {
    if (errorLines.length < 2) {
      this.fail(`Expected runtime error '${this.expectedRuntimeError}' and got none.`);
      return;
    }
    if (errorLines[0] !== this.expectedRuntimeError) {
      this.fail(`Expected runtime error '${this.expectedRuntimeError}' and got:`);
      this.fail(errorLines[0]);
    }
    let match = null;
    for (const line of errorLines.slice(1)) {
      match = line.match(stackTracePattern);
      if (match) break;
    }
    if (!match) {
      this.fail('Expected stack trace and got:', errorLines.slice(1));
    } else {
      const stackLine = parseInt(match[1], 10);
      if (stackLine !== this.runtimeErrorLine) {
        this.fail(`Expected runtime error on line ${this.runtimeErrorLine} but was on line ${stackLine}.`);
      }
    }
  }

  validateCompileErrors(errorLines) {
    const foundErrors = new Set();
    let unexpected = 0;
    for (const line of errorLines) {
      const m = line.match(syntaxErrorPattern);
      if (m) {
        const err = `[${m[1]}] ${m[2]}`;
        if (this.expectedErrors.has(err)) {
          foundErrors.add(err);
        } else {
          if (unexpected < 10) {
            this.fail('Unexpected error:');
            this.fail(line);
          }
          unexpected++;
        }
      } else if (line !== '') {
        if (unexpected < 10) {
          this.fail('Unexpected output on stderr:');
          this.fail(line);
        }
        unexpected++;
      }
    }
    if (unexpected > 10) {
      this.fail(`(truncated ${unexpected - 10} more...)`);
    }
    for (const err of this.expectedErrors) {
      if (!foundErrors.has(err)) {
        this.fail(`Missing expected error: ${err}`);
      }
    }
  }

  validateExitCode(exitCode, errorLines) {
    if (exitCode === this.expectedExitCode) return;
    let lines = errorLines;
    if (lines.length > 10) {
      lines = lines.slice(0, 10);
      lines.push('(truncated...)');
    }
    this.fail(`Expected return code ${this.expectedExitCode} and got ${exitCode}. Stderr:`, lines);
  }

  validateOutput(outputLines) {
    // Remove the trailing last empty line (mirrors Dart behaviour).
    if (outputLines.length && outputLines[outputLines.length - 1] === '') {
      outputLines.pop();
    }
    let i = 0;
    for (; i < outputLines.length; i++) {
      const line = outputLines[i];
      if (i >= this.expectedOutput.length) {
        this.fail(`Got output '${line}' when none was expected.`);
        continue;
      }
      const exp = this.expectedOutput[i];
      if (exp.output !== line) {
        this.fail(`Expected output '${exp.output}' on line ${exp.line} and got '${line}'.`);
      }
    }
    while (i < this.expectedOutput.length) {
      const exp = this.expectedOutput[i];
      this.fail(`Missing expected output '${exp.output}' on line ${exp.line}.`);
      i++;
    }
  }
}

// ---------------------------------------------------------------------------
// Runner: mirrors _runSuite / _runTest in test.dart:112-176
// ---------------------------------------------------------------------------
let passed = 0, failed = 0, skipped = 0, expectations = 0;
let currentSuite;
let filterPath = null;
let customInterpreter = null;
let customArguments = null;

function runSuite(name) {
  if (suites[name].group) {
    let anyFailed = false;
    for (const sub of suites[name].group) {
      console.log(`=== ${sub} ===`);
      if (!runSuite(sub)) anyFailed = true;
    }
    return !anyFailed;
  }

  currentSuite = suites[name];
  passed = 0; failed = 0; skipped = 0; expectations = 0;

  const testRoot = 'test';
  const files = globLox(testRoot);
  for (const file of files) runTest(file);

  clearLine();
  if (failed === 0) {
    console.log(`All ${green(passed)} tests passed (${expectations} expectations).`);
  } else {
    console.log(`${green(passed)} tests passed. ${red(failed)} tests failed.`);
  }
  return failed === 0;
}

function runTest(p) {
  if (p.includes('benchmark')) return;

  // Normalise to forward slashes (Node already uses them on macOS, but be safe).
  p = p.split(path.sep).join('/');
  // POSIX-normalise: collapse ./ etc. (best-effort.)
  p = p.replace(/^\.\//, '');

  if (filterPath != null) {
    const rel = path.posix.relative('test', p);
    if (!rel.startsWith(filterPath)) return;
  }

  const grayPath = gray(`(${p})`);
  writeLine(`Passed: ${green(passed)} Failed: ${red(failed)} Skipped: ${yellow(skipped)} ${grayPath}`);

  const test = new Test(p, currentSuite);
  if (!test.parse()) {
    if (test.failures.length === 0) {
      // parse() returned false because of skip — increment skipped.
      skipped++;
    }
    return;
  }

  // If parse() threw resolveState() above, an exception will propagate. The
  // original Dart runner throws on unknown test states too.
  const failures = test.run();
  if (failures.length === 0) {
    passed++;
  } else {
    failed++;
    writeLine(`${red('FAIL')} ${p}`);
    process.stdout.write('\n');
    for (const f of failures) process.stdout.write(`     ${pink(f)}\n`);
    process.stdout.write('\n');
  }
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------
function usageError(parser, msg) {
  console.log(msg);
  console.log('');
  console.log('Usage: test.js <suite> [filter] [--interpreter path] [--arguments args]');
  console.log('');
  process.exit(1);
}

function main(argv) {
  defineSuites();

  // Parse flags ourselves (Dart's ArgParser is richer than we need).
  let suite = null;
  let rest = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '-i' || a === '--interpreter') {
      customInterpreter = argv[++i];
    } else if (a === '-a' || a === '--arguments') {
      customArguments = (argv[++i] || '').split(/\s+/).filter(Boolean);
    } else {
      rest.push(a);
    }
  }
  if (rest.length === 0) usageError(null, 'Missing suite name.');
  if (rest.length > 2) usageError(null, `Unexpected arguments '${rest.slice(2).join(' ')}'.`);

  [suite, filterPath] = rest;
  // filterPath is relative to test/ — strip leading "test/" if present.
  if (filterPath && filterPath.startsWith('test/')) filterPath = filterPath.slice(5);

  if (customInterpreter != null) {
    // Override every suite's executable/args.
    for (const k of Object.keys(suites)) {
      if (suites[k].group) continue;
      suites[k].executable = customInterpreter;
      suites[k].args = customArguments || [];
    }
  }

  if (suite === 'all') {
    process.exit(runSuite('all') ? 0 : 1);
  } else if (suite === 'c') {
    process.exit(runSuite('c') ? 0 : 1);
  } else if (suite === 'java') {
    // Not really wired (no per-chapter java suites defined here yet), but keep
    // parity with the Dart runner's interface.
    process.exit(runSuite('jlox') ? 0 : 1);
  } else if (!suites[suite]) {
    console.log(`Unknown interpreter '${suite}'`);
    process.exit(1);
  } else {
    process.exit(runSuite(suite) ? 0 : 1);
  }
}

main(process.argv.slice(2));