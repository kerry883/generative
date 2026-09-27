// Static helpers for the Manim code the model generates:
//   - prepareCode: deterministic fixes applied before every render
//       * voiceover sync: fit each narration block's animations to its audio length
//       * silent gaps between narration blocks are clamped
//       * LaTeX strings made raw so Python escapes (\f, \t, ...) can't corrupt them
//       * common non-ASCII punctuation replaced, emoji removed
//   - extractTranscript: the narration text, in order
//
// This is a small purpose-built scanner, not a Python parser. Anything it can't
// analyse safely (loops, conditionals, helper methods that animate) is left as
// written and reported as a warning. All fixes keep the line count unchanged, so
// error line numbers still point at the right scene.

import { execFile } from "node:child_process";

// ─── Python scanning ──────────────────────────────────

interface StringLit {
  start: number; // index of the prefix (or opening quote)
  end: number; // index just past the closing quote
  prefix: string;
  quote: string; // ' " ''' or """
  contentStart: number;
  contentEnd: number;
}

interface Scan {
  // 1 where the character is inside a string literal or comment
  mask: Uint8Array;
  strings: StringLit[];
}

function scanPython(src: string): Scan {
  const mask = new Uint8Array(src.length);
  const strings: StringLit[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (c === "#") {
      const nl = src.indexOf("\n", i);
      const end = nl === -1 ? src.length : nl;
      mask.fill(1, i, end);
      i = end;
      continue;
    }
    if (c === '"' || c === "'") {
      // string prefix: up to two letters directly before the quote, not part of an identifier
      let p = i;
      while (p > i - 2 && p > 0 && /[rRbBuUfF]/.test(src[p - 1])) p--;
      if (p > 0 && /[A-Za-z0-9_]/.test(src[p - 1])) p = i;
      const prefix = src.slice(p, i);
      const triple = src.startsWith(c.repeat(3), i);
      const quote = triple ? c.repeat(3) : c;
      let j = i + quote.length;
      while (j < src.length) {
        if (src[j] === "\\") {
          j += 2;
          continue;
        }
        if (src.startsWith(quote, j)) break;
        if (!triple && src[j] === "\n") break;
        j++;
      }
      const end = Math.min(j + quote.length, src.length);
      strings.push({ start: p, end, prefix, quote, contentStart: i + quote.length, contentEnd: Math.min(j, src.length) });
      mask.fill(1, p, end);
      i = end;
      continue;
    }
    i++;
  }
  return { mask, strings };
}

