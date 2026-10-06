// Mini-sintassi LaTeX nelle etichette: i tratti fra $...$ sono composti come in LaTeX
// (lettere in corsivo, cifre e operatori dritti, pedici/apici, \mathcal, \mathbb, simboli).
// Nell'export TikZ passano invariati.

export const SYMBOLS: Record<string, string> = {
  alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', epsilon: 'ε', varepsilon: 'ε', zeta: 'ζ', eta: 'η',
  theta: 'θ', kappa: 'κ', lambda: 'λ', mu: 'μ', nu: 'ν', xi: 'ξ', pi: 'π', rho: 'ρ', sigma: 'σ',
  tau: 'τ', phi: 'φ', varphi: 'φ', chi: 'χ', psi: 'ψ', omega: 'ω', Gamma: 'Γ', Delta: 'Δ',
  Theta: 'Θ', Lambda: 'Λ', Sigma: 'Σ', Phi: 'Φ', Psi: 'Ψ', Omega: 'Ω', times: '×', cdot: '·',
  oplus: '⊕', otimes: '⊗', odot: '⊙', to: '→', leftarrow: '←', rightarrow: '→', mapsto: '↦',
  sum: '∑', prod: '∏', nabla: '∇', partial: '∂', approx: '≈', neq: '≠', leq: '≤', geq: '≥',
  in: '∈', infty: '∞', ell: 'ℓ', pm: '±', sim: '∼', cup: '∪', cap: '∩', ldots: '…', dots: '…',
  cdots: '⋯', propto: '∝', circ: '∘', star: '⋆', top: '⊤', mid: '|', forall: '∀', exists: '∃',
  le: '≤', ge: '≥', ne: '≠', subset: '⊂', supset: '⊃', subseteq: '⊆', supseteq: '⊇', notin: '∉',
  vdots: '⋮', ddots: '⋱', langle: '⟨', rangle: '⟩', lfloor: '⌊', rfloor: '⌋', lceil: '⌈', rceil: '⌉',
  uparrow: '↑', downarrow: '↓', Rightarrow: '⇒', Leftarrow: '⇐', leftrightarrow: '↔', Leftrightarrow: '⇔',
  longrightarrow: '⟶', gets: '←', ast: '∗', emptyset: '∅', setminus: '∖', neg: '¬', wedge: '∧', vee: '∨',
  prime: '′', dagger: '†', perp: '⊥', parallel: '∥', equiv: '≡', simeq: '≃', ll: '≪', gg: '≫',
  int: '∫', oint: '∮', sqrt: '√', hbar: 'ℏ', Re: 'ℜ', Im: 'ℑ', aleph: 'ℵ', Pi: 'Π', Xi: 'Ξ', Upsilon: 'Υ',
  upsilon: 'υ', iota: 'ι', omicron: 'ο', vartheta: 'ϑ', varrho: 'ϱ', varsigma: 'ς',
};

const ACCENTS: Record<string, string> = {
  hat: '̂',
  tilde: '̃',
  bar: '̄',
  dot: '̇',
  vec: '⃗',
};

// Lettere calligrafiche e a doppio filetto: alcune stanno nel blocco "Letterlike Symbols".
const CAL_EXCEPT: Record<string, string> = { B: 'ℬ', E: 'ℰ', F: 'ℱ', H: 'ℋ', I: 'ℐ', L: 'ℒ', M: 'ℳ', R: 'ℛ' };
const BB_EXCEPT: Record<string, string> = { C: 'ℂ', H: 'ℍ', N: 'ℕ', P: 'ℙ', Q: 'ℚ', R: 'ℝ', Z: 'ℤ' };

const mapLetters = (text: string, except: Record<string, string>, base: number) =>
  [...text]
    .map((c) => (except[c] ?? (/[A-Z]/.test(c) ? String.fromCodePoint(base + c.charCodeAt(0) - 65) : c)))
    .join('');

export const mathcal = (t: string) => mapLetters(t, CAL_EXCEPT, 0x1d49c);
export const mathbb = (t: string) => mapLetters(t, BB_EXCEPT, 0x1d538);

export interface Run {
  text: string;
  italic: boolean;
  bold?: boolean;
  math?: boolean;
  script: 'sub' | 'sup' | null;
}

// marcatori interni per i tratti dritti (\mathrm, \text) e in grassetto (\mathbf)
const UP_ON = '\u0001';
const UP_OFF = '\u0002';
const BF_ON = '\u0003';
const BF_OFF = '\u0004';
const LBRACE = '\u0005';
const RBRACE = '\u0006';

const isCombining = (c: string) => /[\u0300-\u036f\u20d0-\u20ff]/.test(c);

/** In LaTeX sono corsive le lettere latine e le greche minuscole; il resto è dritto. */
const isItalicChar = (c: string) => /[A-Za-zα-ω]/.test(c);

