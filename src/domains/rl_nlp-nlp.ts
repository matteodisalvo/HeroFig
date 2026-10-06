// Modelli di NLP & LLM, ricalcati sulle figure di riferimento.
import { Builder, FLAME, FROZEN, type Color, type N } from '../builder';
import { COLORS, GROUP_STYLE, ICON } from '../model';
import type { TemplateDef } from '../registry';
import { tokenLayout } from './rl_nlp-shapes';

const { BLUE, GREEN, ORANGE, YELLOW, RED, PURPLE, TEAL, GRAY, WHITE } = COLORS;
const GRAD = { dashed: true, color: '#B85450' };
const NOTE = '#555555';
const FORMULA = { fill: '#FAFAFB', stroke: '#B8BEC8' };
const PANEL = { dashed: false, fill: '#F7F7F8', stroke: '#D5D8DC' };
/** Contenitore invisibile: punto d'arrivo delle frecce per gruppi di piccoli blocchi. */
const HIDDEN = { ...GROUP_STYLE, stroke: 'none', fill: 'none', dashed: false };

/** Ouyang et al. (2022), InstructGPT, Fig. 2: i tre passi di RLHF (SFT, reward model, PPO). */
function rlhf() {
  const t = new Builder();
  const ROWS = [80, 152, 224, 296, 368];
  const COLW = 280;
  const PROMPT = { shape: 'bubble' as const, w: 140, h: 50, radius: 8, fontSize: 9.5, strokeWidth: 1.2, ...YELLOW };
  const OUT = { w: 140, h: 34, radius: 4, fontSize: 9.5, italic: true, strokeWidth: 1, fill: '#FFFFFF', stroke: '#8A929C' };
  const net = (label: string, vx: number, row: number, c: Color) =>
    t.add({ shape: 'mlp', spec: '3,4,3', label, x: vx - 32, y: ROWS[row] - 30, w: 64, h: 44, strokeWidth: 1.2, ...ICON, fontSize: 11, bold: true, ...c });
  const labeler = (vx: number, row: number) => t.icon('user', '', vx - 15, ROWS[row] - 17, 30, 34, BLUE);
  const letter = (s: string, x: number, y: number, c: Color = WHITE) => t.box(s, x, y, 24, 24, c, { bold: true, fontSize: 11, radius: 4, strokeWidth: 1 });
  /** classifica D > C > A = B, centrata in vx */
  const ranking = (vx: number, y: number) => {
    const order: [string, string][] = [['D', '>'], ['C', '>'], ['A', '='], ['B', '']];
    let x = vx - 76;
    for (const [l, op] of order) {
      letter(l, x, y - 12, GRAY);
      x += 24;
      if (op) t.text(`$${op}$`, x, y - 10, 16, 20, { fontSize: 13 });
      x += 16;
    }
    return t.group('', vx - 80, y - 16, 160, 32, HIDDEN);
  };
  const steps: [string, string][] = [
    ['Step 1', 'Collect demonstration data,\nand train a supervised policy.'],
    ['Step 2', 'Collect comparison data,\nand train a reward model.'],
    ['Step 3', 'Optimize a policy against the\nreward model using reinforcement\nlearning.'],
  ];
  const captions: string[][] = [
    ['A prompt is\nsampled from our\nprompt dataset.', 'A labeler\ndemonstrates the\ndesired output\nbehavior.', '', 'This data is used\nto fine-tune GPT-3\nwith supervised\nlearning.', ''],
    ['A prompt and\nseveral model\noutputs are\nsampled.', '', 'A labeler ranks\nthe outputs from\nbest to worst.', '', 'This data is used\nto train our\nreward model.'],
    ['A new prompt\nis sampled from\nthe dataset.', 'The policy\ngenerates\nan output.', '', 'The reward model\ncalculates a\nreward for\nthe output.', 'The reward is\nused to update\nthe policy\nusing PPO.'],
  ];
  steps.forEach(([title, sub], i) => {
    const ox = i * (COLW + 20);
    t.group('', ox, -10, COLW, 420, PANEL);
    t.text(title, ox + 12, -2, 80, 18, { bold: true, fontSize: 13, align: 'left' });
    t.text(sub, ox + 12, 16, COLW - 24, 40, { fontSize: 10.5, align: 'left', textColor: '#333333' });
    captions[i].forEach((c, r) => c && t.text(c, ox + 12, ROWS[r] - 30, 112, 60, { fontSize: 9.5, align: 'left', textColor: NOTE }));
  });
  // Step 1: dimostrazioni → SFT
  let vx = 195;
  const p1 = t.add({ ...PROMPT, label: 'Explain the moon\nlanding to a 6 year old', x: vx - 70, y: ROWS[0] - 27 });
  const l1 = labeler(vx, 1);
  const d1 = t.box('Some people went\nto the moon...', vx - 70, ROWS[2] - 17, 140, 34, WHITE, OUT);
  const sft = net('SFT', vx, 3, BLUE);
  t.chain([p1, l1, d1, sft], 'down');
  // Step 2: confronti → reward model
  vx = 195 + COLW + 20;
  const p2 = t.add({ ...PROMPT, label: 'Explain the moon\nlanding to a 6 year old', x: vx - 70, y: ROWS[0] - 27 });
  ['A', 'B', 'C', 'D'].forEach((s, k) => letter(s, vx - 32 + (k % 2) * 40, ROWS[1] - 26 + Math.floor(k / 2) * 28, GRAY));
  const outs = t.group('', vx - 58, ROWS[1] - 30, 116, 60, HIDDEN);
  const l2 = labeler(vx, 2);
  const rank = ranking(vx, ROWS[3]);
  const rm = net('RM', vx, 4, GREEN);
  t.chain([p2, outs, l2, rank, rm], 'down');
  // Step 3: PPO contro il reward model
  vx = 195 + 2 * (COLW + 20);
  const p3 = t.add({ ...PROMPT, label: 'Write a story\nabout frogs', x: vx - 70, y: ROWS[0] - 27 });
  const ppo = net('PPO', vx, 1, ORANGE);
  const o3 = t.box('Once upon a time...', vx - 70, ROWS[2] - 17, 140, 34, WHITE, OUT);
  const rm3 = net('RM', vx, 3, GREEN);
  const rk = t.add({ shape: 'nlp-gauge', spec: '0.8', label: '$r_k$', x: vx - 24, y: ROWS[4] - 22, w: 48, h: 30, strokeWidth: 1, ...ICON, fontSize: 13, ...WHITE });
  t.chain([p3, ppo, o3, rm3, rk], 'down');
  t.link(rk, ppo, 'right', 'right', { ...GRAD, offset: 6 });
  return t.done();
}

