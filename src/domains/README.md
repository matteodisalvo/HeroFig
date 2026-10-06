# Moduli di dominio

Ogni file di questa cartella aggiunge all'app forme, blocchi della libreria e modelli
(diagrammi completi) per un ambito. I moduli sono indipendenti: un modulo modifica solo
il proprio file (o file propri con lo stesso prefisso, importati dal file principale).

| File | Prefisso id | Categorie dei blocchi | Sezione dei modelli |
|---|---|---|---|
| `ml.ts` | `ml-` | `ML classico`, `Grafici ML` | `Machine learning` |
| `dl.ts` | `dl-` | `Deep learning` | `Deep learning` |
| `signal.ts` | `sp-` | `Segnali`, `DSP` | `Signal processing` |
| `patterns.ts` | `pr-` | `Pattern recognition`, `Computer vision` | `Pattern recognition & CV` |
| `rl_nlp.ts` | `rl-`, `nlp-` | `Reinforcement learning`, `NLP & LLM` | `Reinforcement learning`, `NLP & LLM` |
| `dl_gen.ts` | `dlg-` | `Generative AI`, `Deep learning`, `Visione` | `Generative AI`, `Deep learning` |
| `ml_dl_more.ts` | `dlm-`, `mlm-` | `Deep learning`, `Graph learning`, `Scientific ML`, `Icone`, `Icone bio`, `ML classico`, `Grafici ML` | `Deep learning`, `Graph learning`, `Scientific ML`, `Machine learning` |
| `robotics.ts` | `rob-` | `Robotica`, `Controllo` | `Robotica e controllo` |
| `quantum.ts` | `qc-` | `Circuiti quantistici`, `Quantum computing` | `Quantum computing` |
| `quantum_ml.ts` | `qml-` | `Quantum ML` | `Quantum ML`, `Quantum generative AI` |
| `genomics.ts` | `gen-` | `Genomica`, `Proteine` | `Genomica e proteine` |
| `optics.ts` | `opt-` | `Ottica`, `Fotonica` | `Ottica e fotonica` |
| `chemistry.ts` | `chem-` | `Chimica`, `Materiali` | `Chimica e molecole` |
| `ml_extra.ts` | `mlx-` | `ML classico`, `Grafici ML` | `Machine learning` |
| `dl_extra.ts` | `dlex-`, `glex-`, `sciex-` | `Deep learning`, `Graph learning`, `Scientific ML` | `Deep learning`, `Graph learning`, `Scientific ML` |
| `ai_extra.ts` | `aix-` | `NLP & LLM`, `Reinforcement learning`, `Computer vision`, `Pattern recognition`, `Generative AI` | Sezioni corrispondenti dei domini esistenti |
| `technical_extra.ts` | `labx-` | Segnali, controllo, robotica, genomica, proteine, materiali, ottica, fotonica e quantum | Sezioni corrispondenti dei domini esistenti |

I circuiti quantistici si costruiscono con `circuit()` di `quantum-circuit.ts` (linguaggio delle porte
descritto in testa al file). Un modulo può riusare le forme di un altro importandolo (`import './signal';`):
i moduli ES si caricano una volta sola.

`_example.ts` è un esempio minimo dell'API e non viene caricato dall'app.

## API (src/registry.ts)

- `registerShapes(ShapeDef[])`: forme nuove. `parts(n)` restituisce primitive `Part` nel
  rettangolo `n.x, n.y, n.w, n.h`; `countLabel` / `specLabel` / `directionLabel` mostrano
  nel pannello i campi `n.count` / `n.spec` / `n.direction` per parametrizzare la forma.
