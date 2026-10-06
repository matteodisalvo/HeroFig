// Modelli del modulo "Robotica e controllo": schemi di controllo (PID, spazio di stato, MPC,
// visual servoing, teleoperazione), architetture robotiche (sense-plan-act, SLAM, ROS),
// cinematica e pianificazione (DH, RRT) e figure di robot learning ricalcate dai paper.
// I blocchi sono posizionati per centro, così le porte restano allineate e le linee dritte.
import { Builder, type Color } from '../builder';
import { COLORS, ICON, MED_IMG, type NodeModel } from '../model';
import type { TemplateDef } from '../registry';

const { BLUE, GREEN, ORANGE, YELLOW, RED, PURPLE, TEAL, GRAY, WHITE } = COLORS;
const SEC = 'Robotica e controllo';
const INK = '#333333';
const SOFT = '#9AA0A6';
const MUTED = '#555555';
const ROB_BLUE = '#2F6FB2';
const NOARROW = { arrowEnd: false };
const FORMULA = { bold: true, fontSize: 11, subSize: 13, radius: 10, fill: '#FAFAFB', stroke: '#B8BEC8', strokeWidth: 1.2 };
const LAB = { labelPos: 'above' as const, fontSize: 12 };
type N = NodeModel;

/** Rettangolo dato il centro. */
const C = (cx: number, cy: number, w: number, h: number) => ({ x: cx - w / 2, y: cy - h / 2, w, h });

const dot = (t: Builder, cx: number, cy: number) => t.add({ shape: 'ellipse', ...C(cx, cy, 6, 6), fill: INK, stroke: INK, strokeWidth: 1 });
/** Nodo somma dei diagrammi di controllo (cerchio con la croce, simbolo DSP del modulo signal). */
const junction = (t: Builder, cx: number, cy: number, spec = 'quad', r = 13) => t.add({ shape: 'sp-junction', spec, ...C(cx, cy, 2 * r, 2 * r), strokeWidth: 1.2, ...WHITE });
const sig = (t: Builder, label: string, cx: number, cy: number, w = 44, h = 20, extra: Partial<N> = {}) => t.text(label, cx - w / 2, cy - h / 2, w, h, { fontSize: 13, ...extra });
const sign = (t: Builder, s: '+' | '-', cx: number, cy: number) => t.text(s === '+' ? '$+$' : '$-$', cx - 6, cy - 7, 12, 14, { fontSize: 11 });
const block = (t: Builder, label: string, cx: number, cy: number, w: number, h: number, c: Color, extra: Partial<N> = {}) => t.box(label, cx - w / 2, cy - h / 2, w, h, c, { radius: 4, ...extra });
/** Disegno di un robot o di un sensore (forma del modulo) con l'etichetta sotto. */
const draw = (t: Builder, shape: string, spec: string, label: string, cx: number, cy: number, w: number, h: number, c: Color, extra: Partial<N> = {}) =>
  t.add({ shape, spec, label, ...C(cx, cy, w, h), strokeWidth: 1.2, ...ICON, fontSize: 11, ...c, ...extra });
const view = (t: Builder, spec: string, title: string, cx: number, cy: number, w: number, h: number, extra: Partial<N> = {}) =>
  t.add({ shape: 'rob-scene', spec, ...MED_IMG, label: title, ...C(cx, cy, w, h), ...extra });
const panel = (t: Builder, label: string, x: number, y: number, w: number, h: number, extra: Partial<N> = {}) =>
  t.group(label, x, y, w, h, { dashed: false, fill: '#FAFBFC', stroke: '#C9CED6', textColor: '#444444', bold: true, fontSize: 11, ...extra });
/** Estremo invisibile centrato esattamente in (x, y): le linee verticali restano dritte. */
const at = (t: Builder, x: number, y: number) => t.anchor(x - 0.5, y - 0.5);
/** Linea libera fra due punti (assi del tempo, quote). */
const free = (t: Builder, x1: number, y1: number, x2: number, y2: number, extra: Record<string, unknown> = {}) =>
  t.link(at(t, x1, y1), at(t, x2, y2), x2 >= x1 ? 'right' : 'left', x2 >= x1 ? 'left' : 'right', { routing: 'straight', ...extra });
/** Icona predefinita (utente, robot, immagine...) posizionata per centro. */
const ico = (t: Builder, shape: N['shape'], label: string, cx: number, cy: number, w: number, h: number, c: Color, extra: Partial<N> = {}) => t.icon(shape, label, cx - w / 2, cy - h / 2, w, h, c, extra);
/** Gettone (token) a pillola. */
const pill = (t: Builder, cx: number, cy: number, c: Color, w = 20) => t.add({ ...C(cx, cy, w, 9), radius: 4.5, strokeWidth: 1.2, ...c });

// ======================================================================
// Controllo
// ======================================================================

/** Anello di controllo PID: termini P, I, D in parallelo, impianto, sensore in retroazione. */
function pid() {
  const t = new Builder();
  const Y = 120;
  t.group('PID controller', 178, -10, 244, 244, { textColor: '#8A5A00', stroke: '#D79B00' });
  const r = sig(t, '$r(t)$', 22, Y, 36);
  const s1 = junction(t, 90, Y);
  const bd = dot(t, 152, Y);
  const P = block(t, '$K_p\\, e(t)$', 280, 50, 150, 42, ORANGE, { fontSize: 14 });
  const I = block(t, '$K_i \\int_0^t e(\\tau)\\, d\\tau$', 280, Y, 150, 46, ORANGE, { fontSize: 14 });
  const D = block(t, '$K_d \\frac{de(t)}{dt}$', 280, 190, 150, 52, ORANGE, { fontSize: 14 });
  const s2 = junction(t, 395, Y);
  const plant = block(t, 'Plant', 520, Y, 110, 56, GREEN, { sublabel: '$G(s)$', subSize: 13, fontSize: 13 });
  const od = dot(t, 625, Y);
  const out = draw(t, 'rob-step', 'tuned', 'Closed-loop response', 760, Y, 140, 88, { fill: 'none', stroke: ROB_BLUE }, { count: 1 });
  const sensor = block(t, 'Sensor', 370, 285, 104, 46, TEAL, { sublabel: '$H(s)$', subSize: 13, fontSize: 12 });
  t.link(r, s1);
  t.link(s1, bd, 'right', 'left', { ...NOARROW, label: '$e(t)$', ...LAB });
  t.link(bd, P, 'top', 'left');
  t.link(bd, I);
  t.link(bd, D, 'bottom', 'left');
  t.link(P, s2, 'right', 'top');
  t.link(I, s2);
  t.link(D, s2, 'right', 'bottom');
  t.link(s2, plant, 'right', 'left', { label: '$u(t)$', ...LAB });
  t.link(plant, od, 'right', 'left', NOARROW);
  t.link(od, out, 'right', 'left', { label: '$y(t)$', ...LAB });
  t.link(od, sensor, 'bottom', 'right');
  t.link(sensor, s1, 'left', 'bottom', { label: '$y_m(t)$', labelPos: 'below', fontSize: 12 });
  sign(t, '+', 70, Y - 12);
  sign(t, '-', 78, Y + 25);
  sign(t, '+', 407, Y - 25);
  sign(t, '+', 375, Y - 12);
  sign(t, '+', 407, Y + 25);
  return t.done();
}

