// Modulo di dominio "Robotica e controllo": manipolatori, robot mobili e con gambe, droni, sensori,
// mappe e pianificazione, simboli dei giunti, schemi a blocchi di controllo (PID, spazio di stato,
// MPC) e figure di robot learning (Diffusion Policy, RT-2, sim-to-real...).
// Forme in robotics-shapes.ts, modelli in robotics-templates.ts. I simboli DSP (nodo somma,
// integratore, saturazione) vengono dal modulo signal e si riusano senza duplicarli.
// Vedi src/registry.ts per l'API e src/domains/README.md per le convenzioni.
import './signal';
import { COLORS, ICON, MED_IMG, type Preset } from '../model';
import { registerPresets, registerShapes, registerTemplates } from '../registry';
import { ROBOTICS_SHAPES } from './robotics-shapes';
import { ROBOTICS_TEMPLATES } from './robotics-templates';

const { BLUE, GREEN, ORANGE, YELLOW, PURPLE, TEAL, GRAY, WHITE } = COLORS;

const R = 'Robotica';
const CT = 'Controllo';
const LINE = { strokeWidth: 1.2, ...ICON };
/** Grafico senza riquadro: assi grigi, curva nel colore del bordo. */
const TRACE = { fill: 'none', strokeWidth: 1.2, ...ICON };
/** Riquadro con formula, come le loss dei modelli di deep learning. */
const FORMULA = { bold: true, fontSize: 11, subSize: 13, radius: 10, fill: '#FAFAFB', stroke: '#B8BEC8', strokeWidth: 1.2 };
const ROB_BLUE = '#2F6FB2';
const ROB_RED = '#C0392B';

