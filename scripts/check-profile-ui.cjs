// Run after a build (dist/ by default, or any vite --outDir passed as argument):
// env -u ELECTRON_RUN_AS_NODE ./node_modules/.bin/electron scripts/check-profile-ui.cjs [build-dir]
// Uses an isolated, disposable Electron profile and never starts the app main process.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { app, BrowserWindow, session } = require('electron');

const root = path.resolve(__dirname, '..');
const page = path.join(path.resolve(root, process.argv.slice(2).find((arg) => !arg.startsWith('-')) ?? 'dist'), 'index.html');
const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'herofig-profile-ui-'));
app.setPath('userData', userData);
app.setPath('sessionData', userData);
app.commandLine.appendSwitch('disable-background-networking');
app.commandLine.appendSwitch('disable-component-update');
app.commandLine.appendSwitch('disable-domain-reliability');
app.disableHardwareAcceleration();

let window;
const failures = [];
const timeout = setTimeout(() => {
  console.error('Profile UI check timed out.');
  window?.destroy();
  fs.rmSync(userData, { recursive: true, force: true });
  app.exit(1);
}, 45000);
app.on('quit', () => {
  clearTimeout(timeout);
  fs.rmSync(userData, { recursive: true, force: true });
});

const evaluate = (fn, ...args) => window.webContents.executeJavaScript(`(${fn.toString()})(...${JSON.stringify(args)})`, true);
async function waitFor(fn, label) {
  const start = Date.now();
  while (!(await evaluate(fn))) {
    if (Date.now() - start > 8000) throw new Error(`Timed out: ${label}`);
    await new Promise((resolve) => setTimeout(resolve, 30));
  }
}
const click = (selector) => evaluate((target) => {
  const element = document.querySelector(target);
  if (!element) throw new Error(`Missing clickable element: ${target}`);
  element.click();
}, selector);
const fill = (selector, value) => evaluate((target, next) => {
  const element = document.querySelector(target);
  if (!element) throw new Error(`Missing field: ${target}`);
  const prototype = element instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(prototype, 'value').set.call(element, next);
  element.dispatchEvent(new Event('input', { bubbles: true }));
  element.dispatchEvent(new Event('change', { bubbles: true }));
}, selector, value);
const readStored = () => evaluate(() => ({
  profile: JSON.parse(localStorage.getItem('herofig:profile') ?? 'null'),
  prefs: JSON.parse(localStorage.getItem('mlsketch:prefs') ?? 'null'),
  onboarding: JSON.parse(localStorage.getItem('tensorfig:onboarding') ?? 'null'),
  language: localStorage.getItem('tensorfig:language'),
  document: localStorage.getItem('mlsketch:autosave'),
}));
const documentSnapshot = () => evaluate(() => ({
  nodes: Array.from(document.querySelectorAll('.canvas [data-node-id]'), (node) => node.outerHTML),
  edges: Array.from(document.querySelectorAll('.canvas [data-edge-id]'), (edge) => edge.outerHTML),
  dirty: !!document.querySelector('.save-tool.dirty'),
  autosave: localStorage.getItem('mlsketch:autosave'),
}));
const openProfile = async () => {
  await click('.profile-launcher');
  await waitFor(() => document.querySelector('.profile-dialog')?.open, 'profile panel opens');
};
const closeProfile = async () => {
  await click('.profile-actions button[type="button"]');
  await waitFor(() => !document.querySelector('.profile-dialog'), 'profile panel closes');
};