/** Modello in spazio di stato: integratore, matrici A, B, C, D e anello interno di A. */
function stateSpace() {
  const t = new Builder();
  const Y = 130, YA = 215, YD = 45;
  const u = sig(t, '$u(t)$', 22, Y, 40);
  const ud = dot(t, 70, Y);
  const B = block(t, '$B$', 140, Y, 54, 40, BLUE, { fontSize: 15 });
  const s1 = junction(t, 220, Y);
  const integ = t.add({ shape: 'sp-opbox', spec: 'int', ...C(310, Y, 46, 46), radius: 3, strokeWidth: 1.2, ...WHITE });
  const xd = dot(t, 405, Y);
  const Cm = block(t, '$C$', 475, Y, 54, 40, BLUE, { fontSize: 15 });
  const s2 = junction(t, 555, Y);
  const y = sig(t, '$y(t)$', 620, Y, 40);
  const A = block(t, '$A$', 310, YA, 54, 40, PURPLE, { fontSize: 15 });
  const D = block(t, '$D$', 310, YD, 54, 40, GRAY, { fontSize: 15 });
  t.link(u, ud, 'right', 'left', NOARROW);
  t.chain([ud, B, s1]);
  t.link(s1, integ, 'right', 'left', { label: '$\\dot{x}$', ...LAB });
  t.link(integ, xd, 'right', 'left', { ...NOARROW, label: '$x(t)$', ...LAB });
  t.chain([xd, Cm, s2, y]);
  t.link(xd, A, 'bottom', 'right');
  t.link(A, s1, 'left', 'bottom');
  t.link(ud, D, 'top', 'left');
  t.link(D, s2, 'right', 'top');
  sign(t, '+', 200, Y - 12);
  sign(t, '+', 208, Y + 25);
  sign(t, '+', 535, Y - 12);
  sign(t, '+', 567, Y - 25);
  t.add({ label: 'Linear time-invariant system', sublabel: '$\\dot{x} = A x + B u$\n$y = C x + D u$', ...C(330, 305, 230, 74), ...FORMULA });
  return t.done();
}

/** Model predictive control: ottimizzatore con modello di predizione, stimatore e orizzonte mobile. */
function mpc() {
  const t = new Builder();
  t.group('MPC controller', 90, -4, 340, 210, { textColor: MUTED });
  const r = sig(t, '$r_k$', 30, 66, 36);
  const opt = block(t, 'Optimizer', 260, 70, 310, 80, YELLOW, {
    bold: true,
    fontSize: 11,
    sublabel: '$\\min_{u} \\sum_{i=1}^{N_p} \\|\\hat{y}_{k+i} - r_{k+i}\\|_Q^2 + \\|\\Delta u_{k+i}\\|_R^2$\n$\\mathrm{s.t.}\\ u \\in \\mathcal{U},\\ x \\in \\mathcal{X}$',
    subSize: 12,
  });
  const model = block(t, 'Prediction model', 260, 168, 210, 44, BLUE, { fontSize: 11, sublabel: '$\\hat{x}_{k+i+1} = f(\\hat{x}_{k+i}, u_{k+i})$', subSize: 12 });
  const plant = block(t, 'Plant', 560, 70, 110, 54, GREEN, { fontSize: 13 });
  const est = block(t, 'State estimator', 560, 168, 130, 48, PURPLE, { fontSize: 11, sublabel: '$\\hat{x}_k$', subSize: 13 });
  const yout = sig(t, '$y_k$', 680, 70, 30);
  t.link(r, opt);
  t.link(model, opt, 'top', 'bottom', { arrowStart: true, label: '$\\hat{y}(u)$', labelPos: 'below', fontSize: 11 });
  t.link(opt, plant, 'right', 'left', { label: '$u_k^*$', ...LAB });
  t.link(plant, yout);
  t.link(plant, est, 'bottom', 'top', { label: '$y_k$', labelPos: 'below', fontSize: 11 });
  t.link(est, model, 'left', 'right');
  t.add({ shape: 'rob-horizon', spec: 'labels', label: 'Receding horizon: apply only $u_k^*$, then re-solve at the next step', ...C(330, 320, 320, 180), fill: 'none', stroke: '#3A3F47', strokeWidth: 1.2, ...ICON, fontSize: 11 });
  return t.done();
}

/** Visual servoing basato su immagine (IBVS, Chaumette & Hutchinson 2006): errore sulle feature. */
function visualServo() {
  const t = new Builder();
  const Y = 110;
  const sstar = sig(t, '$s^*$', 24, Y, 30, 22, { fontSize: 14 });
  const s1 = junction(t, 85, Y);
  const law = block(t, '$v_c = -\\lambda \\hat{L}_s^{+} e$', 280, Y, 170, 58, ORANGE, { fontSize: 15, sublabel: 'IBVS control law', subSize: 11 });
  const robot = draw(t, 'rob-arm', 'reach parallel', 'Robot (eye-in-hand camera)', 475, Y - 4, 116, 92, BLUE);
  const img = view(t, 'real', 'Camera image $I(t)$', 650, Y, 104, 78);
  const feat = block(t, 'Feature extraction', 650, Y + 135, 140, 44, PURPLE, { fontSize: 12 });
  const plane = draw(t, 'rob-imgplane', 'traj labels', 'Current $s$ and desired $s^*$ features', 850, Y + 30, 140, 112, { fill: '#FFFFFF', stroke: '#9AA0A6' }, { radius: 2 });
  t.link(sstar, s1);
  t.link(s1, law, 'right', 'left', { label: '$e = s - s^*$', ...LAB });
  t.link(law, robot, 'right', 'left', { label: '$v_c$', ...LAB });
  t.link(robot, img);
  t.link(img, feat, 'bottom', 'top');
  t.link(feat, s1, 'left', 'bottom', { label: '$s(t)$', labelPos: 'below', fontSize: 12 });
  t.link(feat, plane, 'right', 'left', { dashed: true, arrowEnd: false, color: SOFT, width: 1 });
  sign(t, '-', 65, Y - 12);
  sign(t, '+', 73, Y + 25);
  t.add({ label: 'Interaction matrix', sublabel: '$\\dot{s} = L_s v_c \\;\\Rightarrow\\; \\dot{e} = -\\lambda e$', ...C(280, 18, 230, 56), ...FORMULA, subSize: 12 });
  return t.done();
}