const presets: Preset[] = [
  // ---------------- manipolatori ----------------
  { id: 'rob-arm', name: 'Braccio robotico', category: R, node: { shape: 'rob-arm', spec: 'reach parallel', count: 3, label: 'Robot arm', w: 110, h: 86, ...LINE, ...BLUE } },
  { id: 'rob-arm-suction', name: 'Braccio con ventosa', category: R, node: { shape: 'rob-arm', spec: 'down suction', count: 4, label: 'Pick-and-place', w: 120, h: 86, ...LINE, ...GRAY } },
  { id: 'rob-arm-chain', name: 'Catena cinematica (θ)', category: R, node: { shape: 'rob-arm', spec: 'up notool angles', count: 3, label: 'Kinematic chain', w: 140, h: 120, ...LINE, ...BLUE } },
  { id: 'rob-arm-frames', name: 'Catena con frame', category: R, node: { shape: 'rob-arm', spec: 'reach parallel frames', count: 3, label: 'Joint frames', w: 130, h: 104, ...LINE, ...WHITE, stroke: '#4B5563' } },
  { id: 'rob-gripper', name: 'Pinza parallela', category: R, node: { shape: 'rob-gripper', spec: 'parallel', direction: 'bottom', label: 'Gripper', w: 54, h: 70, ...LINE, ...GRAY } },
  { id: 'rob-grasp', name: 'Pinza con oggetto', category: R, node: { shape: 'rob-gripper', spec: 'parallel closed object', direction: 'bottom', label: 'Grasp', w: 54, h: 70, ...LINE, ...GRAY } },
  { id: 'rob-suction', name: 'Ventosa', category: R, node: { shape: 'rob-gripper', spec: 'suction object', direction: 'bottom', label: 'Suction cup', w: 50, h: 74, ...LINE, ...GRAY } },
  // ---------------- robot mobili, con gambe, aerei ----------------
  { id: 'rob-mobile', name: 'Robot mobile', category: R, node: { shape: 'rob-mobile', spec: 'round sensor', direction: 'right', label: 'Mobile robot', w: 64, h: 64, ...LINE, ...BLUE } },
  { id: 'rob-mobile-frame', name: 'Robot mobile + frame', category: R, node: { shape: 'rob-mobile', spec: 'round frame', direction: 'right', label: 'Differential drive', w: 96, h: 96, ...LINE, ...BLUE } },
  { id: 'rob-quadruped', name: 'Quadrupede', category: R, node: { shape: 'rob-quadruped', spec: 'stand', label: 'Quadruped', w: 120, h: 86, ...LINE, ...YELLOW } },
  { id: 'rob-quadruped-trot', name: 'Quadrupede (trotto)', category: R, node: { shape: 'rob-quadruped', spec: 'trot', label: 'Trotting gait', w: 120, h: 86, ...LINE, ...YELLOW } },
  { id: 'rob-humanoid', name: 'Umanoide', category: R, node: { shape: 'rob-humanoid', spec: 'stand', label: 'Humanoid', w: 64, h: 110, ...LINE, ...GRAY } },
  { id: 'rob-humanoid-wave', name: 'Umanoide (saluto)', category: R, node: { shape: 'rob-humanoid', spec: 'wave', label: 'Humanoid', w: 70, h: 110, ...LINE, ...TEAL } },
  { id: 'rob-drone', name: 'Drone', category: R, node: { shape: 'rob-drone', spec: 'persp', label: 'Quadrotor', w: 110, h: 64, ...LINE, ...GRAY } },
  { id: 'rob-drone-thrust', name: 'Drone con spinte', category: R, node: { shape: 'rob-drone', spec: 'persp thrust', label: 'Rotor thrusts', w: 120, h: 96, ...LINE, ...GRAY } },
  { id: 'rob-drone-top', name: 'Drone (dall\'alto)', category: R, node: { shape: 'rob-drone', spec: 'top', label: 'Quadrotor (top)', w: 80, h: 80, ...LINE, ...GRAY } },
  // ---------------- frame e sensori ----------------
  { id: 'rob-frame', name: 'Terna x, y, z', category: R, node: { shape: 'rob-frame', spec: '3d', w: 74, h: 66, fill: 'none', stroke: '#3A3F47', ...LINE } },
  { id: 'rob-frame-w', name: 'Terna mondo {W}', category: R, node: { shape: 'rob-frame', spec: '3d subW', label: 'World frame', w: 80, h: 70, fill: 'none', stroke: '#3A3F47', ...LINE } },
  { id: 'rob-frame2d', name: 'Assi x, y', category: R, node: { shape: 'rob-frame', spec: '2d', w: 66, h: 60, fill: 'none', stroke: '#3A3F47', ...LINE } },
  { id: 'rob-rgbd', name: 'Camera RGB-D', category: R, node: { shape: 'rob-camera', spec: 'rgbd', label: 'RGB-D camera', w: 104, h: 40, ...LINE, ...GRAY } },
  { id: 'rob-camera-fov', name: 'Camera + campo visivo', category: R, node: { shape: 'rob-camera', spec: 'side fov', label: 'Camera', w: 110, h: 60, ...LINE, ...GRAY } },
  { id: 'rob-lidar', name: 'Scansione lidar', category: R, node: { shape: 'rob-lidar', count: 72, label: 'Lidar scan', w: 130, h: 100, ...LINE, fill: '#FFFFFF', stroke: ROB_RED } },
  // ---------------- mappe e pianificazione ----------------
  { id: 'rob-occgrid', name: 'Mappa a occupazione', category: R, node: { shape: 'rob-occgrid', spec: '16x12 unknown', label: 'Occupancy grid', w: 128, h: 96, ...LINE, fill: '#FFFFFF', stroke: '#555555' } },
  { id: 'rob-occpath', name: 'Mappa + percorso', category: R, node: { shape: 'rob-occgrid', spec: '24x18 path', label: 'Grid path planning', w: 144, h: 108, ...LINE, fill: '#FFFFFF', stroke: '#555555' } },
  { id: 'rob-path', name: 'Traiettoria (waypoint)', category: R, node: { shape: 'rob-path', count: 5, label: 'Trajectory', w: 140, h: 70, ...TRACE, stroke: ROB_BLUE } },
  { id: 'rob-path-obst', name: 'Traiettoria fra ostacoli', category: R, node: { shape: 'rob-path', spec: 'heading obstacles', count: 5, label: 'Collision-free path', w: 150, h: 90, ...TRACE, stroke: ROB_BLUE } },
  { id: 'rob-rrt', name: 'Albero RRT', category: R, node: { shape: 'rob-rrt', spec: 'labels', count: 400, label: 'RRT in $\\mathcal{C}$-space', w: 160, h: 116, radius: 3, ...LINE, fill: '#FFFFFF', stroke: ROB_BLUE } },
  { id: 'rob-posegraph', name: 'Grafo delle pose', category: R, node: { shape: 'rob-posegraph', spec: 'landmarks labels', count: 14, label: 'Pose graph', w: 150, h: 104, ...LINE, ...BLUE } },
  { id: 'rob-posegraph-drift', name: 'Pose con deriva', category: R, node: { shape: 'rob-posegraph', spec: 'drift', count: 14, label: 'Odometry drift', w: 150, h: 104, ...LINE, ...BLUE } },
  // ---------------- simboli dei giunti ----------------
  { id: 'rob-revolute', name: 'Giunto rotoidale', category: R, node: { shape: 'rob-joint', spec: 'revolute', w: 56, h: 46, ...LINE, ...BLUE } },
  { id: 'rob-prismatic', name: 'Giunto prismatico', category: R, node: { shape: 'rob-joint', spec: 'prismatic', w: 66, h: 40, ...LINE, ...BLUE } },
  { id: 'rob-spherical', name: 'Giunto sferico', category: R, node: { shape: 'rob-joint', spec: 'spherical', w: 46, h: 56, ...LINE, ...BLUE } },
  { id: 'rob-ground', name: 'Base fissa', category: R, node: { shape: 'rob-joint', spec: 'fixed', w: 54, h: 42, ...LINE, ...GRAY } },
  // ---------------- immagini della camera ----------------
  { id: 'rob-scene', name: 'Scena (tavolo)', category: R, node: { shape: 'rob-scene', spec: 'real gripper', label: 'Camera view', ...MED_IMG, w: 112, h: 84 } },
  { id: 'rob-scene-dr', name: 'Scena randomizzata', category: R, node: { shape: 'rob-scene', spec: 'random', count: 3, label: 'Randomized render', ...MED_IMG, w: 112, h: 84 } },
  { id: 'rob-pusht', name: 'Push-T', category: R, node: { shape: 'rob-scene', spec: 'pusht', count: 2, label: 'Push-T', ...MED_IMG, w: 88, h: 88 } },
  { id: 'rob-imgplane', name: 'Piano immagine', category: R, node: { shape: 'rob-imgplane', spec: 'traj labels', label: 'Image plane', w: 116, h: 92, radius: 2, ...LINE, fill: '#FFFFFF', stroke: '#9AA0A6' } },

  // ---------------- schemi a blocchi di controllo ----------------
  { id: 'rob-sumx', name: 'Nodo somma (a croce)', category: CT, node: { shape: 'sp-junction', spec: 'quad', w: 28, h: 28, strokeWidth: 1.2, ...WHITE } },
  { id: 'rob-tf', name: 'Funzione di trasferimento', category: CT, node: { label: '$G(s)$', w: 80, h: 46, radius: 4, fontSize: 15, strokeWidth: 1.2, ...BLUE } },
  { id: 'rob-tf-frac', name: 'G(s) razionale', category: CT, node: { label: '$\\frac{K}{s(\\tau s + 1)}$', w: 96, h: 56, radius: 4, fontSize: 14, strokeWidth: 1.2, ...BLUE } },
  { id: 'rob-pid', name: 'Controllore PID', category: CT, node: { label: '$K_p + \\frac{K_i}{s} + K_d s$', sublabel: 'PID controller', w: 150, h: 62, radius: 4, fontSize: 14, subSize: 11, strokeWidth: 1.2, ...ORANGE } },
  { id: 'rob-plant', name: 'Impianto', category: CT, node: { label: 'Plant', sublabel: '$G_p(s)$', w: 110, h: 54, radius: 4, fontSize: 13, subSize: 13, strokeWidth: 1.2, ...GREEN } },
  { id: 'rob-sensorbox', name: 'Sensore', category: CT, node: { label: 'Sensor', sublabel: '$H(s)$', w: 100, h: 50, radius: 4, fontSize: 13, subSize: 13, strokeWidth: 1.2, ...TEAL } },
  { id: 'rob-intg', name: 'Integratore 1/s', category: CT, node: { label: '$\\frac{1}{s}$', w: 44, h: 44, radius: 3, fontSize: 14, strokeWidth: 1.2, ...WHITE } },
  { id: 'rob-delay', name: 'Ritardo puro', category: CT, node: { label: '$e^{-sT}$', w: 58, h: 40, radius: 3, fontSize: 14, strokeWidth: 1.2, ...WHITE } },
  { id: 'rob-gainK', name: 'Guadagno di retroazione', category: CT, node: { shape: 'triangle', direction: 'left', label: '$K$', w: 46, h: 38, radius: 2, fontSize: 13, strokeWidth: 1.2, ...WHITE } },
  { id: 'rob-observer', name: 'Osservatore di stato', category: CT, node: { label: 'State observer', sublabel: '$\\hat{x}$', w: 120, h: 54, radius: 4, fontSize: 12, subSize: 14, strokeWidth: 1.2, ...PURPLE } },
  { id: 'rob-step', name: 'Risposta al gradino', category: CT, node: { shape: 'rob-step', spec: 'under annot labels', count: 1, label: 'Step response', w: 150, h: 96, ...TRACE, stroke: ROB_BLUE } },
  { id: 'rob-step3', name: 'Confronto smorzamenti', category: CT, node: { shape: 'rob-step', spec: 'band labels', count: 3, label: '$\\zeta = 0.3,\\ 0.7,\\ 1.6$', w: 150, h: 96, ...TRACE, stroke: ROB_BLUE } },
  { id: 'rob-horizon', name: 'Orizzonte MPC', category: CT, node: { shape: 'rob-horizon', spec: 'labels', label: 'Receding horizon', w: 290, h: 170, ...TRACE, stroke: '#3A3F47' } },
  { id: 'rob-ss', name: 'Modello in spazio di stato', category: CT, node: { label: 'State-space model', sublabel: '$\\dot{x} = A x + B u$\n$y = C x + D u$', w: 170, h: 74, ...FORMULA } },
  { id: 'rob-pidlaw', name: 'Legge PID', category: CT, node: { label: 'PID control law', sublabel: '$u(t) = K_p e(t) + K_i \\int_0^t e(\\tau)\\, d\\tau + K_d \\frac{de(t)}{dt}$', w: 340, h: 74, ...FORMULA } },
  { id: 'rob-mpccost', name: 'Problema MPC', category: CT, node: { label: 'MPC optimal control problem', sublabel: '$\\min_{u_{0:N-1}} \\sum_{i=0}^{N-1} \\|x_i - r_i\\|_Q^2 + \\|u_i\\|_R^2$', w: 320, h: 78, ...FORMULA } },
  { id: 'rob-lqr', name: 'Costo LQR', category: CT, node: { label: 'LQR cost', sublabel: '$J = \\int_0^\\infty (x^\\top Q x + u^\\top R u)\\, dt$', w: 260, h: 70, ...FORMULA } },
];

registerShapes(ROBOTICS_SHAPES);
registerPresets(presets);
registerTemplates(ROBOTICS_TEMPLATES);