/** Formula "piatta" (senza frazioni impilate) → tratti con corsivo, pedici, apici. */
export function mathToRuns(src: string): Run[] {
  const wrap = (t: string) => (t.replace(/\\[a-zA-Z]+|\{[^}]*\}|_.|\^./g, 'x').length > 1 ? `(${t})` : t);
  const s = src
    .replace(/\\[dt]?frac\{([^{}]*)\}\{([^{}]*)\}/g, (_, a: string, b: string) => `${wrap(a)}/${wrap(b)}`)
    .replace(/\\(displaystyle|textstyle|limits|nolimits|left|right|big|Big|bigg|Bigg)(?![a-zA-Z])/g, '')
    .replace(/\\([#%&$])/g, '$1')
    .replace(/\\\{/g, LBRACE)
    .replace(/\\\}/g, RBRACE)
    .replace(/\\\|/g, '‖')
    .replace(/\\sqrt\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}/g, (_, c: string) => (c.replace(/\\[a-zA-Z]+|\{[^}]*\}|_.|\^./g, 'x').length > 1 ? `√(${c})` : `√${c}`))
    .replace(/\\(hat|tilde|bar|dot|vec|widehat|widetilde|overline)\{([^}]*)\}/g, (_, a: string, c: string) => {
      const acc = ACCENTS[a.replace(/^wide|^overline$/, (m) => (m === 'overline' ? 'bar' : ''))] ?? ACCENTS.hat;
      return c + acc;
    })
    .replace(/\\mathcal\{([^}]*)\}/g, (_, c: string) => mathcal(c))
    .replace(/\\mathbb\{([^}]*)\}/g, (_, c: string) => mathbb(c))
    .replace(/\\(mathrm|text|operatorname|textrm)\{([^}]*)\}/g, `${UP_ON}$2${UP_OFF}`)
    .replace(/\\(mathbf|boldsymbol|bm)\{([^}]*)\}/g, `${BF_ON}$2${BF_OFF}`)
    .replace(/\\(mathit)\{([^}]*)\}/g, '$2')
    .replace(/\\(log|ln|exp|max|min|argmax|argmin|softmax|arg|sin|cos|tan|tanh|det|KL|lim|sup|inf|Pr|tr|diag|sign|var|Var|Cov|mod)(?![a-zA-Z])/g, `${UP_ON}$1${UP_OFF}`)
    // come in LaTeX, lo spazio dopo un simbolo "ordinario" (\partial, \alpha…) non conta;
    // dopo operatori e relazioni (\times, \in…) resta, per la spaziatura attorno
    .replace(/\\([a-zA-Z]+)( ?)/g, (_, name: string, sp: string) => {
      const sym = SYMBOLS[name];
      if (!sym) return name + sp;
      return /^[A-Za-zα-ωΑ-Ω∂∇ℓ∞ℏ∅ℜℑℵ]$/.test(sym) ? sym : sym + sp;
    })
    .replace(/\\[,;:! ]/g, ' ');

  const runs: Run[] = [];
  let upright = false;
  let bold = false;
  const push = (ch: string, script: Run['script']) => {
    const last = runs[runs.length - 1];
    // gli accenti combinanti restano attaccati alla lettera precedente
    if (isCombining(ch) && last) {
      last.text += ch;
      return;
    }
    const c = ch === '-' ? '\u2212' : ch === LBRACE ? '{' : ch === RBRACE ? '}' : ch;
    const italic = !upright && !bold && isItalicChar(c);
    if (last && last.italic === italic && !!last.bold === bold && last.script === script) last.text += c;
    else runs.push({ text: c, italic, bold, math: true, script });
  };
  const emit = (text: string, script: Run['script']) => {
    for (const c of text) {
      if (c === UP_ON) upright = true;
      else if (c === UP_OFF) upright = false;
      else if (c === BF_ON) bold = true;
      else if (c === BF_OFF) bold = false;
      // pedice dentro un pedice (es. E_{q_\phi}): si compone allo stesso livello
      else if (script && (c === '_' || c === '^')) continue;
      else if (c !== '{' && c !== '}') push(c, script);
    }
  };
  const chars = [...s];
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];
    if ((ch === '_' || ch === '^') && i + 1 < chars.length) {
      let body: string;
      if (chars[i + 1] === '{') {
        // graffe annidate: si cerca quella di chiusura corrispondente
        let depth = 0;
        let end = i + 1;
        for (; end < chars.length; end++) {
          if (chars[end] === '{') depth++;
          else if (chars[end] === '}' && --depth === 0) break;
        }
        body = chars.slice(i + 2, end).join('');
        i = end;
      } else {
        body = chars[i + 1];
        i++;
      }
      emit(body, ch === '_' ? 'sub' : 'sup');
    } else {
      emit(ch, null);
    }
  }
  return runs;
}

/** Divide una riga in tratti di testo e di formula. Un `$` spaiato resta testo. */
export function splitMath(line: string): { text: string; math: boolean }[] {
  const parts = line.split('$');
  const balanced = parts.length % 2 === 1;
  const out: { text: string; math: boolean }[] = [];
  parts.forEach((p, i) => {
    const last = i === parts.length - 1;
    if (i % 2 === 1 && (balanced || !last)) out.push({ text: p, math: true });
    else out.push({ text: i % 2 === 1 ? '$' + p : p, math: false });
  });
  return out.filter((p) => p.text !== '');
}

export function parseLine(line: string): Run[] {
  return splitMath(line).flatMap((p) =>
    p.math ? mathToRuns(p.text) : [{ text: p.text, italic: false, script: null } as Run],
  );
}

export function plainText(line: string): string {
  return parseLine(line)
    .map((r) => r.text)
    .join('');
}
