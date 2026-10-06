# Richieste e segnalazioni

Il pannello si apre da **Aiuto → Richieste e segnalazioni** e dalla finestra **Pacchetti** («Chiedi un pacchetto», «Proponi un’aggiunta», ambiti suggeriti). Ha tre tipi: nuovo pacchetto, aggiunta, errore. Codice: `src/feedback.ts` (stato, bozze, invio), `src/components/FeedbackPanel.tsx` (interfaccia), `electron/feedback.cjs` (trasporto desktop).

## Invio

I messaggi vanno a un destinatario fisso, `disalvo.matteo@outlook.com`, tramite l’endpoint AJAX di [FormSubmit](https://formsubmit.co/documentation): chi scrive non ha bisogno di un account e l’app non contiene password o chiavi.

- **Web**: `fetch` diretto con `credentials: 'omit'` e `referrerPolicy: 'origin'` (FormSubmit rifiuta le richieste senza Referer anche se `_url` è presente).
- **Desktop**: il renderer chiama l’IPC `feedback:submit`; il processo principale accetta solo la finestra principale, solo i campi previsti e con limiti di lunghezza, usa endpoint e Referer fissi (`https://github.com/matteodisalvo/herofig`) e `redirect: 'error'`. Il renderer non può scegliere altri indirizzi, copie o webhook.

L’oggetto inizia con `[HeroFig][Pacchetto]`, `[HeroFig][Aggiunta]` o `[HeroFig][Errore]`, utile per le regole della posta. Il corpo (in italiano, per chi lo riceve) è lo stesso testo dell’anteprima e di «Copia il testo».

Il destinatario va attivato una volta: al primo invio FormSubmit manda un’email di attivazione (controllare anche lo spam). Il destinatario attuale è già attivo; se cambia, va riattivato. Finché non è attivo il pannello mostra l’errore «attivazione».

## Dati e bozze

- Obbligatori: titolo e descrizione. Facoltativi: link di riferimento (solo `http`/`https`), nome, email (usata anche come indirizzo di risposta). Per gli errori anche passaggi e risultato atteso.
- Diagnostica solo per gli errori, disattivata di default: versione, piattaforma, lingua, desktop/web. Nessun documento, immagine, percorso o file viene allegato.
- Una bozza per tipo, salvata in `localStorage` (`tensorfig:feedback`, contatti compresi). Resta in caso di errore e viene cancellata solo quando il servizio conferma (`success: true` o `"true"`). Senza storage la bozza vale per la sessione.

## Esiti

- `validation`: campi mancanti o non validi, nessuna richiesta.
- `network`: il dispositivo è offline, nessuna richiesta.
- `rejected`: risposta HTTP di errore o `success: false`.
- `activation`: il modulo FormSubmit non è ancora attivo.
- `unconfirmed`: nessuna conferma (risposta non JSON, rete caduta, timeout di 20 s). Il messaggio potrebbe essere arrivato: un nuovo invio potrebbe duplicarlo.

Un invio alla volta e nessun retry automatico. Il riferimento locale `TF-…` (mostrato all’utente e incluso nel messaggio) resta lo stesso nei tentativi sulla stessa bozza, anche dopo un riavvio, e cambia se la bozza viene modificata: serve a riconoscere i duplicati, non è un ticket.

## Verifica

`node --import tsx scripts/check-feedback.ts` e `node scripts/check-feedback-desktop.cjs` sostituiscono `fetch`: non contattano FormSubmit e non mandano email. Un invio reale va fatto solo dal proprietario, senza dati sensibili.
