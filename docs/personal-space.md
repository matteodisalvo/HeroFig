# Primo avvio e spazio personale

## Configurazione iniziale

Al primo avvio si apre una configurazione in quattro passi (`src/components/Onboarding.tsx`): lingua, profilo, pacchetti della libreria, aspetto. La lingua si vede subito in anteprima; tutto il resto resta una bozza e viene salvato solo con **Prepara HeroFig** (**Salva preferenze** quando la si riapre). **Salta per ora** (**Annulla** quando la si riapre) ed **Esc** chiudono senza salvare e ripristinano la lingua di prima. Lo stato (`pending`, `skipped`, `completed`) è in `localStorage` (`tensorfig:onboarding`): dopo «salta» o «completa» la configurazione non si riapre da sola, ma resta disponibile da **File → Configura HeroFig…** e dal pannello del profilo.

## Il tuo spazio

Si apre dall’avatar nella barra degli strumenti o da **File → Il tuo spazio** (`src/components/ProfilePanel.tsx`). Contiene nome, istituzione/laboratorio e ruolo (facoltativi), colore dell’avatar e le preferenze personali: lingua, aspetto, griglia del foglio, risoluzione PNG; mostra anche quanti pacchetti e preferiti ci sono. Le modifiche sono una bozza fino a **Salva**; **Annulla**, la chiusura ed **Esc** le scartano.

## Dove finiscono i dati

Tutto resta sul dispositivo, senza account né sincronizzazione: nell’app desktop nei dati dell’utente del sistema, nel browser nello storage del sito.

| Chiave `localStorage` | Contenuto |
| --- | --- |
| `herofig:profile` | profilo (`src/profile.ts`) |
| `mlsketch:author` | copia del nome, letta dalle versioni precedenti |
| `tensorfig:language` | lingua scelta (`system` = lingua del dispositivo) |
| `mlsketch:prefs` | aspetto, griglia, risoluzione PNG e altre preferenze dell’interfaccia |
| `mlsketch:packs` | pacchetti mostrati nella libreria |

I nomi delle chiavi vengono dalle versioni precedenti dell’app e non vanno rinominati. Se manca il profilo, il nome viene recuperato da `mlsketch:author`; aprire il pannello o la configurazione non scrive nulla. Se lo storage non è disponibile, profilo e preferenze valgono per la sessione; il salvataggio del profilo lo segnala.

Il nome compare nei nuovi commenti, nella presenza nelle cartelle di progetto e nella collaborazione dal vivo (cambiarlo aggiorna la presenza; i commenti già scritti non cambiano). Istituzione, ruolo e colore non entrano mai nei documenti né nei messaggi di collaborazione.

## Verifica

```sh
node --import tsx scripts/check-profile.ts
node --import tsx scripts/check-onboarding.ts
node --import tsx scripts/check-i18n.ts
# interfaccia: build in una cartella qualsiasi, poi Electron con un profilo temporaneo isolato
npx vite build --outDir /tmp/herofig-build --emptyOutDir
env -u ELECTRON_RUN_AS_NODE ./node_modules/.bin/electron scripts/check-profile-ui.cjs /tmp/herofig-build
```

Il controllo dell’interfaccia non usa i dati reali dell’app e salva gli screenshot in `output/profile-review/`.