- `registerPresets(Preset[])`: blocchi della libreria `{ id, name, category, node }`.
`name` è breve e in italiano (è l'interfaccia); le etichette nelle figure sono in inglese,
  come nei paper.
- `registerTemplates(TemplateDef[])`: modelli `{ id, name, section, build }`; `build()`
  usa `Builder` (src/builder.ts) e restituisce `{ nodes, edges }`.

La categoria dei blocchi descrive la loro funzione, non il modulo o il modello di
provenienza: ospedali in `Icone bio`, dispositivi in `Icone`, SAM/DETR in `Visione`,
componenti MAE/MoCo in `Deep learning` e campi/PDE in `Scientific ML`. Gli ID e le
forme non cambiano quando si riordina la libreria, così i documenti restano compatibili.
Le categorie possono mescolare forme vettoriali e immagini generate.

## Primitive di disegno (src/draw.ts)

`Part` è `rect` (x, y, w, h, r), `ellipse` (cx, cy, rx, ry) o `path` (comandi `M`, `L`, `C`, `Z`),
con `fill`. Opzioni: `stroke` (default: bordo del blocco; `'none'` per niente),
`sw` (spessore), `solid` (mai tratteggiato), `clip` (ritaglio a un rettangolo, per
illustrazioni in cornice). Aiuti: `poly`, `roundPoly`, `smooth` (curva morbida per punti),
`blob` (forma organica), `arc`, `rng` (casuale deterministico), `shade`/`mix` (colori),
`orient` (forme orientabili), `framed` (immagine con passe-partout e ritaglio).
Testo dentro le forme: primitiva `{ kind: 'text', x, y, text, size, fill, anchor?, bold?, italic? }`
(`y` è il centro verticale, `fill` il colore, `text` accetta formule `$…$`). Usarla con
misura: parole dei token, valori nelle celle, poche etichette d'asse leggibili; il titolo
del blocco resta l'etichetta (`label`, `sublabel`).

Varianti nel pannello: `specOptions` (gruppi di pulsanti; `mode` 'one' = una parola del
gruppo, 'many' = interruttori, 'value' = sostituisce tutto il campo) e `countMax` per il
limite del campo numerico. Ogni forma che legge `n.spec` deve elencare qui i valori ammessi.

## Stile (coerente con il resto dell'app)

- Colori pastello di `COLORS` (BLUE, GREEN, ORANGE, YELLOW, RED, PURPLE, TEAL, GRAY, WHITE),
  bordo 1.2, angoli arrotondati; encoder/decoder con `ENC_STYLE`/`DEC_STYLE` (lettera
  calligrafica + nome in `sublabel`); immagini in cornice con `MED_IMG` / `Builder.img`.
- Formule fra `$...$`: pedici/apici, greche, `\mathcal`, `\mathbb`, `\mathbf`, `\mathrm`,
  `\hat`, `\tilde`, `\bar`, `\|`, `\cdot`, `\times`, `\to`, `\odot`, `\otimes`, `\le`, `\subset`…
  Frazioni impilate `\frac{a}{b}` (`\dfrac`, `\tfrac`), radici `\sqrt{x}` e operatori con
  indici sopra/sotto (`\sum_{i=1}^{N}`, `\prod`, `\lim_{x \to 0}`, `\max_\theta`, `\arg\max_a`):
  la riga diventa più alta in automatico; nel TikZ escono in `\displaystyle`.
- Connessioni con `Builder.link` / `chain` (porte `top`/`right`/`bottom`/`left`); per i residui
  partire da `Builder.anchor` posto sulla linea; etichette sopra/sotto con `labelPos`.
- Riferimento per qualità e stile: `src/templates.ts` (Transformer, U-Net, virtual staining…).
  Prima di aggiungere qualcosa, controllare di non duplicare `PRESETS` (src/model.ts) o
  `TEMPLATES` (src/templates.ts): le forme esistenti si possono riusare.

## Controllo

```
node --import tsx scripts/check-library.ts     # integrità di tutta la libreria e export SVG/TikZ
npx tsx scripts/preview.ts <modulo> <cartella>   # es. signal /tmp/anteprima-signal
```

Genera PNG di blocchi e modelli (da guardare), compila tutto in TikZ e segnala problemi.
Non eseguire `vite build`, `npm run dist` o Electron sulla cartella del progetto: altri
moduli sono in lavorazione in parallelo. Se `npx tsc --noEmit` segnala errori in file di
altri, ignorarli; il proprio file deve essere pulito.