/** Lewis et al. (2020): Retrieval-Augmented Generation, con indicizzazione offline e risposta online. */
function rag() {
  const t = new Builder();
  t.text('Offline indexing', 0, -40, 200, 16, { bold: true, fontSize: 11, align: 'left', textColor: NOTE });
  t.add({ shape: 'document', x: 16, y: 1, w: 52, h: 66, strokeWidth: 1.2, ...WHITE });
  t.add({ shape: 'document', x: 8, y: 9, w: 52, h: 66, strokeWidth: 1.2, ...WHITE });
  const docs = t.add({ shape: 'document', label: 'Documents', x: 0, y: 17, w: 52, h: 66, strokeWidth: 1.2, ...ICON, ...WHITE });
  const chunks = t.icon('nlp-chunks', 'Chunking', 112, 10, 64, 80, { fill: '#FFFFFF', stroke: '#8A929C' }, { count: 4 });
  const emb1 = t.box('Embedding\nmodel', 232, 25, 110, 50, PURPLE);
  const db = t.icon('nlp-vectordb', 'Vector database', 402, 0, 96, 100, PURPLE, { count: 4, labelPos: 'above' });
  t.chain([docs, chunks, emb1]);
  t.link(emb1, db, 'right', 'left', { label: 'index', labelPos: 'above' });
  t.text('Online: retrieve, augment, generate', 0, 268, 300, 16, { bold: true, fontSize: 11, align: 'left', textColor: NOTE });
  const user = t.icon('user', 'User', 0, 188, 40, 44, BLUE);
  const query = t.box('When was the Eiffel\nTower completed?', 72, 186, 150, 48, YELLOW, { fontSize: 10, radius: 10 });
  const emb2 = t.box('Embedding\nmodel', 262, 185, 110, 50, PURPLE);
  t.chain([user, query, emb2]);
  t.link(emb2, db, 'right', 'bottom');
  t.text('similarity search\n(top-$k$ nearest)', 456, 128, 110, 30, { fontSize: 10, align: 'left', textColor: NOTE });
  const topk = t.icon('nlp-chunks', 'Top-$k$ chunks', 562, 14, 60, 72, { fill: '#FFFFFF', stroke: '#8A929C' }, { count: 3 });
  t.text('Augmented prompt', 672, -8, 200, 16, { bold: true, fontSize: 11 });
  const prompt = t.box('Use the context to answer.\nContext: [chunk 1] ... [chunk k]\nQuestion: [query]\nAnswer:', 672, 12, 200, 76, WHITE, {
    fontSize: 10,
    align: 'left',
    stroke: '#8A929C',
    radius: 4,
  });
  const llm = t.icon('nlp-llm', 'LLM', 922, 13, 74, 74, ORANGE, { count: 4 });
  const ans = t.add({ shape: 'bubble', label: 'It was completed\nin 1889.', x: 1040, y: 20, w: 130, h: 58, radius: 10, fontSize: 10.5, strokeWidth: 1.2, ...GREEN });
  t.chain([db, topk, prompt, llm, ans]);
  t.link(query, prompt, 'bottom', 'bottom', { label: 'query', labelPos: 'above' });
  return t.done();
}

