# Changelog

All notable changes to HeroFig are listed here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and versions follow
[Semantic Versioning](https://semver.org/).

## [1.0.0] - 2026-10-05

First public release.

### Added
- A canvas for paper figures, with a library of blocks, tensors, small architectures, plots,
  icons and scientific images, and ready-made templates of well-known models to start from.
- Installable packs for medicine and biomedicine, signals, vision, reinforcement learning and
  NLP, classical machine learning, robotics, quantum computing, quantum machine learning,
  genomics, optics and chemistry.
- The **Page** view: the figure shown on the page of the chosen venue (CVPR/ICCV, ICML, IEEE,
  NeurIPS/ICLR, MICCAI/LNCS), at column or full width, with its caption. It points out text
  smaller than 6 pt and text that overflows its block, and can refit the figure to the page.
  The colours can be previewed in grayscale and as seen by colour-blind readers.
- Export to SVG, PDF, PNG and TikZ (with the `figure` environment and the caption), of the
  whole figure or the selection only; copy as an image for slides or as SVG for Figma and Inkscape.
- Link to the paper: the figure is written as PDF and TikZ into the paper's folder every time
  it is saved, also for Overleaf through Google Drive or Git.
- Themes by role: pastel, sober, colour-blind safe, black and white.
- Projects: a folder of figures with a deadline and a status for each figure.
- Together: comments pinned on the figure and live editing with colleagues on the same network,
  in named rooms, through a group server that runs inside one copy of the app.
- Optional AI images for blocks, made by FLUX.1-schnell through Hugging Face with a free key that
  you paste once in the **Image** panel. Generated images are marked so they can be declared in
  the paper.
- Twelve languages, light and dark appearance, macOS and Windows.
- Files saved as `.hfig`; files from the earlier TensorFig (`.tfig`) and ML Pipeline Sketch
  (`.mlsketch`) builds still open.

[1.0.0]: https://github.com/matteodisalvo/herofig/releases/tag/v1.0.0