/** Teleoperazione bilaterale: master aptico, canale con ritardo T, slave a contatto con l'ambiente. */
function teleop() {
  const t = new Builder();
  const Y = 120;
  panel(t, 'Local site', 0, -14, 250, 252);
  panel(t, 'Communication channel', 284, -14, 182, 252);
  panel(t, 'Remote site', 500, -14, 290, 252);
  const op = ico(t, 'user', 'Operator', 48, Y, 40, 46, GREEN, { fontSize: 11 });
  const master = draw(t, 'rob-arm', 'reach notool', 'Master (haptic device)', 170, Y, 104, 84, BLUE, { count: 2, labelPos: 'above' });
  const fwd = block(t, '$e^{-sT}$', 375, Y - 75, 66, 38, WHITE, { fontSize: 14 });
  const bwd = block(t, '$e^{-sT}$', 375, Y + 75, 66, 38, WHITE, { fontSize: 14 });
  const slave = draw(t, 'rob-arm', 'reach parallel', 'Slave robot', 610, Y, 116, 92, GRAY, { labelPos: 'above' });
  const env = block(t, 'Environment', 734, Y, 84, 96, GREEN, { fontSize: 10.5 });
  t.link(op, master, 'right', 'left', { arrowStart: true, label: '$F_h$', ...LAB });
  t.link(master, fwd, 'right', 'left', { label: '$x_m$', ...LAB });
  t.link(fwd, slave, 'right', 'left', { label: '$x_m(t - T)$', ...LAB });
  t.link(slave, env, 'right', 'left', { arrowStart: true });
  t.link(slave, bwd, 'bottom', 'right', { label: '$F_e$', labelPos: 'below', fontSize: 12 });
  t.link(bwd, master, 'left', 'bottom', { label: '$F_e(t - T)$', labelPos: 'below', fontSize: 12 });
  sig(t, 'position command', 375, Y - 102, 120, 16, { fontSize: 10, textColor: MUTED });
  sig(t, 'force feedback', 375, Y + 102, 120, 16, { fontSize: 10, textColor: MUTED });
  return t.done();
}

// ======================================================================
// Architetture e stima
// ======================================================================

/** Paradigma sense-plan-act: sensori, percezione e mappa, pianificazione, controllo e attuatori. */
function senseplanact() {
  const t = new Builder();
  const Y1 = 70, Y2 = 180;
  const head = (c: string) => ({ textColor: c, stroke: c, fill: '#FBFCFD' });
  panel(t, 'Sense', 0, 0, 200, 250, head('#3E7CB1'));
  panel(t, 'Plan', 230, 0, 330, 250, head('#7E57C2'));
  panel(t, 'Act', 590, 0, 190, 250, head('#C77700'));
  const cam = draw(t, 'rob-camera', 'rgbd', 'RGB-D camera', 100, Y1, 104, 38, GRAY);
  const lidar = draw(t, 'rob-lidar', '', 'Lidar scan', 100, Y2 - 6, 120, 78, { fill: '#FFFFFF', stroke: '#C0392B' }, { count: 48, labelPos: 'above' });
  const perc = block(t, 'Perception &\nlocalization', 320, Y1, 140, 48, PURPLE, { fontSize: 11 });
  const map = draw(t, 'rob-occgrid', '16x12 robot', 'World model', 320, Y2 - 6, 112, 84, { fill: '#FFFFFF', stroke: MUTED });
  const plan = block(t, 'Planner', 490, 125, 100, 50, YELLOW, { fontSize: 12, sublabel: 'path $\\tau$', subSize: 11 });
  const ctrl = block(t, 'Motion control', 670, Y1, 130, 48, ORANGE, { fontSize: 11, sublabel: '$u = \\kappa(\\hat{x}, \\tau)$', subSize: 12 });
  const robot = draw(t, 'rob-mobile', 'round sensor', '', 670, Y2 - 6, 64, 64, BLUE);
  t.text('Actuators', 708, Y2 - 14, 64, 16, { fontSize: 11, align: 'left' });
  block(t, 'Environment', 390, 310, 780, 40, GREEN, { fontSize: 13, bold: true });
  t.link(cam, perc);
  t.link(lidar, map);
  t.link(perc, map, 'bottom', 'top', { label: 'state $\\hat{x}$', labelPos: 'below', fontSize: 11 });
  t.link(perc, plan, 'right', 'top', { label: 'goal', labelPos: 'above', fontSize: 11 });
  t.link(map, plan, 'right', 'left');
  t.link(plan, ctrl, 'right', 'left');
  t.link(ctrl, robot, 'bottom', 'top', { label: 'commands', labelPos: 'above', fontSize: 11 });
  t.link(robot, at(t, 670, 290), 'bottom', 'top');
  t.link(at(t, 100, 290), lidar, 'top', 'bottom');
  t.text('act', 677, 262, 40, 16, { fontSize: 11, align: 'left', textColor: MUTED });
  t.text('observe', 107, 262, 60, 16, { fontSize: 11, align: 'left', textColor: MUTED });
  return t.done();
}

/** Cadena et al. 2016 (arXiv 1606.05830), Fig. 2: front-end e back-end di un sistema SLAM. */
function slam() {
  const t = new Builder();
  const Y = 115;
  const FB = '#2B59C3';
  t.text('Sensor data', 0, 4, 100, 20, { fontSize: 12, bold: true });
  const cam = draw(t, 'rob-camera', 'rgbd', 'Camera', 50, 72, 92, 34, GRAY);
  const imu = draw(t, 'rob-frame', '3d', 'IMU', 50, 160, 64, 56, { fill: 'none', stroke: '#3A3F47' });
  const fe = t.group('Front-end', 135, 20, 250, 190, { dashed: false, stroke: '#D64545', textColor: '#C0392B', fill: '#FFF8F7', bold: true, fontSize: 13 });
  const feat = block(t, 'Feature extraction', 260, 72, 210, 38, RED, { fontSize: 12 });
  const assoc = block(t, 'Data association', 260, 160, 210, 66, RED, { fontSize: 12, sublabel: 'short-term: feature tracking\nlong-term: loop closure', subSize: 11 });
  const be = t.group('Back-end', 435, 20, 160, 190, { dashed: false, stroke: '#2E8B57', textColor: '#2E7D4F', fill: '#F5FAF6', bold: true, fontSize: 13 });
  block(t, 'MAP estimation', 515, Y + 6, 128, 84, GREEN, { fontSize: 12, sublabel: 'factor-graph\noptimization', subSize: 11 });
  const est = draw(t, 'rob-posegraph', 'landmarks', 'SLAM estimate', 730, Y, 160, 116, BLUE, { count: 14 });
  t.link(cam, feat);
  t.link(imu, assoc);
  t.link(feat, assoc, 'bottom', 'top');
  t.link(fe, be, 'right', 'left', { color: FB, width: 2.2 });
  t.link(be, est, 'right', 'left', { color: FB, width: 2.2 });
  t.link(be, fe, 'bottom', 'bottom', { color: FB, width: 1.6, offset: 6, label: 'feedback for loop-closure detection and verification', labelPos: 'below', fontSize: 11 });
  t.add({ label: 'Maximum a posteriori estimate', sublabel: '$\\mathcal{X}^* = \\arg\\min_{\\mathcal{X}} \\sum_k \\|h_k(\\mathcal{X}_k) - z_k\\|_{\\Omega_k}^2$', ...C(365, 300, 330, 64), ...FORMULA });
  return t.done();
}

