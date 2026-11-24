---
title: "Italian Archive Navigator · Find Italian birth, marriage and death records"
description: "Find where an Italian ancestor's birth, marriage, death or military record is kept today, the office's address and PEC, and a request letter in Italian. A free connector for Claude."
url: https://archives.fiorfelix.com/
language: en
updated: 2026-11-24
---

# Find where an Italian ancestor's record is kept, and ask for it

A read-only connector for Claude. Ask about a place, a year and an event, and Claude finds what the place was called and which comune it belonged to, which records exist and which office holds each copy today, gives that office's address and PEC, drafts the request letter in Italian, and formats a citation for what you find.

## Add it to Claude

Two clicks to copy and open, then paste. It takes under a minute.

On a phone? Adding is easiest on a computer: open claude.ai in any browser there and follow these steps. The connector then appears in the Claude app on your phone too.

`https://archives-mcp.fiorfelix.com/mcp`

[Open Claude's connector settings ↗](https://claude.ai/customize/connectors)

1. Click **+ Add**, then **Add custom connector**.
2. Name: `Italian Archive Navigator`. Paste the address in the URL field.
3. Choose **No sign-in** (if asked), then **Add**. Done.

Then, in a new chat, ask a question such as "Where is the 1880 birth record for Montefiore dell'Aso kept?". Add it once on the Claude website or desktop app and it also works in the Claude mobile apps. On Team and Enterprise plans, an Owner adds it under Organization settings, Connectors. No account is needed, and nothing is ever sent on your behalf.

**Using Claude Code?**

`claude mcp add --transport http italian-archive-navigator https://archives-mcp.fiorfelix.com/mcp`

## Recommended setup

Finding places, records, offices and request letters works in any Claude app, on any device, including the phone. Reading register pages works everywhere too: attach the page images to the chat.

For a full family-history project, the best setup is Claude on a computer (your own or a remote one) with **Claude Code** or **Cowork**. There, Claude can also:

- keep your register pages, transcriptions and notes in a folder on your computer;
- download register pages automatically from sites that allow it, slowly and one page at a time (sites with a login or bot check, such as Portale Antenati, stay manual);
- create the family tree, the biographies and the presentation as files.

## What to ask

- "My great-grandfather was born in Corneto in 1880. Where is his birth record?"
- "Which archive has the 1895 marriage records of Orvieto?"
- "Where would a baptism from Perugia in 1840 be recorded?"
- "Which Army office holds the service record of a soldier born in Pescia in 1890?"
- "Write the letter asking the Comune for a full copy of that birth act."
- "How should I cite birth act no. 45 of 1880 that I found in the archive's index?"

## What it does

| Tool | What you get |
| --- | --- |
| Place history | Today's comune for any place name since 1861 (former names, merged comuni, hamlets), with its name and province in a given year. |
| Which records exist | The registration system in force (Napoleonic, pre-unification states, Italian civil registration from 1866, parish registers, military records), what to expect, and who holds each copy today. |
| Archive contact | Name, address and PEC of the Comune, State Archive or Army documentation office, from official sources. |
| Request letter | A formal letter in Italian with an English summary and a checklist of attachments. Returned as text: you review it and send it yourself. |
| Register guide | What to expect inside a register: how acts are numbered, where the index is, typical wording, and steps for reading it. |
| Surname matching | Finds your surnames among names read from records, allowing for old spellings and letters that look alike in handwriting. |
| Citation | One consistent citation format, with a label for how reliable the evidence is. |

## Coverage and limits

- Coverage is deepest for **Lazio, Umbria, Toscana and Marche**. Place history and office contacts cover all of Italy.
- Every rule cites its source. Rules not yet confirmed from an official source are marked **unverified** in every answer, so you know to check with the office.
- It does not search Portale Antenati, FamilySearch or other websites, and it can't tell whether a record has been put online.
- It does not look up living people. Records of events less than 100 years old, or of people born after 1940, are left to the Comune, which decides what it can release.
- Fees and response times are never stated: the letters ask the office for them.

## Sources

- Comuni, their history since 1861 and inhabited localities: [ISTAT](https://www.istat.it/) (Istituto Nazionale di Statistica).
- Office addresses and PEC: [IndicePA](https://www.indicepa.gov.it/) (Agenzia per l'Italia Digitale), and the Italian Army's pages for its documentation offices.
- Record rules: the *Guida generale degli Archivi di Stato italiani*, archive inventories, and the laws themselves on Normattiva, each cited in the answer.

Contains data from ISTAT and IndicePA, licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). The data were selected, normalised for searching and combined into one database; names of office holders are not kept. Neither ISTAT nor AgID endorses this project.

## Questions and answers

### Where are Italian birth, marriage and death records kept?

Italian civil registration (from 1866 in most of Italy, earlier where Napoleonic or pre-unification registration existed) was written in two copies. One copy stays with the Comune's civil registry office (Ufficio di Stato Civile). The other went to the local court and, for older years, is usually now at the State Archive (Archivio di Stato) of the province. Baptisms, marriages and burials before civil registration are in parish registers, kept by the parish or the diocesan archive. The navigator says which applies for a given place, year and event, and cites the source.

### How do I ask for a copy of an ancestor's birth record from Italy?

Write to the office that holds it: usually the Comune's Ufficio di Stato Civile, or the State Archive for older records. Give the person's name, the date and place of the event, and the act number if you know it, and say what kind of copy you need. The navigator finds the office's address and certified e-mail (PEC) and drafts the letter in Italian, with an English summary, for you to review and send yourself.

### My ancestor's town has changed its name or no longer exists. How do I find it?

Many Italian comuni have been renamed, merged or split since 1861, and many villages are hamlets (frazioni) of a larger comune. Ask the navigator about the old name: it finds today's comune, what the place was called and which province it belonged to in a given year, from ISTAT's official records.

### What is a PEC address?

PEC (posta elettronica certificata) is the certified e-mail that Italian public offices must have; requests for records are often sent to it. The navigator gives each office's PEC as published in IndicePA, the official index of Italian public administrations.

### Does it search Portale Antenati or FamilySearch?

No. It tells you where a record is kept and who to ask, but it does not search record images or indexes on other websites, and it can't tell whether a record has been put online.

### Is it free? Do I need an account?

The connector is free and needs no account or sign-in. You use it from Claude, by adding it as a custom connector (see [Add it to Claude](https://archives.fiorfelix.com/#add)). The source code is open under the MIT licence.

## Guides

- [How to request an Italian ancestor's birth record](https://archives.fiorfelix.com/guides/request-italian-birth-record)
- [Italian civil records: Comune or State Archive?](https://archives.fiorfelix.com/guides/comune-or-state-archive)
- [When your ancestor's Italian town changed its name](https://archives.fiorfelix.com/guides/italian-town-name-changes)
- [Italian military service records: where to find them](https://archives.fiorfelix.com/guides/italian-military-records)

## Contact

Questions, wrong answers or a record rule that needs correcting: use the [contact form](https://archives.fiorfelix.com/contact) or open an issue on [GitHub](https://github.com/fiorfelix/italian-archive-navigator/issues). The source code is open, under the MIT licence.

### Say thank you

Did the navigator help you find an ancestor's record, or the right office to write to? A short note is always welcome: [send a thank-you](https://archives.fiorfelix.com/contact?topic=thanks). If you like, tell us which comune or kind of record it helped with; it shows which parts are worth improving. Please leave out details of living people. Messages are never published without your permission.

Italian Archive Navigator is an independent project. It is not affiliated with Anthropic, the Italian Ministry of Culture, the Archivi di Stato, ISTAT, AgID or the Italian Army.