/** Yao et al. (2023), ReAct: ciclo Thought → Action → Observation con strumenti esterni. */
function react() {
  const t = new Builder();
  const q = t.box('Question', 0, 40, 150, 56, YELLOW, { bold: true, fontSize: 11, sublabel: 'Which is older, the Eiffel\nTower or the Statue of Liberty?', subSize: 9, radius: 10 });
  const llm = t.icon('nlp-llm', 'LLM', 190, 32, 70, 72, ORANGE, { count: 4, labelPos: 'above' });
  const th = t.box('Thought', 310, 40, 140, 56, BLUE, { bold: true, fontSize: 11, sublabel: 'reason about\nthe next step', subSize: 10 });
  const act = t.box('Action', 500, 40, 140, 56, ORANGE, { bold: true, fontSize: 11, sublabel: 'Search[entity]', subSize: 10 });
  const tools = t.group('Tools / environment', 690, 8, 172, 120, { fontSize: 11 });
  t.icon('nlp-tool', 'Search', 704, 50, 46, 36, { fill: '#FFFFFF', stroke: '#6C8EBF' }, { spec: 'web', radius: 4, fontSize: 10 });
  t.icon('nlp-tool', 'Calculator', 764, 46, 34, 42, GRAY, { spec: 'calc', radius: 4, fontSize: 10 });
  t.icon('nlp-tool', 'API', 816, 48, 40, 38, ORANGE, { spec: 'code', radius: 5, fontSize: 10 });
  const obs = t.box('Observation', 500, 170, 140, 56, GREEN, { bold: true, fontSize: 11, sublabel: 'tool output', subSize: 10 });
  const ans = t.box('Final answer', 140, 250, 140, 48, TEAL, { bold: true, fontSize: 11, sublabel: 'Statue of Liberty', subSize: 10 });
  t.chain([q, llm, th, act, tools]);
  t.link(tools, obs, 'bottom', 'right');
  t.link(obs, t.anchor(239.5, 103), 'left', 'bottom', { label: 'append to context', labelPos: 'above' });
  t.link(t.anchor(209.5, 103), ans, 'bottom', 'top', { label: 'Finish[answer]', labelPos: 'above' });
  t.text('repeat until Finish', 320, 118, 140, 16, { fontSize: 10, italic: true, textColor: NOTE });
  // traccia d'esempio nello stile della Fig. 1 del paper
  t.group('Example trajectory', 320, 250, 542, 196, { dashed: false, fill: '#FBFBFC', stroke: '#C8CDD3', fontSize: 11 });
  const C = { q: '#1A1A1A', th: '#2F6FB2', act: '#B26B00', obs: '#2E7D32' };
  const trace: [string, string][] = [
    ['q', 'Question: Which is older, the Eiffel Tower or the Statue of Liberty?'],
    ['th', 'Thought 1: I need the completion dates of both monuments.'],
    ['act', 'Action 1: Search[Eiffel Tower]'],
    ['obs', 'Observation 1: ... the tower was completed in 1889 ...'],
    ['th', 'Thought 2: Now I need the date of the Statue of Liberty.'],
    ['act', 'Action 2: Search[Statue of Liberty]'],
    ['obs', 'Observation 2: ... dedicated on October 28, 1886 ...'],
    ['th', 'Thought 3: 1886 is earlier than 1889, so the statue is older.'],
    ['act', 'Action 3: Finish[Statue of Liberty]'],
  ];
  trace.forEach(([k, s], i) => t.text(s, 334, 276 + i * 18, 520, 16, { fontSize: 10, align: 'left', textColor: C[k as keyof typeof C] }));
  return t.done();
}

