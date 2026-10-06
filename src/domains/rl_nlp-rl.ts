// Modelli di Reinforcement learning, ricalcati sulle figure di riferimento.
import { Builder, type N } from '../builder';
import { COLORS } from '../model';
import type { TemplateDef } from '../registry';
import { gridWorld } from './rl_nlp-shapes';

const { BLUE, GREEN, ORANGE, YELLOW, PURPLE, TEAL, GRAY, WHITE } = COLORS;
/** Flusso dei gradienti (aggiornamento dei parametri). */
const GRAD = { dashed: true, color: '#B85450' };
const NOTE = '#555555';
const ENV_GROUP = { dashed: false, fill: '#F3FAF1', stroke: '#82B366', textColor: '#2E5E2E', fontSize: 11 };
const FORMULA = { fill: '#FAFAFB', stroke: '#B8BEC8' };

/** Sutton & Barto (2018), Fig. 3.1: interazione agente-ambiente in un MDP. */
function agentEnvironment() {
  const t = new Builder();
  const agent = t.box('Agent', 170, 0, 150, 50, TEAL, { bold: true, fontSize: 13 });
  const env = t.box('Environment', 130, 150, 230, 50, GREEN, { bold: true, fontSize: 13 });
  t.link(agent, env, 'right', 'right', { label: 'action\n$A_t$', labelPos: 'below', fontSize: 11 });
  // stato e ricompensa escono dall'ambiente al passo t+1 e rientrano nell'agente come S_t, R_t
  t.link(t.anchor(129, 184.5), t.anchor(170, 14.5), 'left', 'left', { offset: -112, label: 'state\n$S_t$', labelPos: 'above', fontSize: 11 });
  t.link(t.anchor(129, 164.5), t.anchor(170, 34.5), 'left', 'left', { offset: -52, label: 'reward\n$R_t$', labelPos: 'above', fontSize: 11 });
  t.link(t.anchor(90, 135), t.anchor(90, 215), 'bottom', 'top', { dashed: true, arrowEnd: false, routing: 'straight', color: '#9AA0A6', width: 1 });
  t.text('$R_{t+1}$', 94, 145, 34, 16, { fontSize: 11 });
  t.text('$S_{t+1}$', 94, 189, 34, 16, { fontSize: 11 });
  return t.done();
}

/** Sutton & Barto (2018), Esempio 3.3: grafo di transizione del robot che ricicla lattine. */
function recyclingRobot() {
  const t = new Builder();
  const state = (label: string, x: number) => t.add({ shape: 'ellipse', label, x, y: 170, w: 64, h: 64, fontSize: 14, strokeWidth: 1.4, ...WHITE });
  const high = state('high', 70);
  const low = state('low', 430);
  const dot = (x: number, y: number, name: string, nx: number, ny: number) => {
    t.text(name, nx, ny, 60, 16, { fontSize: 11, italic: true });
    return t.add({ shape: 'ellipse', x: x - 5, y: y - 5, w: 10, h: 10, fill: '#222222', stroke: '#222222', strokeWidth: 1 });
  };
  /** punto sul bordo di uno stato, all'angolo `deg` (0° a destra, in senso orario) */
  const on = (s: N, deg: number) => {
    const r = s.w / 2, a = (deg * Math.PI) / 180;
    return t.anchor(s.x + r + r * Math.cos(a) - 0.5, s.y + r + r * Math.sin(a) - 0.5);
  };
  const hs = dot(102, 80, 'search', 72, 50);
  const hw = dot(-10, 202, 'wait', -40, 178);
  const ls = dot(462, 324, 'search', 432, 336);
  const lw = dot(574, 202, 'wait', 544, 210);
  const rc = dot(282, 202, 'recharge', 252, 210);
  const ARC = { arrowEnd: false, routing: 'straight' as const, color: '#333333' };
  const P = { routing: 'curve' as const, fontSize: 11, color: '#333333' };
  const UP = { ...P, labelPos: 'above' as const };
  const DOWN = { ...P, labelPos: 'below' as const };
  t.link(high, hs, 'top', 'bottom', ARC);
  t.link(hs, on(high, 215), 'left', 'left', { ...UP, label: '$\\alpha, r_{\\mathrm{search}}$' });
  t.link(hs, on(low, 225), 'right', 'top', { ...UP, label: '$1 - \\alpha, r_{\\mathrm{search}}$' });
  t.link(high, hw, 'left', 'right', ARC);
  t.link(hw, high, 'bottom', 'bottom', { ...DOWN, label: '$1, r_{\\mathrm{wait}}$' });
  t.link(low, lw, 'right', 'left', ARC);
  t.link(lw, on(low, 315), 'top', 'top', { ...UP, label: '$1, r_{\\mathrm{wait}}$' });
  t.link(low, ls, 'bottom', 'top', ARC);
  t.link(ls, on(low, 45), 'right', 'right', { ...DOWN, label: '$\\beta, r_{\\mathrm{search}}$' });
  t.link(ls, on(high, 45), 'left', 'bottom', { ...DOWN, label: '$1 - \\beta, -3$' });
  t.link(low, rc, 'left', 'right', ARC);
  t.link(rc, high, 'left', 'right', { routing: 'straight', color: '#333333', label: '$1, 0$', labelPos: 'above', fontSize: 11 });
  t.text('Recycling robot MDP', -40, 390, 180, 18, { bold: true, fontSize: 12, align: 'left' });
  t.text('open circles: states $s$   ·   solid dots: actions $a$   ·   arc labels: $p(s\' | s, a)$, $r(s, a, s\')$', -40, 410, 520, 18, { fontSize: 10, align: 'left', textColor: NOTE });
  return t.done();
}