/** Grafo dei nodi ROS (stile rqt_graph): nodi ellittici, topic rettangolari, publish/subscribe. */
function rosGraph() {
  const t = new Builder();
  const node = (label: string, cx: number, cy: number, w = 140) => t.add({ shape: 'ellipse', label, ...C(cx, cy, w, 40), fontSize: 11, strokeWidth: 1.2, ...WHITE });
  const topic = (label: string, cx: number, cy: number, w = 100) => t.box(label, cx - w / 2, cy - 14, w, 28, { fill: '#EEF3FA', stroke: '#6C8EBF' }, { radius: 2, fontSize: 11 });
  const camN = node('/camera_driver', 80, 50);
  const img = topic('/camera/image_raw', 250, 50, 136);
  const det = node('/object_detector', 425, 50, 144);
  const dets = topic('/detections', 590, 50, 96);
  const lidN = node('/lidar_driver', 80, 150);
  const scan = topic('/scan', 250, 150, 70);
  const slamN = node('/slam_toolbox', 425, 150, 136);
  const map = topic('/map', 590, 150, 64);
  const nav = node('/move_base', 750, 100, 124);
  const cmd = topic('/cmd_vel', 750, 180, 82);
  const base = node('/base_controller', 750, 260, 150);
  const odom = topic('/odom', 590, 260, 70);
  const robot = draw(t, 'rob-mobile', 'round sensor', 'Robot base', 905, 260, 56, 56, BLUE);
  t.chain([camN, img, det, dets]);
  t.chain([lidN, scan, slamN, map]);
  t.link(dets, nav, 'right', 'top');
  t.link(map, nav);
  t.link(nav, cmd, 'bottom', 'top');
  t.link(cmd, base, 'bottom', 'top');
  t.link(base, odom, 'left', 'right');
  t.link(odom, slamN, 'left', 'bottom');
  t.link(base, robot, 'right', 'left', { arrowStart: true, dashed: true, color: SOFT });
  // legenda
  t.add({ shape: 'ellipse', ...C(30, 222, 44, 22), strokeWidth: 1.2, ...WHITE });
  t.text('node', 60, 214, 60, 16, { fontSize: 11, align: 'left' });
  t.add({ ...C(30, 252, 44, 18), radius: 2, strokeWidth: 1.2, fill: '#EEF3FA', stroke: '#6C8EBF' });
  t.text('topic', 60, 244, 60, 16, { fontSize: 11, align: 'left' });
  free(t, 8, 280, 52, 280, { color: '#4B5563', width: 1.2 });
  t.text('publish / subscribe', 60, 272, 120, 16, { fontSize: 11, align: 'left' });
  return t.done();
}

// ======================================================================
// Cinematica e pianificazione
// ======================================================================

/** Cinematica diretta e inversa di un braccio planare 3R con i parametri di Denavit-Hartenberg. */
function kinematics() {
  const t = new Builder();
  t.text('Planar 3R manipulator', 20, -6, 200, 20, { fontSize: 12, bold: true });
  draw(t, 'rob-arm', 'reach parallel frames angles', '', 120, 112, 230, 196, BLUE, { count: 3 });
  // tabella DH
  const x0 = 300, y0 = 40, cw = 46, ch = 26;
  t.text('Denavit-Hartenberg parameters', x0 - 10, y0 - 34, 250, 20, { fontSize: 12, bold: true });
  const rows = [
    ['$i$', '$\\theta_i$', '$d_i$', '$a_i$', '$\\alpha_i$'],
    ['1', '$\\theta_1$', '0', '$l_1$', '0'],
    ['2', '$\\theta_2$', '0', '$l_2$', '0'],
    ['3', '$\\theta_3$', '0', '$l_3$', '0'],
  ];
  rows.forEach((row, r) =>
    row.forEach((v, c) => {
      const col = r === 0 ? { fill: '#E9ECF1', stroke: '#9AA0A6' } : c === 1 ? { fill: '#FFF2CC', stroke: '#9AA0A6' } : { fill: '#FFFFFF', stroke: '#9AA0A6' };
      t.add({ label: v, x: x0 + c * cw, y: y0 + r * ch, w: cw, h: ch, radius: 0, strokeWidth: 1, fontSize: 12, ...col });
    }),
  );
  sig(t, 'joint variables', x0 + 1.5 * cw, y0 + 4 * ch + 10, 90, 16, { fontSize: 10, textColor: '#8A6D1F' });
  t.add({
    label: 'Forward kinematics (homogeneous transforms)',
    sublabel: '${}^{0}T_{3} = A_1(\\theta_1)\\, A_2(\\theta_2)\\, A_3(\\theta_3)$\n$A_i = \\mathrm{Rot}_z(\\theta_i)\\, \\mathrm{Trans}_z(d_i)\\, \\mathrm{Trans}_x(a_i)\\, \\mathrm{Rot}_x(\\alpha_i)$',
    ...C(415, 200, 330, 80),
    ...FORMULA,
    subSize: 12,
  });
  const js = block(t, 'Joint space', 130, 318, 170, 56, BLUE, { fontSize: 12, bold: true, sublabel: '$q = (\\theta_1, \\theta_2, \\theta_3)$', subSize: 13 });
  const ts = block(t, 'Task space', 520, 318, 170, 56, GREEN, { fontSize: 12, bold: true, sublabel: '$x = (p_x, p_y, \\phi)$', subSize: 13 });
  t.link(js, ts, 'top', 'top', { label: 'Forward kinematics  $x = f(q)$', ...LAB, fontSize: 11 });
  t.link(ts, js, 'bottom', 'bottom', { dashed: true, label: 'Inverse kinematics  $q = f^{-1}(x)$', labelPos: 'below', fontSize: 11 });
  sig(t, '$\\dot{x} = J(q) \\dot{q}$', 325, 318, 120, 24, { fontSize: 13 });
  return t.done();
}