/** Classificazione del testo con un encoder Transformer (BERT, Devlin et al. 2019): dal testo a p(y|x). */
function textClassification() {
  const t = new Builder();
  const inp = t.box('I loved this movie!', 120, 0, 240, 34, WHITE, { italic: true, stroke: '#8A929C' });
  const tok = t.box('Tokenizer (WordPiece)', 155, 62, 170, 32, GRAY, { fontSize: 11 });
  const TOKENS = '[CLS]|i|loved|this|movie|!|[SEP]';
  const toks = t.add({ shape: 'nlp-tokens', spec: TOKENS, x: 20, y: 124, w: 440, h: 28, radius: 5, strokeWidth: 1 });
  const chips = tokenLayout(TOKENS, 20, 440, 28);
  const IDS = ['101', '1045', '3866', '2023', '3185', '999', '102'];
  chips.forEach((c, i) => t.text(IDS[i], c.x, 154, c.w, 14, { fontSize: 9, textColor: '#6B7280' }));
  t.text('token ids', 462, 154, 60, 14, { fontSize: 9, textColor: '#6B7280', align: 'left' });
  const emb = t.box('Token + Segment + Position Embeddings', 20, 200, 440, 32, PURPLE, { fontSize: 11 });
  const enc = t.box('Transformer Encoder', 20, 262, 440, 56, ORANGE, { bold: true, fontSize: 13, sublabel: '$L$ layers, bidirectional self-attention', subSize: 10 });
  t.chain([inp, tok, toks], 'down');
  const cx = (c: { x: number; w: number }) => c.x + c.w / 2;
  let cls: N | null = null;
  chips.forEach((c, i) => {
    t.link(t.anchor(cx(c) - 0.5, 169), t.anchor(cx(c) - 0.5, 200), 'bottom', 'top');
    const h = t.add({ shape: 'cells', x: cx(c) - 8, y: 350, w: 16, h: 40, count: 4, radius: 2, strokeWidth: 1, ...(i === 0 ? TEAL : GRAY) });
    t.link(t.anchor(cx(c) - 0.5, 317), h, 'bottom', 'top');
    if (i === 0) cls = h;
  });
  t.link(emb, enc, 'bottom', 'top');
  const c0 = cx(chips[0]);
  t.text('$\\mathbf{h}_{\\mathrm{[CLS]}}$', c0 - 66, 360, 54, 20, { fontSize: 12 });
  t.text('contextual token representations (unused for classification)', 130, 392, 330, 14, { fontSize: 9, textColor: '#6B7280' });
  const clf = t.box('Linear + softmax', c0 - 62, 436, 124, 40, TEAL, { fontSize: 11 });
  t.link(cls!, clf, 'bottom', 'top');
  const bars = t.group('', 190, 418, 120, 76, HIDDEN);
  t.add({ x: 210, y: 424, w: 26, h: 52, radius: 0, strokeWidth: 1, ...GREEN });
  t.add({ x: 262, y: 472, w: 26, h: 4, radius: 0, strokeWidth: 1, ...RED });
  t.link(t.anchor(200, 476), t.anchor(300, 476), 'right', 'left', { arrowEnd: false, routing: 'straight', color: '#555555', width: 1 });
  t.text('positive', 198, 479, 50, 14, { fontSize: 9 });
  t.text('negative', 250, 479, 50, 14, { fontSize: 9 });
  t.text('0.97', 203, 409, 40, 14, { fontSize: 9, textColor: '#2E7D32' });
  t.text('0.03', 255, 457, 40, 14, { fontSize: 9, textColor: '#B23A30' });
  t.text('$p(y | x)$', 312, 440, 60, 20, { fontSize: 13, align: 'left' });
  t.link(clf, bars, 'right', 'left');
  return t.done();
}