/** Russell & Norvig, mondo 4×3 (Fig. 17.1-17.3): ambiente, utilità U(s) e policy ottima. */
function gridworld() {
  const t = new Builder();
  const g = gridWorld('3x4', 1);
  const W = 176, H = 132, Y0 = 30;
  const cw = W / g.C, ch = H / g.R;
  const P = { spec: '3x4', count: 1, w: W, h: H, y: Y0, strokeWidth: 1.2 };
  const xs = [0, 280, 560];
  const a = t.add({ ...P, shape: 'rl-gridworld', x: xs[0], ...WHITE, stroke: '#6C8EBF' });
  const b = t.add({ ...P, shape: 'rl-valuegrid', x: xs[1], ...BLUE, spec: '3x4 num3' });
  const c = t.add({ ...P, shape: 'rl-policygrid', x: xs[2], ...WHITE, stroke: '#6C8EBF' });
  t.text('(a)  Environment', xs[0], 2, W, 18, { bold: true, fontSize: 12 });
  t.text('(b)  Utilities $U(s)$', xs[1], 2, W, 18, { bold: true, fontSize: 12 });
  t.text('(c)  Optimal policy $\\pi^*(s)$', xs[2], 2, W, 18, { bold: true, fontSize: 12 });
  // coordinate come nel libro: colonne 1-4, righe 1-3 dal basso
  for (let i = 0; i < g.C; i++) t.text(String(i + 1), xs[0] + i * cw, Y0 + H + 3, cw, 14, { fontSize: 10, textColor: NOTE });
  for (let j = 0; j < g.R; j++) t.text(String(g.R - j), xs[0] - 18, Y0 + j * ch, 14, ch, { fontSize: 10, textColor: NOTE });
  t.link(a, b, 'right', 'left', { label: 'value\niteration', labelPos: 'above' });
  t.link(b, c, 'right', 'left', { label: 'greedy\npolicy', labelPos: 'above' });
  t.text(
    'Transition model: intended move with probability 0.8, each perpendicular move 0.1 (bumping into a wall: stay).   $R(s) = -0.04$,  $\\gamma = 1$',
    0, Y0 + H + 28, W + xs[2], 16, { fontSize: 10, textColor: NOTE },
  );
  t.text("$U(s) = R(s) + \\gamma \\max_a \\sum_{s'} P(s' | s, a)\\, U(s')$", xs[1] - 60, Y0 + H + 50, W + 120, 40, { fontSize: 13 });
  return t.done();
}