function matchParen(src: string, mask: Uint8Array, open: number): number {
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (mask[i]) continue;
    const c = src[i];
    if (c === "(" || c === "[" || c === "{") depth++;
    else if (c === ")" || c === "]" || c === "}") {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

interface Arg {
  start: number;
  end: number;
  text: string;
}

// Top-level arguments between an opening paren and its match.
function splitArgs(src: string, mask: Uint8Array, open: number, close: number): Arg[] {
  const args: Arg[] = [];
  let depth = 0;
  let start = open + 1;
  const push = (end: number) => {
    const text = src.slice(start, end);
    if (text.trim()) args.push({ start, end, text: text.trim() });
  };
  for (let i = open + 1; i < close; i++) {
    if (mask[i]) continue;
    const c = src[i];
    if (c === "(" || c === "[" || c === "{") depth++;
    else if (c === ")" || c === "]" || c === "}") depth--;
    else if (c === "," && depth === 0) {
      push(i);
      start = i + 1;
    }
  }
  push(close);
  return args;
}

// Regex matches that start in code (not inside strings or comments).
function codeMatches(src: string, mask: Uint8Array, re: RegExp, from = 0, to = src.length): RegExpExecArray[] {
  const out: RegExpExecArray[] = [];
  const g = new RegExp(re.source, re.flags.includes("g") ? re.flags : re.flags + "g");
  g.lastIndex = from;
  for (let m = g.exec(src); m && m.index < to; m = g.exec(src)) {
    if (!mask[m.index]) out.push(m);
    if (m[0].length === 0) g.lastIndex++;
  }
  return out;
}

const indentOf = (line: string) => line.match(/^[ \t]*/)![0].replace(/\t/g, "    ").length;

// ─── voiceover blocks ─────────────────────────────────

interface Block {
  headerStart: number;
  textArg?: Arg;
  tracker: string;
  bodyStart: number;
  bodyEnd: number;
}

function findBlocks(src: string, scan: Scan): Block[] {
  const blocks: Block[] = [];
  for (const m of codeMatches(src, scan.mask, /^([ \t]*)with\s+self\.voiceover\s*\(/m)) {
    const open = m.index + m[0].length - 1;
    const close = matchParen(src, scan.mask, open);
    if (close === -1) continue;
    const as = src.slice(close + 1).match(/^\s*as\s+([A-Za-z_]\w*)\s*:/);
    if (!as) continue;
    const args = splitArgs(src, scan.mask, open, close);
    const textArg = args.find((a) => /^text\s*=/.test(a.text)) ?? args.find((a) => !/^\w+\s*=/.test(a.text));

    const headerIndent = indentOf(m[1]);
    const lineEnd = src.indexOf("\n", close);
    const bodyStart = lineEnd === -1 ? src.length : lineEnd + 1;
    let pos = bodyStart;
    let bodyEnd = bodyStart;
    while (pos < src.length) {
      const nl = src.indexOf("\n", pos);
      const next = nl === -1 ? src.length : nl + 1;
      const line = src.slice(pos, nl === -1 ? src.length : nl);
      const blank = !line.trim() || line.trim().startsWith("#");
      if (!blank && !scan.mask[pos] && indentOf(line) <= headerIndent) break;
      if (!blank || scan.mask[pos]) bodyEnd = nl === -1 ? src.length : nl;
      pos = next;
    }
    blocks.push({ headerStart: m.index, textArg, tracker: as[1], bodyStart, bodyEnd });
  }
  return blocks;
}

// Names of methods (other than construct) that call self.play / self.wait.
function animatingHelpers(src: string, scan: Scan): Set<string> {
  const names = new Set<string>();
  const defs = codeMatches(src, scan.mask, /^([ \t]*)def\s+([A-Za-z_]\w*)\s*\(/m);
  defs.forEach((d, i) => {
    if (d[2] === "construct") return;
    const end = i + 1 < defs.length ? defs[i + 1].index : src.length;
    if (codeMatches(src, scan.mask, /self\.(play|wait)\s*\(/, d.index, end).length) names.add(d[2]);
  });
  return names;
}

type Timing =
  | { kind: "seconds"; value: number }
  | { kind: "fraction"; value: number }
  | { kind: "other"; expr: string };

function classifyTiming(expr: string, tracker: string): Timing {
  const e = expr.replace(/\s+/g, "");
  const t = tracker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  let m = e.match(/^(\d+(?:\.\d+)?|\.\d+)$/);
  if (m) return { kind: "seconds", value: Number(m[1]) };
  m = e.match(new RegExp(`^${t}\\.duration\\*(\\d*\\.?\\d+)$`)) ?? e.match(new RegExp(`^(\\d*\\.?\\d+)\\*${t}\\.duration$`));
  if (m) return { kind: "fraction", value: Number(m[1]) };
  m = e.match(new RegExp(`^${t}\\.duration/(\\d*\\.?\\d+)$`));
  if (m && Number(m[1]) > 0) return { kind: "fraction", value: 1 / Number(m[1]) };
  if (e === `${tracker}.duration`) return { kind: "fraction", value: 1 };
  return { kind: "other", expr };
}

interface TimedCall {
  kind: "play" | "wait";
  open: number;
  close: number;
  // span of the existing timing argument, if any
  timingArg?: Arg;
  timing: Timing;
}

function timedCalls(src: string, scan: Scan, from: number, to: number, tracker: string): TimedCall[] {
  const calls: TimedCall[] = [];
  for (const m of codeMatches(src, scan.mask, /self\.(play|wait)\s*\(/, from, to)) {
    const open = m.index + m[0].length - 1;
    const close = matchParen(src, scan.mask, open);
    if (close === -1 || close > to) continue;
    const args = splitArgs(src, scan.mask, open, close);
    const kind = m[1] as "play" | "wait";
    const timingArg =
      kind === "play"
        ? args.find((a) => /^run_time\s*=/.test(a.text))
        : (args.find((a) => /^duration\s*=/.test(a.text)) ?? args.find((a) => !/^\w+\s*=/.test(a.text)));
    const value = timingArg?.text.replace(/^\w+\s*=\s*/, "");
    const timing: Timing = value === undefined ? { kind: "seconds", value: 1 } : classifyTiming(value, tracker);
    calls.push({ kind, open, close, timingArg, timing });
  }
  return calls;
}

// ─── fixes ────────────────────────────────────────────

interface Edit {
  start: number;
  end: number;
  text: string;
}

function applyEdits(src: string, edits: Edit[]): string {
  let out = src;
  for (const e of [...edits].sort((a, b) => b.start - a.start)) out = out.slice(0, e.start) + e.text + out.slice(e.end);
  return out;
}

const round = (n: number) => Number(n.toFixed(3)).toString();

export const SYNC_HELPER = `
def _vt(tracker, weight, total, max_stretch=2.5, min_scale=0.4):
    # Added by the pipeline: scale a narration block's animations so they fill
    # exactly the length of its voiceover audio.
    scale = tracker.duration / total if total > 0 else 1.0
    scale = max(min(scale, max_stretch), min_scale)
    return max(weight * scale, 1.0 / 30)
`;

export interface SyncStats {
  blocks: number;
  alreadyFitted: number;
  fitted: number;
  skipped: number;
  withoutAnimation: number;
  gapClamps: number;
}

// Rewrites block timings so animations fill each voiceover exactly.
function fixSync(src: string, warnings: string[]): { code: string; stats: SyncStats } {
  const scan = scanPython(src);
  const blocks = findBlocks(src, scan);
  const helpers = animatingHelpers(src, scan);
  const stats: SyncStats = { blocks: blocks.length, alreadyFitted: 0, fitted: 0, skipped: 0, withoutAnimation: 0, gapClamps: 0 };
  const edits: Edit[] = [];

  blocks.forEach((b, idx) => {
    const label = `voiceover block ${idx + 1}`;
    const body = src.slice(b.bodyStart, b.bodyEnd);
    const control = codeMatches(src, scan.mask, /^[ \t]*(for|while|if|elif|else|try|with|def)\b/m, b.bodyStart, b.bodyEnd);
    const helperCall = [...helpers].find((h) => new RegExp(`self\\.${h}\\s*\\(`).test(body));
    const calls = timedCalls(src, scan, b.bodyStart, b.bodyEnd, b.tracker);

    if (calls.length === 0) {
      stats.withoutAnimation++;
      warnings.push(`${label}: narration with no animation (picture is static while it plays)`);
      return;
    }
    if (control.length || helperCall) {
      stats.skipped++;
      warnings.push(`${label}: left as written (${helperCall ? `calls helper ${helperCall}()` : `contains '${control[0][1]}'`})`);
      return;
    }
    const other = calls.find((c) => c.timing.kind === "other");
    if (other) {
      stats.skipped++;
      warnings.push(`${label}: left as written (timing '${(other.timing as { expr: string }).expr}')`);
      return;
    }

    const seconds = calls.reduce((s, c) => s + (c.timing.kind === "seconds" ? c.timing.value : 0), 0);
    const fraction = calls.reduce((s, c) => s + (c.timing.kind === "fraction" ? c.timing.value : 0), 0);
    if (seconds === 0 && fraction >= 0.85 && fraction <= 1.02) {
      stats.alreadyFitted++;
      return;
    }

    const t = b.tracker;
    const totalParts = [seconds ? round(seconds) : "", fraction ? `${round(fraction)} * ${t}.duration` : ""].filter(Boolean);
    const total = totalParts.join(" + ");
    for (const c of calls) {
      if (c.timing.kind === "other") continue; // excluded above
      const weight = c.timing.kind === "seconds" ? round(c.timing.value) : `${round(c.timing.value)} * ${t}.duration`;
      const value = `_vt(${t}, ${weight}, ${total})`;
      if (c.kind === "play") {
        if (c.timingArg) edits.push({ start: c.timingArg.start, end: c.timingArg.end, text: ` run_time=${value}` });
        else edits.push({ start: c.close, end: c.close, text: `, run_time=${value}` });
      } else if (c.timingArg) {
        const kw = /^duration\s*=/.test(c.timingArg.text) ? "duration=" : "";
        edits.push({ start: c.timingArg.start, end: c.timingArg.end, text: `${kw}${value}` });
      } else {
        edits.push({ start: c.open + 1, end: c.close, text: value });
      }
    }
    stats.fitted++;
  });

  // Animations between narration blocks play in silence: keep them short.
  const inBlock = (i: number) => blocks.some((b) => i >= b.headerStart && i <= b.bodyEnd);
  const construct = codeMatches(src, scan.mask, /def\s+construct\s*\(/)[0];
  if (construct && blocks.length) {
    for (const c of timedCalls(src, scan, construct.index, src.length, "__none__")) {
      if (inBlock(c.open) || c.timing.kind !== "seconds" || c.timing.value <= 1 || !c.timingArg) continue;
      const kw = c.timingArg.text.match(/^(\w+\s*=\s*)/)?.[1] ?? "";
      edits.push({ start: c.timingArg.start, end: c.timingArg.end, text: `${c.kind === "play" ? " " : ""}${kw}1` });
      stats.gapClamps++;
    }
  }

  let code = applyEdits(src, edits);
  if (stats.fitted && !code.includes("def _vt(")) {
    const anchor = code.match(/^from manim import \*.*$/m);
    const at = anchor ? anchor.index! + anchor[0].length + 1 : 0;
    code = code.slice(0, at) + SYNC_HELPER + "\n" + code.slice(at);
  }
  return { code, stats };
}

const LATEX_CMD =
  /\\(?:frac|dfrac|sqrt|pm|mp|int|iint|oint|sum|prod|lim|cdot|times|div|infty|left|right|text|mathrm|mathbf|vec|hat|bar|dot|ddot|partial|nabla|alpha|beta|gamma|delta|Delta|epsilon|varepsilon|theta|lambda|mu|pi|rho|sigma|Sigma|tau|phi|varphi|omega|Omega|sin|cos|tan|log|ln|exp|approx|neq|leq|geq|le|ge|to|rightarrow|Rightarrow|leftarrow|quad|qquad|cdots|ldots|circ|degree|binom|over|underbrace|overbrace|begin|end|displaystyle)(?![A-Za-z])/;

// Make LaTeX strings raw and undo double escaping inside raw strings.
function fixLatex(src: string, fixes: string[]): string {
  const scan = scanPython(src);
  const edits: Edit[] = [];
  let madeRaw = 0;
  let unescaped = 0;
  for (const s of scan.strings) {
    const content = src.slice(s.contentStart, s.contentEnd);
    const isRaw = /r/i.test(s.prefix);
    const isBytes = /b/i.test(s.prefix);
    if (isBytes) continue;
    if (!isRaw) {
      // Single-backslash LaTeX in a normal string: \f, \t, \b ... become control characters.
      const singles = content.replace(/\\\\/g, "");
      if (LATEX_CMD.test(singles) && !/\\\\[A-Za-z]/.test(content)) {
        edits.push({ start: s.start, end: s.start + s.prefix.length, text: "r" + s.prefix });
        madeRaw++;
      }
    } else if (/\\\\(?=[A-Za-z])/.test(content) && LATEX_CMD.test(content.replace(/\\\\(?=[A-Za-z])/g, "\\"))) {
      edits.push({ start: s.contentStart, end: s.contentEnd, text: content.replace(/\\\\(?=[A-Za-z])/g, "\\") });
      unescaped++;
    }
  }
  if (madeRaw) fixes.push(`made ${madeRaw} LaTeX string(s) raw`);
  if (unescaped) fixes.push(`removed double backslashes in ${unescaped} raw LaTeX string(s)`);
  return applyEdits(src, edits);
}

const ASCII_MAP: Record<string, string> = {
  "‘": "'", "’": "'", "“": '"', "”": '"', "–": "-", "—": "-",
  "…": "...", " ": " ", "→": "->", "←": "<-", "×": "x", "−": "-",
  "≤": "<=", "≥": ">=", "≠": "!=", "≈": "~", "°": " degrees",
};

function fixNonAscii(src: string, fixes: string[], warnings: string[]): string {
  let replaced = 0;
  let out = src.replace(/[‘’“”–—… →←×−≤≥≠≈°]/g, (ch) => {
    replaced++;
    return ASCII_MAP[ch];
  });
  // Emoji and pictographs: drop them.
  out = out.replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/gu, () => {
    replaced++;
    return "";
  });
  if (replaced) fixes.push(`replaced ${replaced} non-ASCII character(s)`);
  const left = out.match(/[^\x00-\x7F]/g);
  if (left) warnings.push(`non-ASCII characters remain: ${[...new Set(left)].join(" ")}`);
  return out;
}

export interface PreparedCode {
  code: string;
  fixes: string[];
  warnings: string[];
  // Problems that would make the render fail or be unusable; sent to repair before rendering.
  errors: string[];
  sync: SyncStats;
}

export function prepareCode(input: string, sceneName: string): PreparedCode {
  const fixes: string[] = [];
  const warnings: string[] = [];
  const errors: string[] = [];

  let code = input.replace(/\r\n/g, "\n");
  code = fixNonAscii(code, fixes, warnings);
  code = fixLatex(code, fixes);
  const synced = fixSync(code, warnings);
  code = synced.code;
  const s = synced.stats;
  if (s.fitted) fixes.push(`fitted ${s.fitted} voiceover block(s) to their narration`);
  if (s.gapClamps) fixes.push(`shortened ${s.gapClamps} silent animation(s) between narration blocks`);

  if (!new RegExp(`^class\\s+${sceneName}\\s*\\([^)]*VoiceoverScene`, "m").test(code)) {
    errors.push(`class ${sceneName} must exist and inherit from VoiceoverScene (and MovingCameraScene)`);
  }
  if (!code.includes("set_speech_service(")) errors.push("self.set_speech_service(CustomGoogleService(...)) is missing");
  if (s.blocks === 0) errors.push("there are no `with self.voiceover(...)` blocks, so the video would have no narration");

  return { code, fixes, warnings, errors, sync: s };
}

// ─── syntax check ─────────────────────────────────────

const PYTHON = process.env.PYTHON_PATH ?? (process.platform === "win32" ? "python" : "python3");

const SYNTAX_CHECK = `import ast, sys
try:
    ast.parse(sys.stdin.read())
except SyntaxError as e:
    print(e.lineno or 0)
    print(e.msg)
    sys.exit(1)
`;

// Parses the code with the local Python, if there is one. Returns null when no
// Python is available, so callers simply skip the check.
export function checkSyntax(code: string): Promise<{ ok: true } | { ok: false; line?: number; message: string } | null> {
  return new Promise((resolve) => {
    const child = execFile(PYTHON, ["-c", SYNTAX_CHECK], { timeout: 30_000 }, (err, stdout) => {
      if (!err) return resolve({ ok: true });
      if ((err as NodeJS.ErrnoException).code === "ENOENT" || !stdout.trim()) return resolve(null);
      const [line, ...msg] = stdout.trim().split(/\r?\n/);
      resolve({ ok: false, line: Number(line) || undefined, message: `SyntaxError: ${msg.join(" ")} (line ${line})` });
    });
    child.stdin?.end(code);
  });
}

// ─── transcript ───────────────────────────────────────

function stringValue(src: string, s: StringLit): string {
  const raw = src.slice(s.contentStart, s.contentEnd);
  if (/r/i.test(s.prefix)) return raw;
  return raw.replace(/\\(\r?\n|n|t|"|'|\\)/g, (_m, c: string) =>
    c === "n" ? "\n" : c === "t" ? "\t" : c.startsWith("\r") || c === "\n" ? "" : c,
  );
}

export function extractTranscript(code: string): string {
  const scan = scanPython(code);
  const parts: string[] = [];
  for (const b of findBlocks(code, scan)) {
    if (!b.textArg) continue;
    const lit = scan.strings.find((s) => s.start >= b.textArg!.start && s.end <= b.textArg!.end);
    if (!lit) continue;
    const text = stringValue(code, lit)
      .replace(/<bookmark[^>]*\/?>/gi, "")
      .replace(/\s+/g, " ")
      .trim();
    if (text) parts.push(text);
  }
  return parts.join("\n\n");
}
