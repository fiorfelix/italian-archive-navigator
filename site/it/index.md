---
title: "Italian Archive Navigator · Trovare gli atti di nascita, matrimonio e morte degli antenati"
description: "Scopri dove si trova oggi l'atto di nascita, matrimonio, morte o il foglio matricolare di un antenato, l'indirizzo e la PEC dell'ufficio e la lettera di richiesta. Un connettore gratuito per Claude."
url: https://archives.fiorfelix.com/it/
language: it
updated: 2026-11-24
---

# Scopri dove si trova l'atto di un antenato, e come richiederlo

Un connettore per Claude, in sola lettura. Indica un luogo, un anno e un evento: Claude trova come si chiamava il luogo e a quale comune apparteneva, quali atti esistono e quale ufficio ne conserva oggi ciascuna copia, l'indirizzo e la PEC di quell'ufficio, scrive la lettera di richiesta e prepara la citazione di ciò che trovi.

## Aggiungilo a Claude

Copia l'indirizzo, apri le impostazioni e incolla. Basta un minuto.

Sei sul telefono? È più semplice aggiungerlo da un computer: apri claude.ai in un browser e segui questi passaggi. Il connettore comparirà poi anche nell'app Claude sul telefono.

`https://archives-mcp.fiorfelix.com/mcp`