/** RRT (LaValle 1998): albero nello spazio delle configurazioni e passo di estensione. */
function rrt() {
  const t = new Builder();
  draw(t, 'rob-rrt', 'labels', 'Rapidly-exploring random tree in $\\mathcal{C}$', 160, 120, 310, 230, { fill: '#FFFFFF', stroke: ROB_BLUE }, { count: 500, radius: 3 });
  panel(t, 'Extend step', 345, 5, 270, 230, { bold: true });
  const pt = (cx: number, cy: number, c = '#4A6FA5', r = 7) => t.add({ shape: 'ellipse', ...C(cx, cy, r, r), fill: c, stroke: c, strokeWidth: 1 });
  const P: [number, number][] = [[372, 210], [418, 178], [395, 128], [458, 138], [482, 205], [372, 92]];
  const nodes = P.map(([x, y]) => pt(x, y));
  const tree = { arrowEnd: false, routing: 'straight' as const, color: '#7A9CC6', width: 1.2 };
  [[0, 1], [1, 2], [1, 3], [1, 4], [2, 5]].forEach(([a, b]) => t.link(nodes[a], nodes[b], 'auto', 'auto', tree));
  t.add({ ...C(560, 168, 64, 56), radius: 6, fill: '#C9CDD3', stroke: '#9AA0A6', strokeWidth: 1 });
  const near = t.add({ shape: 'ellipse', ...C(458, 138, 13, 13), fill: 'none', stroke: ROB_BLUE, strokeWidth: 1.4 });
  const rand = t.add({ shape: 'ellipse', ...C(585, 58, 10, 10), fill: '#FFFFFF', stroke: INK, strokeWidth: 1.2 });
  const xnew = pt(505, 108, '#D9822B', 9);
  t.link(near, rand, 'auto', 'auto', { routing: 'straight', dashed: true, arrowEnd: false, color: SOFT, width: 1 });
  t.link(nodes[3], xnew, 'auto', 'auto', { routing: 'straight', color: '#D9822B', width: 1.6 });
  sig(t, '$x_{\\mathrm{near}}$', 452, 160, 50, 18, { fontSize: 12 });
  sig(t, '$x_{\\mathrm{rand}}$', 585, 80, 50, 18, { fontSize: 12 });
  sig(t, '$x_{\\mathrm{new}}$', 532, 124, 50, 18, { fontSize: 12, textColor: '#A05A12' });
  sig(t, '$\\eta$', 474, 112, 16, 16, { fontSize: 12 });
  sig(t, '$\\mathcal{C}_{\\mathrm{obs}}$', 560, 168, 44, 18, { fontSize: 12, textColor: MUTED });
  t.add({
    label: 'One RRT iteration',
    sublabel:
      '$x_{\\mathrm{rand}} \\leftarrow \\mathrm{Sample}(\\mathcal{C}_{\\mathrm{free}})$\n$x_{\\mathrm{near}} \\leftarrow \\mathrm{Nearest}(T, x_{\\mathrm{rand}})$\n$x_{\\mathrm{new}} \\leftarrow \\mathrm{Steer}(x_{\\mathrm{near}}, x_{\\mathrm{rand}}, \\eta)$\nif CollisionFree$(x_{\\mathrm{near}}, x_{\\mathrm{new}})$: add $x_{\\mathrm{new}}$ to $T$',
    ...C(480, 296, 280, 96),
    align: 'left',
    radius: 6,
    fontSize: 11,
    bold: true,
    subSize: 12,
    textColor: '#333333',
    fill: '#FAFAFB',
    stroke: '#B8BEC8',
    strokeWidth: 1.2,
  });
  return t.done();
}

// ======================================================================
// Robot learning
// ======================================================================

/** Behavior cloning con DAgger (Ross et al. 2011, arXiv 1011.0686): dimostrazioni, policy, aggregazione. */
function behaviorCloning() {
  const t = new Builder();
  const Y = 80;
  const expert = ico(t, 'user', 'Expert', 24, Y, 40, 46, GREEN, { fontSize: 11 });
  const demo = draw(t, 'rob-arm', 'reach parallel', 'Robot', 150, Y, 100, 80, BLUE);
  const data = t.add({ shape: 'cylinder', label: 'Demonstrations', sublabel: '$\\mathcal{D} = \\{(o_i, a_i^*)\\}$', subSize: 13, ...C(330, Y, 140, 76), fontSize: 11, bold: true, strokeWidth: 1.2, ...GRAY });
  const pol = block(t, '$\\pi_\\theta(a \\mid o)$', 545, Y, 140, 60, ORANGE, { fontSize: 15, sublabel: 'Policy network', subSize: 11 });
  const roll = view(t, 'real gripper', 'Rollout of $\\pi_\\theta$', 730, Y, 110, 82);
  const loss = t.add({ label: 'Behavior cloning loss', sublabel: '$\\min_\\theta \\mathbb{E}_{(o, a^*) \\sim \\mathcal{D}} \\|\\pi_\\theta(o) - a^*\\|^2$', ...C(545, 190, 250, 66), ...FORMULA, subSize: 12 });
  const relabel = block(t, 'Expert relabels visited states', 790, 190, 190, 56, YELLOW, { fontSize: 11, sublabel: '$a^* = \\pi^*(o_t)$', subSize: 13 });
  t.link(expert, demo, 'right', 'left', { label: 'teleop', ...LAB, fontSize: 11 });
  t.link(demo, data, 'right', 'left', { label: 'record', ...LAB, fontSize: 11 });
  t.link(data, pol, 'right', 'left', { label: 'supervised', ...LAB, fontSize: 11 });
  t.link(pol, roll, 'right', 'left', { label: '$a_t$', ...LAB });
  t.link(loss, pol, 'top', 'bottom', { dashed: true, color: SOFT, width: 1 });
  t.link(roll, relabel, 'bottom', 'top', { dashed: true, color: '#C77700' });
  t.link(relabel, data, 'bottom', 'bottom', { dashed: true, color: '#C77700', offset: 14, label: 'DAgger: aggregate  $\\mathcal{D} \\leftarrow \\mathcal{D} \\cup \\mathcal{D}_{\\pi}$', labelPos: 'below', fontSize: 11 });
  return t.done();
}

/** Chi et al. 2023 (arXiv 2303.04137), Fig. 2a: Diffusion Policy, orizzonti di osservazione e di azione. */
function diffusionPolicy() {
  const t = new Builder();
  const YO = 46, YP = 116, YA = 186;
  const cw = 36;
  const X0 = 300;
  t.text('Input: observation sequence', 0, -6, 200, 18, { fontSize: 11, bold: true });
  view(t, 'pusht', '', 66, 82, 88, 88, { count: 1 });
  view(t, 'pusht', '', 92, 104, 88, 88, { count: 2 });
  t.add({ shape: 'cells', label: 'Robot pose', ...C(165, 104, 26, 70), count: 4, radius: 3, strokeWidth: 1.2, ...ICON, fontSize: 10, ...BLUE });
  // asse delle osservazioni
  free(t, 262, YO, 650, YO, { color: INK, width: 1.2 });
  const obs = ['$o_{t-2}$', '$o_{t-1}$', '$o_t$'].map((l, i) => t.box(l, X0 - cw / 2 + i * cw, YO - 14, cw, 28, { fill: '#BFC4CC', stroke: '#6B7280' }, { radius: 0, fontSize: 11, strokeWidth: 1 }));
  t.add({ shape: 'brace', direction: 'top', ...C(X0 + cw, YO - 22, cw * 3, 10), fill: 'none', stroke: MUTED, strokeWidth: 1.2 });
  sig(t, 'Observation $O_t$', X0 + cw, YO - 38, 130, 18, { fontSize: 12 });
  // policy con denoising iterativo
  const noise = t.add({ shape: 'heatmap', spec: '8x8', label: '$A_t^K \\sim \\mathcal{N}(0, I)$', ...C(232, YP, 40, 40), ...ICON, fontSize: 11, ...GRAY });
  const pol = t.box('Diffusion Policy  $\\varepsilon_\\theta(O_t, A_t^k, k)$', 290, YP - 22, 300, 44, { fill: '#F2F2F2', stroke: '#666666' }, { radius: 4, fontSize: 13 });
  t.add({ shape: 'cycle', label: '$\\times K$', ...C(622, YP, 42, 42), fill: 'none', stroke: MUTED, fontSize: 12 });
  t.link(noise, pol);
  t.link(obs[2], at(t, X0 + 2 * cw, YP - 22), 'bottom', 'top');
  // sequenza di azioni: orizzonte di predizione T_p, azioni eseguite T_a
  free(t, 262, YA, 650, YA, { color: INK, width: 1.2 });
  const acts: N[] = [];
  for (let i = 0; i < 8; i++) {
    const exec = i >= 2 && i < 6;
    const lab = exec ? ['$a_t$', '$a_{t+1}$', '$a_{t+2}$', '$a_{t+3}$'][i - 2] : '';
    acts.push(t.box(lab, X0 - cw / 2 + i * cw, YA - 14, cw, 28, exec ? { fill: '#8DB2EC', stroke: '#3B6FB6' } : { fill: '#DCE6F7', stroke: '#8FA8CF' }, { radius: 0, fontSize: 10, strokeWidth: 1 }));
  }
  t.link(at(t, X0 + 2 * cw, YP + 22), acts[2], 'bottom', 'top', { label: '$A_t^0$', labelPos: 'below', fontSize: 11 });
  const dim = { arrowStart: true, color: MUTED, width: 1, fontSize: 11, labelPos: 'below' as const };
  free(t, X0 + 2 * cw - cw / 2, YA + 26, X0 + 6 * cw - cw / 2, YA + 26, { ...dim, label: 'Action execution horizon $T_a$' });
  free(t, X0 - cw / 2, YA + 62, X0 + 8 * cw - cw / 2, YA + 62, { ...dim, label: 'Prediction horizon $T_p$' });
  // a destra: denoising della sequenza di azioni (K → 0)
  t.text('Output: action sequence', 690, -6, 190, 18, { fontSize: 11, bold: true });
  const steps: [string, string][] = [['noise', '$A_t^K$'], ['noise half', '$A_t^{k}$'], ['dots', '$A_t^0$']];
  const frames = steps.map(([, l], i) => t.box('', 720, 18 + i * 92, 130, 66, WHITE, { radius: 4, stroke: '#C9CED6', strokeWidth: 1, label: l, labelPos: 'center', align: 'right', fontSize: 12 }));
  steps.forEach(([spec], i) => t.add({ shape: 'rob-path', spec, count: i === 1 ? 10 : 14, ...C(775, 51 + i * 92, 100, 58), fill: 'none', stroke: ROB_BLUE, strokeWidth: 1.2 }));
  frames.slice(1).forEach((f, i) => t.link(frames[i], f, 'bottom', 'top', { label: 'denoise', labelPos: 'below', fontSize: 10 }));
  return t.done();
}