/** Mnih et al. (2015): DQN con experience replay e target network. */
function dqn() {
  const t = new Builder();
  const env = t.group('Environment', 0, 120, 130, 120, ENV_GROUP);
  t.icon('rl-env', '', 22, 146, 86, 76, GRAY, { spec: 'atari', radius: 5 });
  const replay = t.icon('rl-replay', 'Replay memory $\\mathcal{D}$', 200, 0, 110, 100, { fill: '#FFFFFF', stroke: '#8A929C' }, { count: 6, labelPos: 'above', fontSize: 11 });
  const target = t.box('$\\hat{Q}(s, a; \\theta^-)$', 400, 18, 150, 64, PURPLE, { fontSize: 15, sublabel: 'Target network', subSize: 11 });
  const qnet = t.box('$Q(s, a; \\theta)$', 400, 140, 150, 84, BLUE, { fontSize: 15, sublabel: 'Online Q-network', subSize: 11 });
  const tdt = t.box('TD target', 620, 18, 230, 64, FORMULA, { bold: true, fontSize: 11, sublabel: "$y_j = r_j + \\gamma \\max_{a'} \\hat{Q}(s_{j+1}, a'; \\theta^-)$", subSize: 12, radius: 10 });
  const loss = t.box('Loss', 620, 150, 230, 64, { fill: '#FCEDEC', stroke: '#B85450' }, { bold: true, fontSize: 11, sublabel: '$L(\\theta) = (y_j - Q(s_j, a_j; \\theta))^2$', subSize: 12, radius: 10 });
  t.link(env, replay, 'top', 'left', { label: 'store transition\n$(s_t, a_t, r_t, s_{t+1})$', labelPos: 'above' });
  t.link(replay, target, 'right', 'left', { label: '$s_{j+1}$', labelPos: 'above', fontSize: 11 });
  t.link(replay, t.anchor(400, 161.5), 'bottom', 'left', { label: 'minibatch $(s_j, a_j)$', labelPos: 'above' });
  t.link(t.anchor(129, 203.5), t.anchor(400, 203.5), 'right', 'left', { label: '$s_t$', labelPos: 'above', fontSize: 11 });
  t.link(qnet, env, 'bottom', 'bottom', { label: 'action $a_t$:  $\\epsilon$-greedy on $Q(s_t, \\cdot; \\theta)$', labelPos: 'below' });
  t.link(qnet, loss);
  t.link(target, tdt);
  t.link(tdt, loss, 'bottom', 'top', { label: '$y_j$', labelPos: 'below', fontSize: 11 });
  t.link(loss, t.anchor(529.5, 223), 'bottom', 'bottom', { ...GRAD, label: '$\\nabla_\\theta L(\\theta)$', labelPos: 'below', fontSize: 11 });
  t.link(qnet, target, 'top', 'bottom', { dashed: true, color: '#7E57C2', label: 'every $C$ steps:\n$\\theta^- \\leftarrow \\theta$', labelPos: 'below' });
  return t.done();
}

/** Actor-critic con PPO (Schulman et al. 2017): rollout, GAE, obiettivo clipped e value loss. */
function ppo() {
  const t = new Builder();
  const env = t.group('Environment', 0, 40, 130, 110, ENV_GROUP);
  t.icon('rl-env', '', 22, 68, 86, 70, BLUE, { spec: 'cartpole' });
  const actor = t.box('$\\pi_\\theta(a_t | s_t)$', 220, 20, 160, 56, ORANGE, { fontSize: 15, sublabel: 'Actor (policy)', subSize: 11 });
  const critic = t.box('$V_\\phi(s_t)$', 220, 120, 160, 56, PURPLE, { fontSize: 15, sublabel: 'Critic (value)', subSize: 11 });
  const buffer = t.icon('rl-replay', 'Rollout buffer', 15, 220, 100, 80, { fill: '#FFFFFF', stroke: '#8A929C' }, { count: 5, fontSize: 11 });
  const adv = t.box('Advantage estimation (GAE)', 175, 214, 250, 92, YELLOW, {
    bold: true,
    fontSize: 11,
    sublabel: '$\\delta_t = r_t + \\gamma V_\\phi(s_{t+1}) - V_\\phi(s_t)$\n$\\hat{A}_t = \\sum_{l=0}^{\\infty} (\\gamma \\lambda)^l \\delta_{t+l}$',
    subSize: 11,
  });
  const obj = t.box('Clipped surrogate objective', 480, 4, 360, 88, FORMULA, {
    bold: true,
    fontSize: 11,
    sublabel: '$L^{CLIP}(\\theta) = \\mathbb{E}_t[\\min(r_t(\\theta) \\hat{A}_t, \\mathrm{clip}(r_t(\\theta), 1 - \\epsilon, 1 + \\epsilon) \\hat{A}_t)]$\n$r_t(\\theta) = \\frac{\\pi_\\theta(a_t | s_t)}{\\pi_{\\mathrm{old}}(a_t | s_t)}$',
    subSize: 11,
    radius: 10,
  });
  const vloss = t.box('Value loss', 480, 120, 360, 56, FORMULA, { bold: true, fontSize: 11, sublabel: '$L^{VF}(\\phi) = (V_\\phi(s_t) - \\hat{R}_t)^2$', subSize: 12, radius: 10 });
  t.link(env, actor);
  t.link(env, critic);
  t.text('$s_t$', 136, 72, 30, 18, { fontSize: 12 });
  t.link(actor, env, 'top', 'top', { label: 'action $a_t \\sim \\pi_\\theta(\\cdot | s_t)$', labelPos: 'above' });
  t.link(env, buffer, 'bottom', 'top', { label: '$(s_t, a_t, r_t)$', labelPos: 'below' });
  t.link(buffer, adv);
  t.link(critic, adv, 'bottom', 'top', { label: '$V_\\phi(s_t)$', labelPos: 'below' });
  t.link(adv, vloss, 'right', 'bottom');
  t.link(adv, obj, 'right', 'right');
  t.text('$\\hat{R}_t = \\hat{A}_t + V_\\phi(s_t)$', 656, 200, 150, 18, { fontSize: 11, align: 'left' });
  t.text('$\\hat{A}_t$', 844, 150, 30, 18, { fontSize: 12, align: 'left' });
  t.link(obj, actor, 'left', 'right', { ...GRAD, label: '$\\nabla_\\theta L^{CLIP}$', labelPos: 'above' });
  t.link(vloss, critic, 'left', 'right', { ...GRAD, label: '$\\nabla_\\phi L^{VF}$', labelPos: 'above' });
  return t.done();
}