/** Mikolov et al. (2013), Fig. 1: CBOW e Skip-gram; sotto, la regolarità king - man + woman ≈ queen. */
function word2vec() {
  const t = new Builder();
  const BOX = { w: 80, h: 26, fontSize: 12, radius: 0, strokeWidth: 1.2, ...WHITE };
  const CTX = ['$w(t-2)$', '$w(t-1)$', '$w(t+1)$', '$w(t+2)$'];
  const headers = (ox: number, xs: number[]) =>
    ['INPUT', 'PROJECTION', 'OUTPUT'].forEach((s, i) => t.text(s, ox + xs[i] - 50, 0, 100, 16, { fontSize: 11, bold: true }));
  const straight = { routing: 'straight' as const, color: '#333333' };
  // CBOW: il contesto, sommato nella proiezione, predice la parola centrale
  headers(0, [40, 190, 330]);
  const cin = CTX.map((s, i) => t.add({ ...BOX, label: s, x: 0, y: 30 + i * 48 }));
  const sum = t.add({ ...BOX, label: 'SUM', x: 160, y: 97, w: 60, h: 36, fontSize: 11 });
  const cout = t.add({ ...BOX, label: '$w(t)$', x: 290, y: 102 });
  for (const n of cin) t.link(n, sum, 'right', 'left', straight);
  t.link(sum, cout, 'right', 'left', straight);
  t.text('CBOW', 130, 222, 120, 18, { bold: true, fontSize: 13 });
  // Skip-gram: la parola centrale predice il contesto
  const ox = 470;
  headers(ox, [40, 190, 330]);
  const sin = t.add({ ...BOX, label: '$w(t)$', x: ox, y: 102 });
  const proj = t.add({ ...BOX, label: '', x: ox + 160, y: 97, w: 60, h: 36 });
  const sout = CTX.map((s, i) => t.add({ ...BOX, label: s, x: ox + 290, y: 30 + i * 48 }));
  t.link(sin, proj, 'right', 'left', straight);
  for (const n of sout) t.link(proj, n, 'right', 'left', straight);
  t.text('Skip-gram', ox + 130, 222, 120, 18, { bold: true, fontSize: 13 });
  // regolarità lineari nello spazio appreso
  const ex = 100, ey = 280, ew = 220, eh = 150;
  t.add({ shape: 'nlp-embspace', x: ex, y: ey, w: ew, h: eh, radius: 4, strokeWidth: 1.2, ...WHITE, stroke: '#6C8EBF' });
  const tx = ex + ew + 40;
  t.text('Skip-gram output (softmax over the vocabulary of size $W$):', tx, ey + 2, 380, 16, { fontSize: 11, align: 'left' });
  t.text("$p(w_O | w_I) = \\frac{\\exp({v'}^{\\top}_{O} v_{I})}{\\sum_{w=1}^{W} \\exp({v'}^{\\top}_{w} v_{I})}$", tx, ey + 22, 380, 50, { fontSize: 13, align: 'left' });
  t.text("$v_I$: input vector of $w_I$,  $v'_O$: output vector of $w_O$", tx, ey + 74, 380, 16, { fontSize: 10, align: 'left', textColor: NOTE });
  t.text('Learned vector offsets (male - female):', tx, ey + 104, 380, 16, { fontSize: 11, align: 'left' });
  t.text('$v(\\mathrm{king}) - v(\\mathrm{man}) + v(\\mathrm{woman}) \\approx v(\\mathrm{queen})$', tx, ey + 124, 380, 18, { fontSize: 12, align: 'left' });
  return t.done();
}