app.whenReady().then(async () => {
  try {
    const browserSession = session.fromPartition('persist:profile-ui-check');
    browserSession.webRequest.onBeforeRequest((details, callback) => {
      callback({ cancel: !/^(file:|data:|blob:|devtools:)/.test(details.url) });
    });
    window = new BrowserWindow({
      width: 1440, height: 900, useContentSize: true, show: false,
      webPreferences: { session: browserSession, contextIsolation: true, nodeIntegration: false, backgroundThrottling: false },
    });
    window.webContents.on('console-message', (event) => {
      if (event.level === 'error') failures.push(event.message);
    });
    await window.loadFile(page);
    await waitFor(() => document.querySelector('.onboarding')?.open, 'first-run onboarding opens');
    assert.equal((await readStored()).profile, null);

    await click('.onboarding input[name="language"][value="it"]');
    await waitFor(() => document.documentElement.lang === 'it', 'Italian preview applied');
    const originalDocument = await documentSnapshot();
    assert.ok(originalDocument.nodes.length, 'The demo document is rendered');
    await click('.onboarding button[type="submit"]');
    await waitFor(() => document.getElementById('onboarding-title')?.textContent === 'Il tuo profilo', 'profile setup step');
    await fill('.onboarding input[autocomplete="name"]', 'Ada');
    await fill('.onboarding input[autocomplete="organization"]', 'Laboratorio di ricerca');
    await fill('.onboarding input[autocomplete="organization-title"]', 'Ricercatrice');
    assert.equal((await readStored()).profile, null, 'Draft profile must not persist');
    await click('.onboarding button[type="submit"]');
    await waitFor(() => !!document.querySelector('.onboarding-packs'), 'library setup step');
    await click('.onboarding button[type="submit"]');
    await waitFor(() => !!document.querySelector('.onboarding-themes'), 'appearance setup step');
    await click('.onboarding input[name="appearance"][value="light"]');
    await click('.onboarding button[type="submit"]');
    await waitFor(() => !!document.querySelector('.onboarding-completion'), 'setup completion');
    const initial = await readStored();
    assert.equal(initial.profile.name, 'Ada');
    assert.equal(initial.profile.affiliation, 'Laboratorio di ricerca');
    assert.equal(initial.profile.role, 'Ricercatrice');
    assert.equal(initial.language, 'it');
    assert.equal(initial.onboarding.status, 'completed');
    await click('.onboarding button[type="submit"]');
    await waitFor(() => !document.querySelector('.onboarding'), 'setup dismissed');
    console.log('✓ First-run onboarding saves the local profile only on confirmation.');

    await openProfile();
    assert.equal(await evaluate(() => document.activeElement?.id), 'profile-name');
    assert.equal(await evaluate(() => document.getElementById('profile-affiliation').value), 'Laboratorio di ricerca');
    await fill('#profile-name', 'Ada Lovelace');
    await fill('#profile-role', 'Research lead');
    await fill('#profile-grid', 'dots');
    await fill('#profile-png', '4');
    await click('.profile-colors input[value="teal"]');
    assert.equal((await readStored()).profile.name, 'Ada', 'Profile edits remain a draft');
    await click('.profile-actions button[type="submit"]');
    await waitFor(() => !document.querySelector('.profile-dialog'), 'profile save closes panel');
    const saved = await readStored();
    assert.equal(saved.profile.name, 'Ada Lovelace');
    assert.equal(saved.profile.role, 'Research lead');
    assert.equal(saved.profile.color, 'teal');
    assert.equal(saved.prefs.gridStyle, 'dots');
    assert.equal(saved.prefs.pngScale, 4);
    assert.equal(await evaluate(() => document.querySelector('.profile-launcher-avatar').textContent), 'AL');
    console.log('✓ Profile, avatar and personal preferences save together.');

    await openProfile();
    await fill('#profile-name', 'Do not save');
    await fill('#profile-language', 'en');
    await fill('#profile-theme', 'dark');
    assert.equal(await evaluate(() => document.documentElement.lang), 'it', 'Profile language stays a draft');
    await closeProfile();
    assert.deepEqual(await readStored(), saved, 'Cancel discards profile and preference drafts');
    await openProfile();
    assert.equal(await evaluate(() => document.getElementById('profile-name').value), 'Ada Lovelace');
    console.log('✓ Cancel discards changes and reopening restores saved values.');

    await click('.profile-setup-link');
    await waitFor(() => document.querySelector('.onboarding')?.open, 'setup reopens from profile');
    await click('.onboarding input[name="language"][value="en"]');
    await click('.onboarding button[type="submit"]');
    await waitFor(() => !!document.querySelector('.onboarding input[autocomplete="name"]'), 'reopened profile setup');
    await fill('.onboarding input[autocomplete="name"]', 'Discard setup draft');
    await click('.onboarding-skip');
    await waitFor(() => !document.querySelector('.onboarding'), 'setup cancel');
    assert.equal(await evaluate(() => document.documentElement.lang), 'it');
    assert.deepEqual(await readStored(), saved, 'Reopened setup cancel restores language and keeps persisted values');
    assert.deepEqual(await documentSnapshot(), originalDocument, 'Profile operations leave figure content and dirty state untouched');
    console.log('✓ Reopening/canceling setup preserves profile, preferences and the figure.');

    await window.loadFile(page);
    await waitFor(() => !!document.querySelector('.profile-launcher'), 'app reload');
    assert.equal(await evaluate(() => !!document.querySelector('.onboarding')), false);
    assert.equal(await evaluate(() => document.documentElement.lang), 'it');
    await openProfile();
    assert.equal(await evaluate(() => document.getElementById('profile-name').value), 'Ada Lovelace');
    assert.equal(await evaluate(() => document.getElementById('profile-role').value), 'Research lead');
    assert.equal(await evaluate(() => document.getElementById('profile-grid').value), 'dots');
    assert.equal(await evaluate(() => document.getElementById('profile-png').value), '4');
    assert.deepEqual(await readStored(), saved);
    console.log('✓ Profile and preferences persist after a full renderer reload.');

    const output = path.join(root, 'output/profile-review');
    fs.mkdirSync(output, { recursive: true });
    const capture = async (filename) => {
      await new Promise((resolve) => setTimeout(resolve, 350));
      assert.ok(await evaluate(() => {
        const dialog = document.querySelector('.profile-dialog');
        const panel = dialog.getBoundingClientRect();
        const footer = document.querySelector('.profile-footer');
        footer.scrollIntoView({ block: 'nearest' });
        const actions = footer.getBoundingClientRect();
        const reachable = actions.top >= panel.top && actions.bottom <= panel.bottom;
        dialog.scrollTop = 0;
        return panel.left >= 0 && panel.right <= innerWidth && panel.top >= 0 && panel.bottom <= innerHeight && reachable;
      }), 'Dialog fits within the viewport and actions are reachable by scrolling');
      const screenshot = await window.webContents.capturePage();
      assert.ok(!screenshot.isEmpty(), 'Profile screenshot is not empty');
      fs.writeFileSync(path.join(output, filename), screenshot.toPNG());
    };
    await capture('profile.png');
    await fill('#profile-theme', 'dark');
    await click('.profile-actions button[type="submit"]');
    await waitFor(() => !document.querySelector('.profile-dialog'), 'dark appearance saved');
    await openProfile();
    await capture('profile-dark.png');
    window.setContentSize(900, 560);
    await capture('profile-compact-dark.png');
    await fill('#profile-theme', 'light');
    await click('.profile-actions button[type="submit"]');
    await waitFor(() => !document.querySelector('.profile-dialog'), 'light appearance saved');
    await openProfile();
    await capture('profile-compact.png');
    assert.deepEqual(failures, [], 'No renderer console errors');
    console.log('✓ Light/dark screenshots at 1440×900 and 900×560 saved in output/profile-review.');
    window.destroy();
    app.quit();
  } catch (error) {
    console.error(error);
    clearTimeout(timeout);
    window?.destroy();
    fs.rmSync(userData, { recursive: true, force: true });
    app.exit(1);
  }
});