/** Brohan et al. 2023 (arXiv 2307.15818), Fig. 1: RT-2, modello visione-linguaggio-azione. */
function rt2() {
  const t = new Builder();
  const VQA = { fill: '#E6E0F4', stroke: '#7C6BB0' };
  panel(t, 'Internet-scale VQA + robot action data', 0, 0, 290, 330);
  t.add({ ...C(145, 105, 266, 120), radius: 8, fill: '#FFFFFF', stroke: '#C9CED6', strokeWidth: 1, container: true });
  ico(t, 'image', '', 62, 98, 76, 60, BLUE);
  t.text('Q: What is happening\nin the image?', 120, 62, 150, 32, { fontSize: 10.5, align: 'left' });
  block(t, 'A grey donkey walks\ndown the street.', 195, 130, 140, 38, VQA, { fontSize: 10 });
  t.add({ ...C(145, 248, 266, 136), radius: 8, fill: '#FFFFFF', stroke: '#C9CED6', strokeWidth: 1, container: true });
  view(t, 'real gripper', '', 60, 238, 80, 64);
  t.text('Q: What should the robot\ndo to $\\langle$task$\\rangle$?', 120, 194, 150, 32, { fontSize: 10.5, align: 'left' });
  block(t, '$\\Delta$Translation = [0.1, -0.2, 0]\n$\\Delta$Rotation = [$10^\\circ$, $25^\\circ$, $-7^\\circ$]', 200, 272, 150, 44, VQA, { fontSize: 9.5 });
  // modello VLA
  panel(t, 'Vision-Language-Action model (RT-2)', 320, 0, 450, 330);
  t.text('Q: What should the robot\ndo to $\\langle$task$\\rangle$? A: ...', 330, 34, 150, 30, { fontSize: 10, align: 'left' });
  for (let i = 0; i < 6; i++) pill(t, 345 + i * 22, 82, ORANGE, 18);
  const patches = ico(t, 'patches', 'Image', 372, 150, 64, 64, BLUE, { spec: '3x3', fontSize: 10 });
  const vit = block(t, 'ViT', 470, 150, 56, 56, { fill: '#DCE3FA', stroke: '#6C7FD0' }, { fontSize: 14, bold: true, textColor: '#4A5BB0' });
  t.add({ label: 'Large Language Model', ...C(650, 110, 210, 170), radius: 10, fill: '#FFF4E8', stroke: '#E8A65A', strokeWidth: 1.2, container: true, bold: true, fontSize: 12, textColor: '#C26A16' });
  [BLUE, BLUE, BLUE, ORANGE, ORANGE, ORANGE, ORANGE, ORANGE].forEach((c, i) => pill(t, 573 + i * 22, 66, c, 18));
  const tf = block(t, 'Transformer', 650, 112, 180, 30, ORANGE, { fontSize: 11 });
  [GRAY, GRAY, GRAY, GRAY, GRAY, PURPLE, PURPLE, PURPLE].forEach((c, i) => pill(t, 573 + i * 22, 162, c, 18));
  t.link(patches, vit);
  t.link(vit, at(t, 544, 150), 'right', 'left', { color: SOFT, width: 1.2 });
  t.link(at(t, 476, 82), at(t, 544, 82), 'right', 'left', { color: SOFT, width: 1.2 });
  t.link(at(t, 650, 72), tf, 'bottom', 'top', { color: '#C26A16', width: 1 });
  t.link(tf, at(t, 650, 156), 'bottom', 'top', { color: '#C26A16', width: 1 });
  t.add({ shape: 'brace', direction: 'bottom', ...C(705, 174, 66, 10), fill: 'none', stroke: '#7C6BB0', strokeWidth: 1.2 });
  const ans = block(t, 'A: 132 114 128 5 25 156', 470, 268, 160, 26, VQA, { fontSize: 10 });
  const act = block(t, '$\\Delta T = [0.1, -0.2, 0]$\n$\\Delta R = [10^\\circ, 25^\\circ, -7^\\circ]$', 680, 268, 140, 44, VQA, { fontSize: 10, sublabel: 'Robot action', subSize: 10 });
  t.link(at(t, 705, 182), ans, 'bottom', 'top', { color: '#7C6BB0' });
  t.link(ans, act, 'right', 'left', { color: '#7C6BB0', label: 'De-tokenize', labelPos: 'above', fontSize: 10 });
  // controllo ad anello chiuso
  panel(t, 'Closed-loop robot control', 800, 0, 180, 330);
  const arm = draw(t, 'rob-arm', 'reach parallel', '', 890, 105, 130, 104, GRAY);
  const cam = view(t, 'real', '', 890, 255, 110, 72, { labelPos: 'below', bold: false, label: 'New observation' });
  t.link(arm, cam, 'bottom', 'top', { label: 'execute $\\Delta T, \\Delta R$', labelPos: 'below', fontSize: 10 });
  t.link(at(t, 230, 330), at(t, 400, 330), 'bottom', 'bottom', { color: '#7A808A', width: 1.6, offset: 10, label: 'Co-fine-tune', labelPos: 'below', fontSize: 12 });
  t.link(at(t, 700, 330), at(t, 860, 330), 'bottom', 'bottom', { color: '#7A808A', width: 1.6, offset: 10, label: 'Deploy', labelPos: 'below', fontSize: 12 });
  return t.done();
}