/** Hafner et al. (2020), Dreamer, Fig. 3: dinamica appresa, comportamento in immaginazione, azione. */
function dreamer() {
  const t = new Builder();
  const IMG = { shape: 'image' as const, w: 40, h: 40, radius: 3, strokeWidth: 1, fontSize: 12, labelPos: 'below' as const, ...BLUE };
  const REC = { ...IMG, fill: '#F2F6FC', stroke: '#9DB4D6', labelPos: 'above' as const };
  const STATE = { shape: 'ellipse' as const, w: 34, h: 34, fontSize: 12, strokeWidth: 1.2, ...GREEN };
  const IMAG = { ...STATE, fill: '#FFF4E5', stroke: '#D79B00', dashed: true };
  const ACT = { w: 26, h: 22, radius: 4, fontSize: 12, strokeWidth: 1, ...ORANGE };
  const OX = [0, 330, 660];
  const col = (ox: number, i: number) => ox + 35 + i * 95;
  const title = (ox: number, s: string) => t.text(s, ox - 10, 268, 300, 18, { bold: true, fontSize: 11 });
  for (const ox of OX) t.group('', ox - 10, -12, 300, 300, { dashed: false, stroke: '#D0D4DA', fill: '#FBFBFC' });
  // (a) dinamica dall'esperienza: encoder, modello di transizione, ricostruzione e ricompensa
  let prev: N | null = null;
  for (let i = 0; i < 3; i++) {
    const cx = col(OX[0], i);
    const o = t.add({ ...IMG, label: `$o_${i + 1}$`, x: cx - 20, y: 200 });
    const s = t.add({ ...STATE, label: `$s_${i + 1}$`, x: cx - 17, y: 118 });
    const r = t.add({ ...REC, label: `$\\hat{o}_${i + 1}$`, x: cx - 20, y: 30 });
    t.text(`$\\hat{r}_${i + 1}$`, cx + 22, 40, 26, 20, { fontSize: 12 });
    t.link(o, s, 'top', 'bottom');
    t.link(s, r, 'top', 'bottom');
    if (prev) t.link(prev, s, 'right', 'left', { label: `$a_${i}$`, labelPos: 'below', fontSize: 11 });
    prev = s;
  }
  title(OX[0], '(a) Learn dynamics from experience');
  // (b) comportamento in immaginazione: stati latenti immaginati, azioni dell'actor, valori del critic
  prev = null;
  for (let i = 0; i < 3; i++) {
    const cx = col(OX[1], i);
    const s = t.add({ ...(i ? IMAG : STATE), label: i ? `$\\hat{s}_${i + 1}$` : '$s_1$', x: cx - 17, y: 118 });
    const v = t.text(`$\\hat{v}_${i + 1}$, $\\hat{r}_${i + 1}$`, cx - 30, 46, 60, 20, { fontSize: 12 });
    t.link(s, v, 'top', 'bottom', { color: '#8E7DB6' });
    if (i === 0) t.link(t.add({ ...IMG, label: '$o_1$', x: cx - 20, y: 200 }), s, 'top', 'bottom');
    if (prev) t.link(prev, s, 'right', 'left', { label: `$\\hat{a}_${i}$`, labelPos: 'below', fontSize: 11, color: '#B26B00' });
    prev = s;
  }
  t.text('actor $q_\\phi(a_t | s_t)$  ·  critic $v_\\psi(s_t)$', OX[1] + 82, 212, 200, 16, { fontSize: 10, textColor: NOTE });
  t.text('imagined trajectory', OX[1] + 122, 166, 120, 14, { fontSize: 9, italic: true, textColor: '#B26B00' });
  title(OX[1], '(b) Learn behavior in imagination');
  // (c) azione nell'ambiente: osservazione → stato → azione → osservazione successiva
  prev = null;
  let act: N | null = null;
  for (let i = 0; i < 3; i++) {
    const cx = col(OX[2], i);
    const o = t.add({ ...IMG, label: `$o_${i + 1}$`, x: cx - 20, y: 200 });
    const s = t.add({ ...STATE, label: `$s_${i + 1}$`, x: cx - 17, y: 118 });
    t.link(o, s, 'top', 'bottom');
    if (prev) t.link(prev, s);
    if (act) t.link(act, o);
    const a = t.add({ ...ACT, label: `$a_${i + 1}$`, x: cx + 27, y: 209 });
    t.link(s, a, 'right', 'top', { color: '#B26B00' });
    prev = s;
    act = a;
  }
  title(OX[2], '(c) Act in the environment');
  return t.done();
}