/** Rafailov et al. (2023), DPO, Fig. 1 (RLHF contro DPO) e dettaglio della loss con modello di riferimento. */
function dpo() {
  const t = new Builder();
  const prefData = (ox: number) => {
    t.add({ x: ox, y: 34, w: 190, h: 84, radius: 8, strokeWidth: 1.2, container: true, fill: '#FFFFFF', stroke: '#B8BEC8' });
    t.text('$x$: write me a poem about\nthe history of jazz', ox + 8, 40, 174, 32, { fontSize: 10 });
    t.box('$y_w$', ox + 38, 80, 44, 26, GREEN, { fontSize: 13, radius: 4, strokeWidth: 1 });
    t.text('$>$', ox + 84, 80, 22, 26, { fontSize: 14 });
    t.box('$y_l$', ox + 108, 80, 44, 26, RED, { fontSize: 13, radius: 4, strokeWidth: 1 });
    t.text('preference data', ox, 122, 190, 16, { fontSize: 10, italic: true, textColor: NOTE });
    return t.group('', ox, 34, 190, 84, HIDDEN);
  };
  t.group('Reinforcement Learning from Human Feedback (RLHF)', -16, -12, 720, 166, { ...PANEL, fontSize: 12, textColor: '#333333' });
  const p1 = prefData(0);
  const rm = t.box('reward model', 280, 51, 120, 50, YELLOW, { fontSize: 12 });
  const pol = t.box('LM policy', 470, 51, 120, 50, ORANGE, { fontSize: 12 });
  t.link(p1, rm, 'right', 'left', { label: 'maximum\nlikelihood', labelPos: 'above' });
  t.link(rm, pol, 'right', 'left', { label: 'label\nrewards', labelPos: 'above' });
  t.link(pol, rm, 'bottom', 'bottom', { label: 'sample completions', labelPos: 'below' });
  t.icon('cycle', '', 600, 64, 22, 22, { fill: 'none', stroke: '#555555' });
  t.text('reinforcement\nlearning', 628, 60, 70, 30, { fontSize: 10, align: 'left', textColor: NOTE });
  t.group('Direct Preference Optimization (DPO)', 724, -12, 420, 166, { ...PANEL, fontSize: 12, textColor: '#333333' });
  const p2 = prefData(740);
  const fin = t.box('final LM', 1020, 51, 110, 50, ORANGE, { fontSize: 12 });
  t.link(p2, fin, 'right', 'left', { label: 'maximum\nlikelihood', labelPos: 'above' });
  // dettaglio: la policy e il modello di riferimento congelato valutano la coppia (y_w, y_l)
  const Y = 222;
  const pair = t.box('$(x, y_w, y_l) \\sim \\mathcal{D}$', 30, Y + 16, 160, 50, WHITE, { fontSize: 13, stroke: '#8A929C', radius: 8 });
  const pt = t.box('$\\pi_\\theta(y | x)$', 270, Y - 10, 170, 50, ORANGE, { fontSize: 14, sublabel: 'policy (trainable)', subSize: 10 });
  t.add({ shape: 'flame', x: 430, y: Y - 22, w: 15, h: 20, ...FLAME });
  const pr = t.box('$\\pi_{\\mathrm{ref}}(y | x)$', 270, Y + 62, 170, 50, GRAY, { fontSize: 14, sublabel: 'reference = SFT model (frozen)', subSize: 10 });
  t.add({ shape: 'snowflake', x: 430, y: Y + 54, w: 16, h: 16, ...FROZEN });
  const imp = t.box('Implicit reward', 510, Y + 6, 260, 70, FORMULA, { bold: true, fontSize: 11, sublabel: '$\\hat{r}_\\theta(x, y) = \\beta \\log \\frac{\\pi_\\theta(y | x)}{\\pi_{\\mathrm{ref}}(y | x)}$', subSize: 12, radius: 10 });
  const loss = t.box('DPO loss', 840, Y + 6, 300, 70, { fill: '#FCEDEC', stroke: '#B85450' }, {
    bold: true,
    fontSize: 11,
    sublabel: '$\\mathcal{L}_{\\mathrm{DPO}} = -\\mathbb{E}_{\\mathcal{D}}[\\log \\sigma(\\hat{r}_\\theta(x, y_w) - \\hat{r}_\\theta(x, y_l))]$',
    subSize: 12,
    radius: 10,
  });
  t.link(pair, pt);
  t.link(pair, pr);
  t.link(pt, imp);
  t.link(pr, imp);
  t.link(imp, loss);
  t.link(loss, pt, 'top', 'top', { ...GRAD, label: '$\\nabla_\\theta$: increase $\\log \\pi_\\theta(y_w | x)$, decrease $\\log \\pi_\\theta(y_l | x)$', labelPos: 'above' });
  t.text(
    '$\\mathcal{L}_{\\mathrm{DPO}}(\\pi_\\theta; \\pi_{\\mathrm{ref}}) = -\\mathbb{E}_{\\mathcal{D}}[\\log \\sigma(\\beta \\log \\frac{\\pi_\\theta(y_w | x)}{\\pi_{\\mathrm{ref}}(y_w | x)} - \\beta \\log \\frac{\\pi_\\theta(y_l | x)}{\\pi_{\\mathrm{ref}}(y_l | x)})]$',
    130, Y + 130, 880, 44, { fontSize: 14 },
  );
  return t.done();
}

