// Modulo di dominio: Reinforcement learning e NLP & LLM.
// Forme in rl_nlp-shapes.ts, modelli in rl_nlp-rl.ts e rl_nlp-nlp.ts.
// Vedi src/registry.ts per l'API e src/domains/README.md per le convenzioni.
import { COLORS, ICON, type Preset } from '../model';
import { registerPresets, registerShapes, registerTemplates } from '../registry';
import { NLP_TEMPLATES } from './rl_nlp-nlp';
import { RL_TEMPLATES } from './rl_nlp-rl';
import { RLNLP_SHAPES } from './rl_nlp-shapes';

const { BLUE, GREEN, ORANGE, YELLOW, RED, PURPLE, TEAL, GRAY, WHITE } = COLORS;
const RL = 'Reinforcement learning';
const NLP = 'NLP & LLM';

const PRESETS: Preset[] = [
  // ---------- Reinforcement learning ----------
  { id: 'rl-gridworld', name: 'Grid world', category: RL, node: { shape: 'rl-gridworld', label: 'Gridworld', w: 120, h: 90, spec: '3x4', count: 1, strokeWidth: 1.2, ...ICON, ...WHITE, stroke: '#6C8EBF' } },
  { id: 'rl-valuegrid', name: 'Funzione valore', category: RL, node: { shape: 'rl-valuegrid', label: '$V^*(s)$', w: 120, h: 90, spec: '3x4', count: 1, strokeWidth: 1.2, ...ICON, ...BLUE } },
  { id: 'rl-policygrid', name: 'Policy su griglia', category: RL, node: { shape: 'rl-policygrid', label: '$\\pi^*(s)$', w: 120, h: 90, spec: '3x4', count: 1, strokeWidth: 1.2, ...ICON, ...WHITE, stroke: '#6C8EBF' } },
  { id: 'rl-env', name: 'Ambiente', category: RL, node: { shape: 'rl-env', label: 'Environment', w: 60, h: 60, strokeWidth: 1.2, ...ICON, ...GREEN } },
  { id: 'rl-atari', name: 'Atari (Breakout)', category: RL, node: { shape: 'rl-env', spec: 'atari', label: 'Atari', w: 84, h: 70, radius: 6, strokeWidth: 1.2, ...ICON, ...GRAY } },
  { id: 'rl-cartpole', name: 'CartPole', category: RL, node: { shape: 'rl-env', spec: 'cartpole', label: 'CartPole', w: 90, h: 70, strokeWidth: 1.2, ...ICON, ...BLUE } },
  { id: 'rl-go', name: 'Go (scacchiera)', category: RL, node: { shape: 'rl-env', spec: 'go', label: 'Board state $s$', w: 70, h: 70, strokeWidth: 1.2, ...ICON, ...YELLOW } },
  { id: 'rl-reward', name: 'Ricompensa', category: RL, node: { shape: 'rl-reward', label: '$r_t$', w: 40, h: 40, strokeWidth: 1.2, ...ICON, fill: '#FFE08A', stroke: '#C9A227' } },
  { id: 'rl-trophy', name: 'Trofeo', category: RL, node: { shape: 'rl-reward', spec: 'trophy', label: 'Return', w: 44, h: 48, strokeWidth: 1.2, ...ICON, fill: '#FFE08A', stroke: '#C9A227' } },
  { id: 'rl-replay', name: 'Replay buffer', category: RL, node: { shape: 'rl-replay', label: 'Replay buffer $\\mathcal{D}$', w: 110, h: 96, count: 6, ...ICON, ...WHITE, stroke: '#8A929C', strokeWidth: 1.2 } },
  { id: 'rl-mcts', name: 'MCTS', category: RL, node: { shape: 'rl-mcts', label: 'MCTS', w: 130, h: 110, count: 3, spec: 'select', strokeWidth: 1.2, ...ICON, ...WHITE, stroke: '#555555' } },
  { id: 'rl-curve', name: 'Curva di return', category: RL, node: { shape: 'rl-curve', label: 'Episode return', w: 110, h: 76, count: 2, radius: 3, strokeWidth: 1.2, ...ICON, ...WHITE, stroke: '#3B6FB6' } },
  { id: 'rl-agentbox', name: 'Agente (box)', category: RL, node: { label: 'Agent', w: 140, h: 50, strokeWidth: 1.2, fontSize: 13, bold: true, ...TEAL } },
  { id: 'rl-envbox', name: 'Ambiente (box)', category: RL, node: { label: 'Environment', w: 180, h: 50, strokeWidth: 1.2, fontSize: 13, bold: true, ...GREEN } },
  { id: 'rl-actor', name: 'Actor (policy)', category: RL, node: { label: '$\\pi_\\theta(a | s)$', sublabel: 'Actor (policy)', w: 140, h: 56, fontSize: 15, subSize: 11, strokeWidth: 1.2, ...ORANGE } },
  { id: 'rl-critic', name: 'Critic (valore)', category: RL, node: { label: '$V_\\phi(s)$', sublabel: 'Critic (value)', w: 140, h: 56, fontSize: 15, subSize: 11, strokeWidth: 1.2, ...PURPLE } },
  { id: 'rl-qnet', name: 'Q-network', category: RL, node: { label: '$Q(s, a; \\theta)$', sublabel: 'Q-network', w: 140, h: 56, fontSize: 15, subSize: 11, strokeWidth: 1.2, ...BLUE } },
  { id: 'rl-state', name: 'Stato (MDP)', category: RL, node: { shape: 'ellipse', label: '$s$', w: 54, h: 54, fontSize: 16, strokeWidth: 1.2, ...WHITE } },
  { id: 'rl-action', name: 'Nodo azione', category: RL, node: { shape: 'ellipse', label: 'action', w: 12, h: 12, fontSize: 11, labelPos: 'below', italic: true, fill: '#222222', stroke: '#222222', strokeWidth: 1 } },
  {
    id: 'rl-tdtarget',
    name: 'TD target',
    category: RL,
    node: { label: 'TD target', sublabel: "$y = r + \\gamma \\max_{a'} Q(s', a'; \\theta^-)$", w: 220, h: 64, bold: true, fontSize: 11, subSize: 13, radius: 10, fill: '#FAFAFB', stroke: '#B8BEC8', strokeWidth: 1.2 },
  },
  {
    id: 'rl-ppoclip',
    name: 'Obiettivo PPO',
    category: RL,
    node: {
      label: 'PPO clipped objective',
      sublabel: '$L^{CLIP}(\\theta) = \\mathbb{E}_t[\\min(r_t(\\theta) \\hat{A}_t, \\mathrm{clip}(r_t(\\theta), 1 - \\epsilon, 1 + \\epsilon) \\hat{A}_t)]$\n$r_t(\\theta) = \\frac{\\pi_\\theta(a_t | s_t)}{\\pi_{\\mathrm{old}}(a_t | s_t)}$',
      w: 400,
      h: 92,
      bold: true,
      fontSize: 11,
      subSize: 12,
      radius: 10,
      fill: '#FAFAFB',
      stroke: '#B8BEC8',
      strokeWidth: 1.2,
    },
  },
  {
    id: 'rl-bellman',
    name: 'Equazione di Bellman',
    category: RL,
    node: { label: 'Bellman optimality', sublabel: "$V^*(s) = \\max_a \\sum_{s'} P(s' | s, a)\\, [R(s, a, s') + \\gamma V^*(s')]$", w: 340, h: 70, bold: true, fontSize: 11, subSize: 13, radius: 10, fill: '#FAFAFB', stroke: '#B8BEC8', strokeWidth: 1.2 },
  },
  // ---------- NLP & LLM ----------
  { id: 'nlp-tokens', name: 'Token (chip)', category: NLP, node: { shape: 'nlp-tokens', spec: 'The|cat|sat|on|the|mat', w: 220, h: 26, radius: 5, strokeWidth: 1 } },
  { id: 'nlp-subword', name: 'Subword (WordPiece)', category: NLP, node: { shape: 'nlp-tokens', spec: '[CLS]|token|##ization|is|fun|[SEP]', w: 250, h: 26, radius: 5, strokeWidth: 1 } },
  { id: 'nlp-embspace', name: 'Analogie embedding', category: NLP, node: { shape: 'nlp-embspace', label: '$\\mathrm{king} - \\mathrm{man} + \\mathrm{woman} \\approx \\mathrm{queen}$', w: 130, h: 100, radius: 4, strokeWidth: 1.2, ...ICON, ...WHITE, stroke: '#6C8EBF' } },
  { id: 'nlp-vectordb', name: 'Vector DB', category: NLP, node: { shape: 'nlp-vectordb', label: 'Vector DB', w: 80, h: 90, count: 4, strokeWidth: 1.2, ...ICON, ...PURPLE } },
  { id: 'nlp-chunks', name: 'Chunk', category: NLP, node: { shape: 'nlp-chunks', label: 'Chunks', w: 70, h: 80, count: 4, strokeWidth: 1.2, ...ICON, ...WHITE, stroke: '#8A929C' } },
  { id: 'nlp-chat', name: 'Chat', category: NLP, node: { shape: 'nlp-chat', label: 'Chat', w: 120, h: 100, count: 4, strokeWidth: 1.2, ...ICON, ...WHITE, stroke: '#B8BEC8' } },
  { id: 'nlp-tool', name: 'Tool', category: NLP, node: { shape: 'nlp-tool', label: 'Tool', w: 40, h: 40, strokeWidth: 1.2, ...ICON, ...GRAY } },
  { id: 'nlp-func', name: 'Function call', category: NLP, node: { shape: 'nlp-tool', spec: 'code', label: 'Function call', w: 44, h: 40, radius: 6, strokeWidth: 1.2, ...ICON, ...ORANGE } },
  { id: 'nlp-calc', name: 'Calcolatrice', category: NLP, node: { shape: 'nlp-tool', spec: 'calc', label: 'Calculator', w: 40, h: 48, radius: 5, strokeWidth: 1.2, ...ICON, ...GRAY } },
  { id: 'nlp-web', name: 'Ricerca web', category: NLP, node: { shape: 'nlp-tool', spec: 'web', label: 'Web search', w: 56, h: 44, radius: 5, strokeWidth: 1.2, ...ICON, ...WHITE, stroke: '#6C8EBF' } },
  { id: 'nlp-llm', name: 'LLM', category: NLP, node: { shape: 'nlp-llm', label: 'LLM', w: 74, h: 74, count: 4, strokeWidth: 1.2, ...ICON, ...ORANGE } },
  { id: 'nlp-kvcache', name: 'KV cache', category: NLP, node: { shape: 'nlp-kvcache', label: 'KV cache', w: 90, h: 80, count: 4, strokeWidth: 1, ...ICON, ...BLUE } },
  { id: 'nlp-gauge', name: 'Punteggio RM', category: NLP, node: { shape: 'nlp-gauge', label: '$r_\\phi(x, y)$', w: 70, h: 42, spec: '0.8', strokeWidth: 1, ...ICON, ...WHITE } },
  { id: 'nlp-rm', name: 'Reward model', category: NLP, node: { label: '$r_\\phi(x, y)$', sublabel: 'Reward model', w: 140, h: 56, fontSize: 15, subSize: 11, strokeWidth: 1.2, ...YELLOW } },
  { id: 'nlp-policy', name: 'Policy LM', category: NLP, node: { label: '$\\pi_\\theta(y | x)$', sublabel: 'Policy LM', w: 140, h: 56, fontSize: 15, subSize: 11, strokeWidth: 1.2, ...ORANGE } },
  { id: 'nlp-ref', name: 'Modello di riferimento', category: NLP, node: { label: '$\\pi_{\\mathrm{ref}}(y | x)$', sublabel: 'Reference model (frozen)', w: 160, h: 56, fontSize: 15, subSize: 11, strokeWidth: 1.2, ...GRAY } },
  { id: 'nlp-prompt', name: 'Prompt con contesto', category: NLP, node: { label: 'Context: [retrieved chunks]\nQuestion: [user query]\nAnswer:', w: 190, h: 64, fontSize: 10, align: 'left', strokeWidth: 1.2, ...WHITE, stroke: '#8A929C' } },
  { id: 'nlp-answer', name: 'Risposta', category: NLP, node: { shape: 'bubble', label: 'Answer', w: 110, h: 56, radius: 10, fontSize: 12, ...GREEN } },
  { id: 'nlp-dpoloss', name: 'Loss DPO', category: NLP, node: { label: 'DPO loss', sublabel: '$-\\log \\sigma(\\beta \\log \\frac{\\pi_\\theta(y_w | x)}{\\pi_{\\mathrm{ref}}(y_w | x)} - \\beta \\log \\frac{\\pi_\\theta(y_l | x)}{\\pi_{\\mathrm{ref}}(y_l | x)})$', w: 380, h: 76, bold: true, fontSize: 11, subSize: 13, radius: 10, fill: '#FAFAFB', stroke: '#B8BEC8', strokeWidth: 1.2 } },
  { id: 'nlp-redbox', name: 'Testo generato', category: NLP, node: { label: 'Once upon a time...', w: 130, h: 34, fontSize: 11, italic: true, radius: 4, strokeWidth: 1, ...RED } },
];

registerShapes(RLNLP_SHAPES);
registerPresets(PRESETS);
registerTemplates([...RL_TEMPLATES, ...NLP_TEMPLATES]);
