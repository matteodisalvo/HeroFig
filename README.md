<p align="center">
  <img src="build/icon.png" width="112" alt="HeroFig logo">
</p>

<h1 align="center">HeroFig</h1>

<p align="center">
  Every paper needs a hero figure.<br>
  Draw it at the size it will be printed, and drop it straight into LaTeX.
</p>

<p align="center">
  <a href="https://github.com/matteodisalvo/herofig/releases/latest"><img src="https://img.shields.io/github/v/release/matteodisalvo/herofig?label=download" alt="Latest release"></a>
  <a href="https://github.com/matteodisalvo/herofig/actions/workflows/checks.yml"><img src="https://github.com/matteodisalvo/herofig/actions/workflows/checks.yml/badge.svg" alt="Checks"></a>
  <img src="https://img.shields.io/badge/macOS-000000?logo=apple&logoColor=white" alt="macOS">
  <img src="https://img.shields.io/badge/Windows-0078D4?logo=data:image/svg%2bxml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PHRpdGxlPldpbmRvd3M8L3RpdGxlPjxwYXRoIGZpbGw9IndoaXRlIiBkPSJNMCAwaDExLjM3N3YxMS4zNzJIMHptMTIuNjIzIDBIMjR2MTEuMzcySDEyLjYyM3pNMCAxMi42MjNoMTEuMzc3VjI0SDB6bTEyLjYyMyAwSDI0VjI0SDEyLjYyM3oiLz48L3N2Zz4K" alt="Windows">
  <img src="https://img.shields.io/badge/Linux-FCC624?logo=linux&logoColor=black" alt="Linux">
  <img src="https://img.shields.io/badge/LaTeX-TikZ-008080?logo=latex&logoColor=white" alt="TikZ export">
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-green" alt="MIT license"></a>
</p>

<p align="center">
  <a href="#-features">Features</a> · <a href="#-install">Install</a> ·
  <a href="#-how-to-use-it">How to use it</a> · <a href="#-privacy">Privacy</a> ·
  <a href="#-feedback">Feedback</a> · <a href="README.it.md">Leggi in italiano</a>
</p>

<p align="center">
  <img src="docs/images/poster.jpg" alt="HeroFig — Paper figures giving you a headache? Don't worry, TRY it. A worried researcher and a friend showing him HeroFig on a laptop.">
</p>

## 🎬 How it works

<p align="center">
  <img src="docs/images/demo.gif" alt="HeroFig: a Vision Transformer figure on the canvas, then on a CVPR page with three problems, fixed in one click, then the Export menu">
</p>

## ⬇️ Download

<p align="center">
  <a href="https://github.com/matteodisalvo/herofig/releases/latest"><img src="https://img.shields.io/badge/Download_for_macOS-000000?style=for-the-badge&logo=apple&logoColor=white" alt="Download for macOS"></a>
  <a href="https://github.com/matteodisalvo/herofig/releases/latest"><img src="https://img.shields.io/badge/Download_for_Windows-0078D4?style=for-the-badge&logo=data:image/svg%2bxml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PHRpdGxlPldpbmRvd3M8L3RpdGxlPjxwYXRoIGZpbGw9IndoaXRlIiBkPSJNMCAwaDExLjM3N3YxMS4zNzJIMHptMTIuNjIzIDBIMjR2MTEuMzcySDEyLjYyM3pNMCAxMi42MjNoMTEuMzc3VjI0SDB6bTEyLjYyMyAwSDI0VjI0SDEyLjYyM3oiLz48L3N2Zz4K" alt="Download for Windows"></a>
  <a href="https://github.com/matteodisalvo/herofig/releases/latest"><img src="https://img.shields.io/badge/Download_for_Linux-FCC624?style=for-the-badge&logo=linux&logoColor=black" alt="Download for Linux"></a>
</p>