/** Hu et al. (2021), LoRA, Fig. 1: pesi pre-addestrati congelati e aggiornamento a basso rango BA. */
function lora() {
  const t = new Builder();
  const BAR = { fill: '#E8EEF6', stroke: '#8EA4C2' };
  const h = t.box('$h$', 40, 0, 300, 28, BAR, { fontSize: 15, radius: 8 });
  const plus = t.op('+', 177, 48);
  const W = t.box('Pretrained\nWeights', 40, 110, 140, 130, BLUE, { bold: true, fontSize: 12, sublabel: '$W \\in \\mathbb{R}^{d \\times d}$', subSize: 14 });
  t.add({ shape: 'snowflake', x: 166, y: 100, w: 18, h: 18, ...FROZEN });
  const ab = t.add({ shape: 'bottleneck', direction: 'bottom', x: 220, y: 110, w: 120, h: 130, strokeWidth: 1.2, fill: '#FDDCB5', stroke: '#D9822B' });
  t.add({ shape: 'flame', x: 330, y: 98, w: 15, h: 20, ...FLAME });
  t.text('$B = 0$', 240, 116, 80, 20, { fontSize: 13 });
  t.text('$A = \\mathcal{N}(0, \\sigma^2)$', 226, 212, 108, 20, { fontSize: 12 });
  t.text('$r$', 308, 165, 20, 20, { fontSize: 14 });
  const x = t.box('$x$', 40, 290, 300, 28, BAR, { fontSize: 15, radius: 8 });
  t.text('$d$', 14, 294, 20, 20, { fontSize: 13 });
  t.text('$d$', 14, 4, 20, 20, { fontSize: 13 });
  t.link(x, W, 'top', 'bottom');
  t.link(x, ab, 'top', 'bottom');
  t.link(W, plus, 'top', 'left');
  t.link(ab, plus, 'top', 'right');
  t.link(plus, h, 'top', 'bottom');
  t.text('$h = W x + \\Delta W x = W x + \\frac{\\alpha}{r} B A x$', 30, 330, 320, 40, { fontSize: 14 });
  t.text('trainable: $A \\in \\mathbb{R}^{r \\times d}$,  $B \\in \\mathbb{R}^{d \\times r}$,  rank $r$ much smaller than $d$', 0, 372, 380, 18, { fontSize: 10, textColor: NOTE });
  t.text('$\\Delta W x$ is scaled by $\\frac{\\alpha}{r}$ ($\\alpha$ constant in $r$)', 0, 390, 380, 30, { fontSize: 10, textColor: NOTE });
  return t.done();
}