/** Tobin et al. 2017 (arXiv 1703.06907), Fig. 1-2: domain randomization e trasferimento sim-to-real. */
function sim2real() {
  const t = new Builder();
  t.box('Training (simulation)', 0, 0, 232, 24, { fill: '#465870', stroke: '#465870' }, { radius: 2, textColor: '#FFFFFF', bold: true, fontSize: 12 });
  for (let i = 0; i < 6; i++) view(t, 'random', '', 37 + (i % 3) * 78, 64 + Math.floor(i / 3) * 62, 72, 56, { count: i + 1, w: 72, h: 56 });
  sig(t, '$\\cdots$', 116, 166, 40, 16, { fontSize: 16, textColor: '#465870' });
  t.text('Randomized: textures, colors, lighting,\ncamera pose, distractor objects', 0, 180, 232, 32, { fontSize: 10, textColor: MUTED });
  const cnn = ico(t, 'cnn', 'Deep CNN (VGG-16)', 370, 93, 160, 86, ORANGE, { count: 3, fontSize: 11, labelPos: 'above' });
  const xyz = sig(t, '$(x, y, z)$', 512, 93, 56, 22, { fontSize: 13 });
  const arm = draw(t, 'rob-arm', 'down parallel', 'Grasp in the real world', 660, 92, 112, 96, GRAY, { count: 3 });
  t.link(at(t, 234, 93), cnn, 'right', 'left', { label: 'train', ...LAB, fontSize: 11 });
  t.link(cnn, xyz);
  t.link(xyz, arm);
  const test = t.box('Test (real world)', 310, 186, 120, 22, { fill: '#E8803A', stroke: '#E8803A' }, { radius: 2, textColor: '#FFFFFF', bold: true, fontSize: 11 });
  view(t, 'real', '', 370, 250, 112, 80);
  t.link(test, cnn, 'top', 'bottom', { dashed: true, label: 'zero-shot transfer', labelPos: 'below', fontSize: 11 });
  return t.done();
}

/** Jain et al. 2019 (arXiv 1905.08926), Fig. 2-3: politica gerarchica per la locomozione di un quadrupede. */
function hierarchicalLocomotion() {
  const t = new Builder();
  const X = 190;
  t.group('High-level', 0, 0, 480, 96, { fill: '#EAF2FB', stroke: '#6C8EBF', textColor: '#3E5F8A' });
  t.group('Low-level', 0, 182, 480, 110, { fill: '#EDF6EC', stroke: '#82B366', textColor: '#4E7A3A' });
  t.group('Hardware', 0, 306, 480, 124, { fill: 'none', stroke: '#333333', textColor: '#333333' });
  const hl = block(t, 'High-level policy network', X, 52, 220, 44, YELLOW, { fontSize: 12, sublabel: '$\\pi_{\\phi_h}(\\mathbf{o}_h)$', subSize: 12, radius: 8 });
  const hold = t.box('hold for duration $d$ timesteps', X - 120, 127, 240, 26, { fill: '#FFFCD9', stroke: '#C9B458' }, { radius: 2, fontSize: 11 });
  const ll = block(t, 'Low-level policy network', X, 242, 220, 44, YELLOW, { fontSize: 12, sublabel: '$\\pi_{\\phi_l}(\\mathbf{o}_l, \\mathbf{l})$', subSize: 12, radius: 8 });
  const robot = draw(t, 'rob-quadruped', 'stand', 'Robot', X, 366, 112, 72, ORANGE);
  t.link(hl, hold, 'bottom', 'top');
  t.link(hold, ll, 'bottom', 'top');
  t.link(ll, robot, 'bottom', 'top');
  const note = (s: string, y: number) => t.text(s, X + 7, y - 8, 200, 16, { fontSize: 11, align: 'left', italic: true, textColor: '#333333' });
  note('latent command $\\mathbf{l}$, duration $d$', 111);
  note('$\\mathbf{l}$', 168);
  note('motor commands $\\mathbf{a}$', 282);
  t.link(robot, ll, 'right', 'right', { label: '$\\mathbf{o}_l$', labelPos: 'below', fontSize: 12 });
  t.link(robot, hl, 'right', 'right', { offset: 70, label: '$\\mathbf{o}_h$', labelPos: 'below', fontSize: 12 });
  // linea del tempo (Fig. 3)
  const tx = 600, te = 960;
  t.text('High-level', tx - 92, 48, 84, 16, { fontSize: 11, align: 'right' });
  t.text('Low-level', tx - 92, 152, 84, 16, { fontSize: 11, align: 'right' });
  t.text('Hardware', tx - 92, 238, 84, 16, { fontSize: 11, align: 'right' });
  t.add({ ...C((tx + te) / 2, 160, te - tx, 24), radius: 0, fill: '#EDF6EC', stroke: '#82B366', strokeWidth: 1, dashed: true });
  t.add({ ...C((tx + te) / 2, 246, te - tx, 26), radius: 0, fill: 'none', stroke: '#333333', strokeWidth: 1, dashed: true });
  const hbox = (cx: number) => t.add({ ...C(cx, 56, 48, 24), radius: 2, fill: '#EAF2FB', stroke: '#6C8EBF', strokeWidth: 1, dashed: true });
  const steps = [630, 676, 806, 852];
  const ticks: [string, number][] = [['$t$', 630], ['$t+1$', 676], ['$\\cdots$', 741], ['$t+d$', 806], ['$t+d+1$', 852]];
  const v = { routing: 'straight' as const, color: INK, width: 1 };
  [630, 806].forEach((cx, i) => {
    const b = hbox(cx + 6);
    t.link(b, at(t, cx + 6, 147), 'bottom', 'top', { ...v, label: i ? '' : '$d, \\mathbf{l}$', labelPos: 'below', fontSize: 11 });
  });
  for (const s of steps) {
    t.link(at(t, s - 6, 173), at(t, s - 6, 232), 'bottom', 'top', v);
    t.link(at(t, s + 6, 232), at(t, s + 6, 173), 'top', 'bottom', v);
  }
  sig(t, '$\\cdots$', 741, 202, 30, 16, { fontSize: 14 });
  sig(t, '$\\mathbf{a}$', 610, 202, 14, 16, { fontSize: 11 });
  sig(t, '$\\mathbf{o}_l$', 698, 202, 18, 16, { fontSize: 11 });
  t.link(at(t, 770, 232), at(t, 830, 56), 'top', 'left', { ...v, routing: 'ortho', label: '$\\mathbf{o}_h$', labelPos: 'above', fontSize: 11 });
  free(t, tx, 284, te, 284, { color: INK, width: 1.2 });
  t.text('time', tx - 50, 276, 40, 16, { fontSize: 11, italic: true, align: 'right' });
  ticks.forEach(([l, x]) => sig(t, l, x, 300, 50, 16, { fontSize: 11 }));
  return t.done();
}