Free and open source, no account needed, and your figures stay on your computer. The
first time you open it, follow the [install steps](#-install) below.

## ✨ Features

Pick a template or drag blocks from the library, write the labels, and HeroFig shows you the
figure on the page of your paper, at the size the reader will see it. When it is right, export
it as PDF, SVG, PNG or TikZ, or let HeroFig write it into the paper's folder on every save.

- **A library made for papers**: with the packs, more than 1,000 blocks (tensors, small
  architectures such as U-Net, CNN, RNN and FPN, plots, icons and scientific images) and nearly
  250 ready-made figures of well-known models (Transformer, U-Net, diffusion, VQ-VAE, NeRF, SAM,
  Llama…) to start from.
- **Packs for your field**: medicine and biomedicine, signals, vision, reinforcement learning
  and NLP, classical machine learning, robotics, quantum computing, quantum machine learning,
  genomics, optics and chemistry. Install only the ones you need.
- **See it on the page**: CVPR/ICCV, ICML, IEEE, NeurIPS/ICLR and MICCAI/LNCS, at column or full
  width, with the caption. HeroFig points out text smaller than 6 pt and text that spills out of
  its block, and **Fit to page** rearranges the figure until it reads well.
- **Print-proof colours**: themes by role (pastel, sober, colour-blind safe, black and white) and
  a preview of how the figure looks in grayscale and to colour-blind readers.
- **Export that LaTeX likes**: SVG, PDF, PNG at the resolution you choose, and TikZ with the
  `figure` environment and the caption already in place. Copy as an image for your slides, or as
  SVG for Figma and Inkscape.
- **Always up to date in the paper**: link the paper's folder and every save writes the PDF and
  the TikZ next to your `.tex`; it works with Overleaf too, through Google Drive or Git.
- **Work together**: comments pinned on the figure, and live editing with your lab on the same
  network, in rooms, through a small server that runs inside one copy of the app. Projects keep a
  paper's figures together, with a deadline and a status for each one.
- **Optional AI images**: illustrative pictures for your blocks, made by an open model through
  Hugging Face. Generated images are marked, so you remember to declare them in the paper.
- **Speaks twelve languages**: English, Italian, Spanish, French, German, Portuguese, Russian,
  Chinese, Japanese, Korean, Arabic and Hindi, in light or dark mode.

## 🖼️ The page view

<p align="center">
  <img src="docs/images/page.png" width="860" alt="The page view: a figure on a CVPR page at its printed size, with the caption and the checks on the right">
</p>

## 📦 Install

Download the file for your system from the
[latest release](https://github.com/matteodisalvo/herofig/releases/latest).

### <img src="docs/images/apple.svg" height="20" alt=""> macOS

1. Download `HeroFig-<version>-macOS-arm64.dmg` for Apple silicon (M1 and later) or
   `HeroFig-<version>-macOS-x64.dmg` for Intel Macs, and open it.
2. Drag **HeroFig** onto **Applications**.
3. The first time, macOS may say it cannot check the developer, because the app is not
   notarized by Apple. Open **System Settings → Privacy & Security**, scroll down and
   click **Open Anyway**. You only need to do this once.

### <img src="docs/images/windows.svg" height="18" alt=""> Windows

1. Download `HeroFig-<version>-Windows-Setup.exe` and double-click it.
2. If Windows SmartScreen warns about an unknown publisher, click **More info → Run anyway**.
3. Follow the installer: you can install HeroFig for your user only, without administrator rights.

### <img src="docs/images/linux.svg" height="20" alt=""> Linux

1. Download the package for your distribution from the
   [latest release](https://github.com/matteodisalvo/herofig/releases/latest):
   `herofig_<version>_amd64.deb` for Debian, Ubuntu and Mint; `herofig-<version>.x86_64.rpm`
   for Fedora, RHEL and openSUSE; `herofig-<version>.pacman` for Arch and Manjaro;
   `herofig-<version>.apk` for Alpine; `herofig-<version>.tar.gz` for any other distribution.
   On ARM computers use the `arm64` or `aarch64` files.
2. Install it from the terminal, in the folder where you downloaded it:

   ```bash
   sudo apt install ./herofig_<version>_amd64.deb        # Debian, Ubuntu, Mint
   sudo dnf install ./herofig-<version>.x86_64.rpm       # Fedora, RHEL
   sudo zypper install ./herofig-<version>.x86_64.rpm    # openSUSE
   sudo pacman -U herofig-<version>.pacman               # Arch, Manjaro
   sudo apk add --allow-untrusted herofig-<version>.apk  # Alpine
   ```

3. Or use the AppImage, which needs no installation: download `HeroFig-<version>.AppImage`,
   make it executable and run it:

   ```bash
   chmod +x HeroFig-<version>.AppImage
   ./HeroFig-<version>.AppImage
   ```

### Run from source

On any system with [Node.js](https://nodejs.org) 22 or newer:

```bash
git clone https://github.com/matteodisalvo/herofig.git
cd herofig
npm install
npm run dev             # the desktop app, reloading as you edit the code
```

## 🚀 How to use it

1. Start from a template, or drag blocks from the library on the left (⌘F / Ctrl+F searches it).
   Double-click a block to write its label; the bar above the selection aligns and spaces blocks.
2. Click **Page** and choose your venue: the figure appears on the page at its real size. Follow the
   checks on the right, or press **Fit to page**.
3. **Export** the figure, or link the paper's folder so that every save (⌘S / Ctrl+S) updates the
   PDF and the TikZ that your `.tex` includes.

All the shortcuts are one keystroke away: ⌘/ on macOS, Ctrl+/ on Windows and Linux.

### Optional AI images

Generating images is optional: HeroFig works fully without it. To make one you need a free
[Hugging Face](https://huggingface.co) account. The first time, click **Create a key** in the
**Image** panel: Hugging Face opens with the right permission already chosen. Create the key, then
paste it in the panel. HeroFig keeps it encrypted on your computer, and finds it by itself if you
already use `hf auth login` or `HF_TOKEN`. Images are made by FLUX.1-schnell, an open model, through
Hugging Face's inference providers: the description you write is sent to Hugging Face and to the
provider that runs the model. Each image uses a little of your account's free monthly credit; after
that, you pay per use.

### Working with your lab

**Together** works without any cloud service. One person in the lab starts the group server from
the app (it can start with the computer) and shares the invite, a code like
`192.168.1.20:47800/ABCD-EFGH-JKLM`. Colleagues paste it once; from then on everyone can open
rooms, edit the same figure live and leave comments on it. It works between computers that can reach
each other: the same network, or the same VPN.

## 🔒 Privacy

HeroFig has no account and no telemetry, and figures are plain `.hfig` files on your disk. It goes
online only when you ask it to: when you send a message from **Feedback** (delivered through
[FormSubmit](https://formsubmit.co)), when you generate
an image (your description goes to Hugging Face and to the provider that runs the model), when it
pushes to Overleaf through Git, and to talk to your lab's group server on the local network.

## 💡 How it started

HeroFig was made to help researchers stop redrawing the same blocks by hand every time. The same
encoder, attention module or U-Net comes back in every paper, and each time you start from
scratch, only to find after compiling that the text is too small. With HeroFig those blocks are
ready in the library, the figure is shown at the right size for the paper from the start, and the
time saved goes back into research.

## 💬 Feedback

Found a bug, missing a block, or would like a pack for your field? Write to me with the
**Feedback** button at the top of the app: no account needed, and I'll reply by email. If you
prefer, you can also open an [issue on GitHub](https://github.com/matteodisalvo/herofig/issues).

<table align="center">
  <tr>
    <td align="center">
      If you find the project interesting, support it with a star on GitHub.<br><br>
      <a href="https://github.com/matteodisalvo/herofig"><img src="docs/images/star-en.svg" height="60" alt="Star HeroFig on GitHub"></a>
    </td>
  </tr>
</table>

## 🛠️ Development

```bash
npm install
npm run dev          # desktop app with hot reload
npm run dev:web      # the same editor in the browser (desktop-only features are hidden)
npm run typecheck    # TypeScript
npm run check        # the checks: library, translations, onboarding, profile, feedback
```

```
herofig/
├── src/
│   ├── App.tsx, store.ts       # the app and its state
│   ├── model.ts, actions.ts    # the figure: blocks, connections, editing actions, file format
│   ├── geometry.ts, icons.ts   # shapes as drawing primitives, identical on screen and in every export
│   ├── domains/                # the library: one module of shapes and templates for each field
│   ├── paper.ts, fit.ts        # the page view: venues, print size, fit to page
│   ├── review.ts               # the checks shown next to the page
│   ├── export/                 # SVG and TikZ export
│   ├── live.ts, merge.ts       # working together: live rooms and merging of concurrent edits
│   ├── locales/                # every text, in twelve languages
│   └── components/             # the React interface
├── electron/                   # desktop shell: windows, menus, files, PDF, group server, AI images
├── scripts/                    # development, packaging and check scripts
├── build/                      # app icons
└── .github/workflows/          # checks on every push, apps on every release
```

To add shapes and templates for a new field, see [`src/domains/README.md`](src/domains/README.md).

### Build the apps

```bash
npm run dist         # HeroFig.app for this Mac, in release/, to try it quickly
npm run dist:mac     # the two disk images, Apple silicon and Intel
npm run dist:win     # the Windows installer (it can be built from a Mac too)
npm run dist:linux   # the Linux packages, x64 and arm64 (built on Linux; rpm and pacman
                     # need the rpm and libarchive-tools packages, e.g. on Ubuntu)
```

### Publish a release

The apps to download are not kept in the repository: GitHub builds them and attaches them to a
release, on the repository's **Releases** page. To publish a new version:

1. Write the new version number in `package.json` (the app and the file names take it from there)
   and note what changed in `CHANGELOG.md`.
2. Commit, then push a tag with the same number preceded by `v`:

```bash
git tag v<version>
git push origin v<version>
```

GitHub builds the macOS, Windows and Linux apps and creates the release with the files attached.
From the **Actions** tab you can also run the **Release** workflow by hand: it builds the apps as a
test, without publishing anything.

## 🌍 Translations

The texts live in [`src/locales/`](src/locales), each one with its twelve languages side by side;
`npm run check` reports any missing text or placeholder. Corrections from native speakers are very
welcome.

## 🙏 Credits

- Built with [Electron](https://www.electronjs.org), [React](https://react.dev),
  [Vite](https://vite.dev) and [TypeScript](https://www.typescriptlang.org).
- AI images by [FLUX.1-schnell](https://huggingface.co/black-forest-labs/FLUX.1-schnell) through
  [Hugging Face Inference Providers](https://huggingface.co/docs/inference-providers), with the
  [huggingface.js](https://github.com/huggingface/huggingface.js) client.
- The icons are drawn by hand in [`src/components/Icon.tsx`](src/components/Icon.tsx).

## 📄 License

[MIT](LICENSE) © 2026 Matteo Di Salvo

Made by **Matteo Di Salvo**: [GitHub](https://github.com/matteodisalvo) ·
[website](https://matteodisalvo.github.io/)

## ☕ Buy me a coffee

If HeroFig saved you a sleepless night before a deadline and you would like to say thanks, you can
buy me a coffee:

<p align="center">
  <a href="https://buymeacoffee.com/matteodisalvo"><img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" height="50" alt="Buy Me a Coffee"></a>
</p>
