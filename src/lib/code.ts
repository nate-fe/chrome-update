import type { Lang } from './schema';

/** 첫 페인트 전에 실행되는 테마 복원 스크립트 (키는 client.ts의 THEME_KEY와 같다) */
export const THEME_BOOT = `try{var t=localStorage.getItem('cu-theme');if(t==='light'||t==='dark')document.documentElement.dataset.theme=t}catch(e){}`;

// ───────── 아주 작은 문법 강조기 ─────────

export type Token = { t: string; c?: 'com' | 'str' | 'kw' | 'num' | 'prop' | 'fn' | 'tag' | 'at' | 'sel' | 'punc' };

const JS_KW =
  /^(?:const|let|var|function|return|if|else|for|of|in|new|await|async|try|catch|throw|import|from|with|export|default|typeof|true|false|null|undefined)$/;

const RULES: Record<Lang, [RegExp, Token['c']][]> = {
  css: [
    [/^\/\*[\s\S]*?\*\//, 'com'],
    [/^"[^"]*"|^'[^']*'/, 'str'],
    [/^@[\w-]+/, 'at'],
    [/^--[\w-]+/, 'prop'],
    [/^[a-z-]+(?=\s*:(?!:))/i, 'prop'],
    [/^[a-z-]+(?=\()/i, 'fn'],
    [/^-?\d*\.?\d+(?:px|deg|%|em|rem|s|ms|fr|vw|vh)?/, 'num'],
    [/^[.#:]?[a-z][\w-]*/i, 'sel'],
    [/^[{}();:,>]/, 'punc'],
  ],
  js: [
    [/^\/\/[^\n]*/, 'com'],
    [/^\/\*[\s\S]*?\*\//, 'com'],
    [/^`(?:\\.|[^`])*`|^"(?:\\.|[^"])*"|^'(?:\\.|[^'])*'/, 'str'],
    [/^\d+(?:\.\d+)?/, 'num'],
    [/^[A-Za-z_$][\w$]*(?=\s*\()/, 'fn'],
    [/^[A-Za-z_$][\w$]*/, 'kw'],
    [/^[{}()[\];,.=>]/, 'punc'],
  ],
  html: [
    [/^<!--[\s\S]*?-->/, 'com'],
    [/^<\/?[a-z][\w-]*/i, 'tag'],
    [/^\/?>/, 'tag'],
    [/^"[^"]*"|^'[^']*'/, 'str'],
    [/^[a-z-]+(?==)/i, 'prop'],
  ],
};

export function tokenize(code: string, lang: Lang): Token[] {
  const rules = RULES[lang];
  const out: Token[] = [];
  let rest = code;
  let plain = '';
  // html 안의 <script> 내용은 js로 강조
  if (lang === 'html') {
    const m = code.match(/^([\s\S]*?<script>)([\s\S]*?)(<\/script>[\s\S]*)$/);
    if (m) return [...tokenize(m[1], 'html'), ...tokenize(m[2], 'js'), ...tokenize(m[3], 'html')];
  }
  while (rest) {
    let hit = false;
    for (const [re, c] of rules) {
      const m = rest.match(re);
      if (m && m[0]) {
        if (plain) out.push({ t: plain }), (plain = '');
        let cls = c;
        if (lang === 'js' && c === 'kw' && !JS_KW.test(m[0])) cls = undefined;
        out.push({ t: m[0], c: cls });
        rest = rest.slice(m[0].length);
        hit = true;
        break;
      }
    }
    if (!hit) {
      plain += rest[0];
      rest = rest.slice(1);
    }
  }
  if (plain) out.push({ t: plain });
  return out;
}

// ───────── 줄 단위 diff (F13) ─────────

export type DiffLine = { op: ' ' | '-' | '+'; text: string };

export function diffLines(a: string, b: string): DiffLine[] {
  const A = a.split('\n');
  const B = b.split('\n');
  const n = A.length;
  const m = B.length;
  const lcs = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--)
    for (let j = m - 1; j >= 0; j--) lcs[i][j] = A[i] === B[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
  const out: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (A[i] === B[j]) out.push({ op: ' ', text: A[i++] }), j++;
    else if (lcs[i + 1][j] >= lcs[i][j + 1]) out.push({ op: '-', text: A[i++] });
    else out.push({ op: '+', text: B[j++] });
  }
  while (i < n) out.push({ op: '-', text: A[i++] });
  while (j < m) out.push({ op: '+', text: B[j++] });
  return out;
}

export function lineCount(code: string): number {
  return code.split('\n').filter((l) => l.trim()).length;
}