/** Wu et al. 2022 (arXiv 2206.14176), Fig. 2-3: DayDreamer, world model appreso su robot reali. */
function dayDreamer() {
  const t = new Builder();
  panel(t, 'Learning loop', 0, 0, 330, 330);
  t.text('Real World', 30, 22, 130, 18, { fontSize: 12, bold: true });
  const tile = (cx: number, cy: number) => t.add({ ...C(cx, cy, 66, 56), radius: 10, fill: '#FFFFFF', stroke: '#C9CED6', strokeWidth: 1 });
  const T: [number, number][] = [[60, 76], [132, 76], [60, 140], [132, 140]];
  T.forEach(([x, y]) => tile(x, y));
  draw(t, 'rob-quadruped', 'trot noground', '', T[0][0], T[0][1], 56, 40, YELLOW);
  draw(t, 'rob-arm', 'down parallel', '', T[1][0], T[1][1], 52, 44, GRAY);
  draw(t, 'rob-arm', 'reach suction', '', T[2][0], T[2][1], 52, 44, BLUE, { count: 4 });
  draw(t, 'rob-mobile', 'round', '', T[3][0], T[3][1], 36, 36, BLUE);
  const real = at(t, 96, 175);
  const buf = t.add({ shape: 'cylinder', label: 'Replay Buffer', ...C(260, 108, 80, 72), labelPos: 'above', fontSize: 12, bold: true, strokeWidth: 1.2, ...GRAY });
  const wm = block(t, 'World Model', 260, 262, 96, 56, GREEN, { fontSize: 12, bold: true, sublabel: 'RSSM', subSize: 11 });
  const ac = ico(t, 'robot', 'Actor Critic', 96, 262, 56, 56, TEAL, { fontSize: 12, bold: true });
  t.link(at(t, 170, 108), buf, 'right', 'left');
  t.link(buf, wm, 'bottom', 'top', { label: 'train', labelPos: 'below', fontSize: 11 });
  t.link(wm, ac, 'left', 'right', { label: 'imagine', labelPos: 'above', fontSize: 11 });
  t.link(ac, real, 'top', 'bottom', { label: 'act', labelPos: 'above', fontSize: 11 });
  // world model: RSSM srotolato su tre passi (encoder, stato latente, decoder)
  panel(t, 'World model learning', 360, 0, 540, 330);
  const GR = '#5FA35F';
  const hs: N[] = [], zs: N[] = [];
  for (let i = 0; i < 3; i++) {
    const x0 = 420 + i * 170;
    hs.push(block(t, `$h_${i + 1}$`, x0 + 40, 66, 48, 40, GREEN, { fontSize: 15, radius: 8 }));
    zs.push(t.add({ shape: 'grid', spec: '4x4', ...C(x0 + 40, 140, 36, 36), radius: 0, strokeWidth: 1.2, fill: '#FFFFFF', stroke: INK }));
    sig(t, `$z_${i + 1}$`, x0 + 10, 116, 20, 18, { fontSize: 13 });
    const enc = t.add({ shape: 'trapezoid', direction: 'top', label: 'enc', ...C(x0, 214, 58, 38), radius: 4, strokeWidth: 1.2, fontSize: 12, bold: true, fill: '#CFE0F5', stroke: '#4A86C8', textColor: '#1F4E79' });
    const dec = t.add({ shape: 'trapezoid', direction: 'top', label: 'dec', ...C(x0 + 80, 214, 58, 38), radius: 4, strokeWidth: 1.2, fontSize: 12, bold: true, fill: '#FBE0C3', stroke: '#E0912F', textColor: '#8A4B0F' });
    const xin = view(t, 'real gripper', '', x0, 286, 54, 42, { count: i + 1, label: `$x_${i + 1}$`, labelPos: 'below', bold: false, fontSize: 13 });
    const xout = view(t, 'real gripper', '', x0 + 80, 286, 54, 42, { count: i + 1, label: `$\\hat{x}_${i + 1}$`, labelPos: 'below', bold: false, fontSize: 13 });
    t.link(xin, enc, 'top', 'bottom', { color: '#4A86C8' });
    t.link(enc, zs[i], 'top', 'left', { color: '#4A86C8' });
    t.link(zs[i], dec, 'right', 'top', { color: '#E0912F' });
    t.link(dec, xout, 'bottom', 'top', { color: '#E0912F' });
    t.link(hs[i], zs[i], 'bottom', 'top', { color: GR });
  }
  for (let i = 0; i < 2; i++) {
    t.link(hs[i], hs[i + 1], 'right', 'left', { color: GR });
    t.link(zs[i], hs[i + 1], 'right', 'left', { color: GR, routing: 'curve' });
    const a = sig(t, `$a_${i + 1}$`, 540 + i * 170, 22, 22, 18, { fontSize: 13, textColor: '#C0392B' });
    t.link(a, hs[i + 1], 'bottom', 'left', { color: GR, routing: 'curve' });
  }
  return t.done();
}

export const ROBOTICS_TEMPLATES: TemplateDef[] = [
  { id: 'rob-pid', name: 'Anello di controllo PID', section: SEC, build: pid },
  { id: 'rob-statespace', name: 'Sistema in spazio di stato', section: SEC, build: stateSpace },
  { id: 'rob-mpc', name: 'Controllo predittivo (MPC)', section: SEC, build: mpc },
  { id: 'rob-visualservo', name: 'Visual servoing (IBVS)', section: SEC, build: visualServo },
  { id: 'rob-teleop', name: 'Teleoperazione bilaterale', section: SEC, build: teleop },
  { id: 'rob-spa', name: 'Sense-plan-act', section: SEC, build: senseplanact },
  { id: 'rob-slam', name: 'SLAM: front-end e back-end', section: SEC, build: slam },
  { id: 'rob-ros', name: 'Grafo ROS (nodi e topic)', section: SEC, build: rosGraph },
  { id: 'rob-kinematics', name: 'Cinematica diretta e inversa (DH)', section: SEC, build: kinematics },
  { id: 'rob-rrt', name: 'Pianificazione RRT', section: SEC, build: rrt },
  { id: 'rob-bc', name: 'Behavior cloning e DAgger', section: SEC, build: behaviorCloning },
  { id: 'rob-diffpolicy', name: 'Diffusion Policy (Chi 2023)', section: SEC, build: diffusionPolicy },
  { id: 'rob-rt2', name: 'RT-2 (Brohan 2023)', section: SEC, build: rt2 },
  { id: 'rob-sim2real', name: 'Domain randomization (Tobin 2017)', section: SEC, build: sim2real },
  { id: 'rob-hrl', name: 'RL gerarchico per locomozione (Jain 2019)', section: SEC, build: hierarchicalLocomotion },
  { id: 'rob-daydreamer', name: 'DayDreamer (Wu 2022)', section: SEC, build: dayDreamer },
];