/** Leviathan et al. (2023): speculative decoding, bozza del modello piccolo verificata in parallelo dal grande. */
function speculativeDecoding() {
  const t = new Builder();
  t.text('prefix', 0, 14, 150, 16, { fontSize: 10, textColor: NOTE });
  const prefix = t.add({ shape: 'nlp-tokens', spec: 'The|cat|sat', x: 0, y: 36, w: 150, h: 28, radius: 5, strokeWidth: 1 });
  const draft = t.icon('nlp-llm', 'Draft model $M_q$\n(small, fast)', 205, 24, 56, 52, GREEN, { count: 2, fontSize: 11 });
  const chip = (s: string, x: number, y: number, c: Color, extra = {}) => t.box(s, x, y, 54, 28, c, { fontSize: 11, radius: 5, strokeWidth: 1, ...extra });
  const DRAFT = { fill: '#FFF4E5', stroke: '#D79B00' };
  ['on', 'the', 'red', 'mat'].forEach((s, i) => chip(s, 320 + i * 62, 36, DRAFT, { dashed: true }));
  const drafts = t.group('', 316, 32, 248, 36, HIDDEN);
  t.text('$\\gamma = 4$ draft tokens $x_i \\sim q$ (sequential)', 316, 10, 248, 16, { fontSize: 10, textColor: NOTE });
  const target = t.icon('nlp-llm', 'Target model $M_p$\n(large)', 402, 146, 76, 84, ORANGE, { count: 6, fontSize: 11 });
  const verdict: [string, Color, string][] = [['on', GREEN, 'check'], ['the', GREEN, 'check'], ['red', RED, 'xmark'], ['big', BLUE, '']];
  verdict.forEach(([s, c, mark], i) => {
    const n = chip(s, 540 + i * 62, 174, c);
    if (mark) t.add({ shape: mark, x: n.x + 20, y: 210, w: 14, h: 13, fill: 'none', stroke: mark === 'check' ? '#2F9E44' : '#E5484D', strokeWidth: 1 });
  });
  const verified = t.group('', 536, 170, 248, 36, HIDDEN);
  t.text('accept $x_i$ with probability $\\min(1, \\frac{p(x_i)}{q(x_i)})$', 536, 128, 260, 34, { fontSize: 10, textColor: NOTE, align: 'left' });
  t.chain([prefix, draft, drafts]);
  t.link(drafts, target, 'bottom', 'top', { label: 'one parallel\nforward pass', labelPos: 'below' });
  t.link(prefix, target, 'bottom', 'left');
  t.link(target, verified);
  t.text('accepted', 540, 236, 116, 14, { fontSize: 10, textColor: '#2E7D32' });
  t.text('rejected', 664, 236, 54, 14, { fontSize: 10, textColor: '#B23A30' });
  t.text('resampled', 718, 236, 70, 14, { fontSize: 10, textColor: '#2F6FB2' });
  t.text('at the first rejection, sample from $\\mathrm{norm}(\\max(0, p - q))$:  3 new tokens from a single call to $M_p$', 60, 288, 700, 16, { fontSize: 11 });
  return t.done();
}

export const NLP_TEMPLATES: TemplateDef[] = [
  { id: 'nlp-rlhf', name: 'RLHF (InstructGPT)', section: 'NLP & LLM', build: rlhf },
  { id: 'nlp-rag', name: 'Retrieval-Augmented Generation', section: 'NLP & LLM', build: rag },
  { id: 'nlp-react', name: 'Agente ReAct con tool', section: 'NLP & LLM', build: react },
  { id: 'nlp-textclf', name: 'Classificazione del testo (BERT)', section: 'NLP & LLM', build: textClassification },
  { id: 'nlp-word2vec', name: 'word2vec (CBOW / Skip-gram)', section: 'NLP & LLM', build: word2vec },
  { id: 'nlp-dpo', name: 'DPO vs RLHF', section: 'NLP & LLM', build: dpo },
  { id: 'nlp-lora', name: 'LoRA', section: 'NLP & LLM', build: lora },
  { id: 'nlp-specdec', name: 'Speculative decoding', section: 'NLP & LLM', build: speculativeDecoding },
];
