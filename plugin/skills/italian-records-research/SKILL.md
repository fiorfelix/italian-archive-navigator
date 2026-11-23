---
name: italian-records-research
description: Research Italian ancestors' records. Use when the user asks where an Italian birth, marriage, death or military record is kept, what an Italian town was called or which comune it belonged to in a given year, which archive or office to write to, how to request a record from an Italian Comune, State Archive (Archivio di Stato), parish or Army office, or how to cite an Italian record.
---

# Italian records research

The Italian Archive Navigator connector answers from official open data (ISTAT, IndicePA) and
from rules that cite their sources. Work through the steps that the question needs, in this
order, and report what each answer is based on.

## 1. Pin down the place

Call `resolve_comune_history` with the place name as the user gave it, the year if known, and
the province if known.

- Old names, frazioni and suppressed comuni are expected: the answer gives today's comune and
  the name and province in that year. Tell the user both.
- If the answer is ambiguous, show the candidates and ask which one, or ask for the province.
  Don't pick one yourself.
- If a note says the name was also another comune's former name, mention it.

## 2. Find out which records exist and who holds them

Call `which_records_exist` with the comune (or its ISTAT code), the year and the event
(`birth`, `marriage`, `death` or `military`; for military, the year is the birth class).

- Report the regime, the records to expect, and each holder (Comune, State Archive, parish,
  diocese, Army office), with any fallbacks.
- If `rule.verified` is false, say plainly that this rule is not yet confirmed from an official
  source and should be checked with the office.
- If `archive_series` shows the year as missing or outside the range, say so before suggesting
  that archive.
- If `routed_to_comune` is true, explain that the record may concern a living person or a
  recent event, that the Comune decides what it can release, and stop there unless the user
  asks for the letter to the Comune.
- If `also_consider` lists other regimes (a year when the rules changed), mention them.

## 3. Get the office's contact

Call `find_archive_contact` with the comune and the office type (`stato_civile`,
`archivio_di_stato`, `ufficio_documentale_militare` or `diocesi`). Give the name, address and
PEC. If the result is a directory rather than an office, give the directory link and say that
the specific office has to be looked up there.

## 4. Draft the request letter, if the user wants one

Call `draft_request_letter` with the request type and everything the user has told you: the
person (names, parents, birth and death places and dates, sex for Italian agreement), the
event, the act number and banns if known, and the requester's details.

- Ask for the details listed in `missing_fields` that the user can supply, then draft again.
  Leave the rest marked `[DA COMPLETARE: …]`.
- Show the Italian letter, the English summary, the attachments checklist and the notes.
- The letter is returned as text. The user sends it; never say it has been sent.
- Don't add fees or response times; the letter asks the office for them.

## 5. Reading the records themselves

When the user has register pages (downloaded, photographed or received), use the
`read-register-pages` skill, with the connector's `register_guide` (what to expect inside the
register) and `match_surnames` (spelling-tolerant surname matching). To get pages, see
`collect-register-pages`; to keep everything organised, `organise-archive`; for results, a tree
and biographies (`family-tree-and-bios`) or slides (`family-presentation`).

## 6. Cite what the user finds

When the user reports a record they found or were sent, call `cite_source` with the archive,
fonds or series, comune, year, record type, act number, link and access date, and how they saw
it (`seen_as`). Give the citation and the evidence label.

## Ground rules

- Base every statement about archives, holdings and dates on the tools' answers. If the tools
  don't cover something, say that it isn't covered rather than guessing.
- Say when an answer rests on a rule or contact marked `verified: false`.
- The connector doesn't search Portale Antenati, FamilySearch or other sites. The user can
  browse those themselves; don't claim that a record is or isn't online.
- Personal details the user gives are used only to fill in the letter.