[Apri le impostazioni dei connettori di Claude ↗](https://claude.ai/customize/connectors)

1. Fai clic su **+** e scegli l'opzione per aggiungere un connettore personalizzato (*Add custom connector*).
2. Nome: `Italian Archive Navigator`. Incolla l'indirizzo nel campo URL.
3. Se richiesto, scegli l'opzione senza accesso (*No sign-in*), poi conferma.

Poi, in una nuova chat, fai una domanda come "Dove si trova l'atto di nascita del 1880 di Montefiore dell'Aso?". Basta aggiungerlo una volta dal sito o dall'app desktop di Claude e funziona anche nelle app per telefono. Nei piani Team ed Enterprise lo aggiunge un amministratore (Owner) nelle impostazioni dell'organizzazione. Non serve alcun account e nulla viene mai inviato a tuo nome.

**Usi Claude Code?**

`claude mcp add --transport http italian-archive-navigator https://archives-mcp.fiorfelix.com/mcp`

## Configurazione consigliata

La ricerca di luoghi, atti, uffici e lettere di richiesta funziona in qualsiasi app di Claude, su qualsiasi dispositivo, anche sul telefono. Anche la lettura dei registri funziona ovunque: allega alla chat le immagini delle pagine.

Per un progetto completo di storia familiare, la configurazione migliore è Claude su un computer (il tuo o uno remoto) con **Claude Code** o **Cowork**. Lì Claude può anche:

- tenere pagine dei registri, trascrizioni e note in una cartella sul tuo computer;
- scaricare automaticamente le pagine dai siti che lo consentono, con calma e una pagina alla volta (i siti con accesso o controlli anti-bot, come il Portale Antenati, restano manuali);
- creare l'albero genealogico, le biografie e la presentazione come file.

## Cosa chiedere

- "Il mio bisnonno è nato a Corneto nel 1880. Dove si trova il suo atto di nascita?"
- "Quale archivio conserva gli atti di matrimonio di Orvieto del 1895?"
- "Dove sarebbe registrato un battesimo a Perugia nel 1840?"
- "Quale ufficio dell'Esercito ha il foglio matricolare di un soldato nato a Pescia nel 1890?"
- "Scrivi la lettera per chiedere al Comune la copia integrale di quell'atto di nascita."
- "Come cito l'atto di nascita n. 45 del 1880 che ho trovato nell'indice dell'archivio?"

Puoi scrivere a Claude in italiano: risponde in italiano.

## Cosa fa

| Strumento | Cosa ottieni |
| --- | --- |
| Storia del luogo | Il comune di oggi per qualsiasi nome di luogo dal 1861 (nomi precedenti, comuni fusi, frazioni), con il nome e la provincia in un dato anno. |
| Quali atti esistono | Il sistema di registrazione in vigore (napoleonico, stati preunitari, stato civile italiano dal 1866, registri parrocchiali, documenti militari), cosa aspettarsi e chi conserva oggi ciascuna copia. |
| Contatti degli uffici | Nome, indirizzo e PEC del Comune, dell'Archivio di Stato o del centro documentale dell'Esercito, da fonti ufficiali. |
| Lettera di richiesta | Una lettera formale in italiano, con un riepilogo in inglese e l'elenco degli allegati. Restituita come testo: la controlli e la invii tu. |
| Guida ai registri | Cosa trovare in un registro: come sono numerati gli atti, dov'è l'indice, le formule tipiche e come leggerlo. |
| Ricerca dei cognomi | Trova i tuoi cognomi tra i nomi letti negli atti, tenendo conto delle grafie antiche e delle lettere che nella scrittura a mano si somigliano. |
| Citazione | Un formato di citazione uniforme, con un'indicazione di quanto è affidabile la fonte. |

## Copertura e limiti

- La copertura è più completa per **Lazio, Umbria, Toscana e Marche**. La storia dei luoghi e i contatti degli uffici coprono tutta Italia.
- Ogni regola cita la sua fonte. Le regole non ancora confermate da una fonte ufficiale sono segnate come **non verificate** in ogni risposta, così sai che conviene chiedere conferma all'ufficio.
- Non fa ricerche sul Portale Antenati, su FamilySearch o su altri siti, e non può sapere se un atto è stato pubblicato online.
- Non fa ricerche su persone viventi. Gli atti di eventi di meno di 100 anni fa, o di persone nate dopo il 1940, sono lasciati al Comune, che decide cosa può rilasciare.
- Non indica mai costi o tempi di risposta: le lettere li chiedono all'ufficio.

## Fonti

- Comuni, la loro storia dal 1861 e le località abitate: [ISTAT](https://www.istat.it/) (Istituto Nazionale di Statistica).
- Indirizzi e PEC degli uffici: [IndicePA](https://www.indicepa.gov.it/) (Agenzia per l'Italia Digitale) e le pagine dell'Esercito sui suoi centri documentali.
- Regole sugli atti: la *Guida generale degli Archivi di Stato italiani*, gli inventari degli archivi e le leggi stesse su Normattiva, citate in ogni risposta.

Contiene dati ISTAT e IndicePA, rilasciati con licenza [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/deed.it). I dati sono stati selezionati, normalizzati per la ricerca e riuniti in un unico database; i nomi dei responsabili degli uffici non sono conservati. Né ISTAT né AgID sostengono questo progetto.

## Domande frequenti

### Dove si trovano gli atti di nascita, matrimonio e morte in Italia?

Gli atti di stato civile (dal 1866 in quasi tutta Italia, prima dove esisteva lo stato civile napoleonico o quello degli stati preunitari) erano redatti in due originali. Uno resta all'Ufficio di Stato Civile del Comune. L'altro andava al tribunale e, per gli anni più antichi, di solito si trova oggi all'Archivio di Stato della provincia. Battesimi, matrimoni e sepolture precedenti allo stato civile sono nei registri parrocchiali, conservati dalla parrocchia o dall'archivio diocesano. Il navigatore indica quale caso vale per un luogo, un anno e un evento, e cita la fonte.

### Come chiedo la copia dell'atto di nascita di un antenato?

Scrivi all'ufficio che lo conserva: di solito l'Ufficio di Stato Civile del Comune, oppure l'Archivio di Stato per gli atti più antichi. Indica il nome della persona, la data e il luogo dell'evento e, se lo conosci, il numero dell'atto, e specifica che tipo di copia ti serve. Il navigatore trova l'indirizzo e la PEC dell'ufficio e scrive la lettera, che controlli e invii tu.

### Il paese del mio antenato ha cambiato nome o non esiste più. Come lo trovo?

Dal 1861 molti comuni italiani sono stati rinominati, fusi o divisi, e molti paesi sono frazioni di un comune più grande. Chiedi al navigatore il nome antico: trova il comune di oggi, come si chiamava il luogo e a quale provincia apparteneva in un dato anno, dai dati ufficiali ISTAT.

### Cos'è la PEC?

La PEC (posta elettronica certificata) è l'indirizzo che ogni pubblica amministrazione italiana deve avere; le richieste di atti vengono spesso inviate lì. Il navigatore indica la PEC di ogni ufficio come pubblicata in IndicePA, l'indice ufficiale delle pubbliche amministrazioni.

### Fa ricerche sul Portale Antenati o su FamilySearch?

No. Ti dice dove è conservato un atto e a chi chiederlo, ma non cerca immagini o indici di atti su altri siti e non può sapere se un atto è stato pubblicato online.

### È gratuito? Serve un account?

Il connettore è gratuito e non richiede account né accesso. Si usa da Claude, aggiungendolo come connettore personalizzato (vedi [Aggiungilo a Claude](https://archives.fiorfelix.com/it/#aggiungi)). Il codice sorgente è aperto, con licenza MIT.

## Guide

- [Come richiedere l'atto di nascita di un antenato](https://archives.fiorfelix.com/it/guide/richiedere-atto-di-nascita)
- [Atti di stato civile: Comune o Archivio di Stato?](https://archives.fiorfelix.com/it/guide/comune-o-archivio-di-stato)
- [Se il comune del tuo antenato ha cambiato nome](https://archives.fiorfelix.com/it/guide/comune-cambiato-nome)
- [Fogli matricolari e liste di leva: dove trovarli](https://archives.fiorfelix.com/it/guide/fogli-matricolari)

## Contatti

Domande, risposte sbagliate o una regola da correggere: usa il [modulo di contatto](https://archives.fiorfelix.com/it/contatti) oppure apri una segnalazione su [GitHub](https://github.com/fiorfelix/italian-archive-navigator/issues). Il codice sorgente è aperto, con licenza MIT.

### Dire grazie

Il navigatore ti ha aiutato a trovare l'atto di un antenato, o l'ufficio giusto a cui scrivere? Un breve messaggio fa sempre piacere: [invia un ringraziamento](https://archives.fiorfelix.com/it/contatti?topic=thanks). Se vuoi, indica per quale comune o tipo di atto ti è stato utile: aiuta a capire cosa migliorare. Non inserire dati di persone viventi. I messaggi non vengono mai pubblicati senza il tuo permesso.

Italian Archive Navigator è un progetto indipendente. Non è collegato ad Anthropic, al Ministero della Cultura, agli Archivi di Stato, all'ISTAT, all'AgID o all'Esercito Italiano.
