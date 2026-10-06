# Asset imagegen per HeroFig

70 immagini create con lo strumento **imagegen integrato**, con una generazione separata per asset:

- `medical/`: 19 immagini di imaging medico, microscopia, segmentazione ed ECG (JPEG, opache).
- `bio/`: 6 icone biomediche con trasparenza reale (PNG).
- `signals/`: 35 visualizzazioni di segnali e biosegnali (PNG con trasparenza; spettrogrammi, scalogramma e MFCC in JPEG).
- `icons/`: 10 icone schematiche approvate dopo il confronto prima/dopo del 4 ottobre 2026: camera, laser, obiettivo, ospedale, pipetta, sequenziatore, umanoide, quadrupede, criostato e pedone schematico.

Il nome del file è l'id del preset; `dimensions.json` riporta larghezza e altezza usate dall'app per le proporzioni. I file `prompts.json` conservano i prompt finali di ogni immagine (per le icone anche l'hash SHA-256 del file distribuito e di quello approvato).

Le uscite di imagegen (circa 1400–2000 px, 74 MB) sono state ridotte a 1024 px sul lato lungo con Lanczos: i blocchi le disegnano a 30–190 px, quindi restano nitide anche a 4× o ingrandite per la stampa. Le immagini opache sono JPEG qualità 95 senza sottocampionamento del colore, quelle con trasparenza PNG RGBA. Nuovi asset devono seguire le stesse regole (le verifica lo script qui sotto).

Le immagini sono illustrazioni sintetiche per diagrammi e presentazioni. Non sono acquisizioni da pazienti né grafici calcolati da misurazioni reali.

I preset della libreria usano questi asset mantenendo nomi, categorie e identificativi esistenti. Il nuovo `pr-ped-schematic` affianca il pedone originale `pr-ped`, che resta disponibile con i suoi modelli HOG e posa. Le varianti numeriche, le altre direzioni e le personalizzazioni che richiedono un nuovo disegno continuano a usare le forme parametriche originali. Etichette, sottotitoli e nomi degli assi restano testo nativo modificabile.

Gli export SVG/PNG/PDF incorporano le immagini utilizzate; l'export TikZ salva le immagini come allegati `.png`/`.jpg` del documento LaTeX. Il caricamento nell'editor usa file locali e l'incorporamento per l'export avviene solo per gli asset richiesti.

Verifica dell'integrazione:

```sh
node --import tsx scripts/check-generated-assets.ts /tmp/herofig-generated-check
npm run typecheck
```