/** Silver et al. (2017), AlphaGo Zero, Fig. 2: le quattro fasi della MCTS guidata da f_θ. */
function alphaZero() {
  const t = new Builder();
  const phases: [string, string][] = [['select', 'a   Select'], ['expand', 'b   Expand and evaluate'], ['backup', 'c   Backup'], ['play', 'd   Play']];
  const X = [0, 220, 440, 690];
  const trees = phases.map(([spec, name], i) => {
    t.text(name, X[i], 0, 170, 18, { bold: true, fontSize: 12, align: 'left' });
    return t.add({ shape: 'rl-mcts', spec, count: 3, x: X[i] + 10, y: 30, w: 150, h: 130, strokeWidth: 1.2, ...WHITE, stroke: '#555555' });
  });
  const note = (i: number, s: string, dy = 172, h = 18) => t.text(s, X[i] - 10, dy, 190, h, { fontSize: 11 });
  note(0, '$a = \\arg\\max_a (Q(s, a) + U(s, a))$', 170, 30);
  note(0, '$U(s, a) = c_{\\mathrm{puct}} P(s, a) \\frac{\\sqrt{\\sum_b N(s, b)}}{1 + N(s, a)}$', 208, 44);
  // (b) la foglia è valutata dalla rete: (p, v) = f_θ(s_L)
  const board = t.icon('rl-env', '', X[1] + 6, 182, 40, 40, YELLOW, { spec: 'go' });
  const f = t.box('$f_\\theta$', X[1] + 70, 188, 44, 28, TEAL, { fontSize: 14 });
  const pv = t.text('$(\\mathbf{p}, v)$', X[1] + 128, 192, 50, 20, { fontSize: 13 });
  t.link(board, f);
  t.link(f, pv);
  note(2, '$Q(s, a) = \\frac{W(s, a)}{N(s, a)}$', 170, 34);
  note(2, '$W \\leftarrow W + v$ along the path', 212);
  note(3, '$\\pi(a | s_0) = \\frac{N(s_0, a)^{1/\\tau}}{\\sum_b N(s_0, b)^{1/\\tau}}$', 170, 40);
  note(3, 'play the move $a \\sim \\pi$', 216);
  t.link(trees[0], trees[1]);
  t.link(trees[1], trees[2]);
  t.link(t.anchor(525, 256), t.anchor(85, 256), 'bottom', 'bottom', { dashed: true, color: '#9AA0A6', label: 'repeat for each simulation', labelPos: 'below' });
  t.link(t.anchor(655, -6), t.anchor(655, 290), 'bottom', 'top', { dashed: true, arrowEnd: false, routing: 'straight', color: '#C0C4CA', width: 1 });
  return t.done();
}

export const RL_TEMPLATES: TemplateDef[] = [
  { id: 'rl-agent-env', name: 'Ciclo agente-ambiente (MDP)', section: 'Reinforcement learning', build: agentEnvironment },
  { id: 'rl-mdp', name: 'Grafo MDP (robot riciclatore)', section: 'Reinforcement learning', build: recyclingRobot },
  { id: 'rl-gridworld', name: 'Grid world: valori e policy', section: 'Reinforcement learning', build: gridworld },
  { id: 'rl-dqn', name: 'DQN (replay + target network)', section: 'Reinforcement learning', build: dqn },
  { id: 'rl-ppo', name: 'Actor-critic / PPO', section: 'Reinforcement learning', build: ppo },
  { id: 'rl-dreamer', name: 'World model (Dreamer)', section: 'Reinforcement learning', build: dreamer },
  { id: 'rl-alphazero', name: 'AlphaZero (MCTS + rete)', section: 'Reinforcement learning', build: alphaZero },
];
