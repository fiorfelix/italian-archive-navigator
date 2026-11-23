---
name: read-register-pages
description: Read and transcribe pages of Italian civil, parish or military registers and find given surnames in them. Use when the user attaches register page images, points to a folder of register images, asks to find a surname or an ancestor in a register, asks to transcribe or translate an Italian birth, marriage, death, banns, baptism or military record, or wants an index page read.
---

# Read Italian register pages

Find the user's surnames in register pages, transcribe the matching acts carefully, and give
every result with its page reference so the user can check it against the image. Accuracy
matters more than speed: read slowly, never guess, and say when something is unclear.

## Before reading

1. Ask (or confirm) the **surnames** the user is looking for and, if known, given names,
   approximate dates and the comune. Propose spelling variants (doubled letters, j for i,
   endings -i/-e/-o/-a) and let the user confirm them.
2. Identify the register: comune, year, register type (births, marriages, deaths, banns;
   baptisms, marriages, burials for parish books; conscription lists or service registers).
   If the images don't say, ask.
3. Call the connector's `register_guide` tool with the comune, year and event. It says how such
   registers are laid out (index, numbering, margins) and which notes are confirmed. If the
   connector isn't available, follow the general steps below.

## Index first (default)

1. Look for the index: usually the last pages of each yearly volume (an alphabetical list of
   surnames with act numbers), or a separate ten-year index.
2. Transcribe the index entries for the relevant letters of the alphabet. Compare every surname
   read with the user's surnames, using the connector's `match_surnames` tool when available
   (it tolerates old spellings and letters that look alike), or the same rules yourself.
3. List the matches with their act numbers, and the near-matches marked as uncertain.
4. Read only those acts. Act numbers run in order through the volume, so estimate the page and
   adjust.

## Full reading

Use when there is no index, it's unreadable, or the user asks. Read the acts in order and note
progress (pages done of total) so a long reading can be resumed. On Claude Code or Cowork, keep
a progress file in the archive (see the `organise-archive` skill).

## Reading each act

See `references/reading-guide.md` for typical wording, abbreviations, numbers and dates in
words, and Latin in parish books.

- Read the margins as well as the body: the act number and the name are usually in the margin,
  and later events (marriage, death, recognition, corrections) are noted there.
- Write `[illeggibile]` for anything you can't read, and `[?]` after a doubtful word. Don't fill
  gaps with likely names or dates.
- Give each field a confidence: `high` (clearly legible), `medium` (legible with some doubt),
  `low` (partly guessed from context: say so).

### Doubtful words: a second pass

After a first reading, go back over every `[?]` and every name:

- **Enlarge the word.** Crop the line (or the word) and enlarge it 3–5 times before deciding.
  Most doubtful names and numbers become clear this way.
- **Check the image is clean.** Screenshots of an online viewer can carry buttons, tooltips or
  the mouse pointer over the text. If something covers a word, write `[coperto]` and ask the
  user for a clean image (pointer moved away, or the site's own download).
- **Don't carry names across lines.** A name already read elsewhere on the page (the mayor, a
  witness, the other parent) is easy to repeat by mistake. Read each name from its own place.
- **Separate print from hand.** On printed forms, only the handwritten parts are the record;
  the printed words tell you what each blank means.
- **Compare with the index.** The index and the margin should agree with the body; if they
  don't, report both.

## Output

For every act found, use the format in `references/output-format.md`: the fields, a short
transcription of the key passage, confidence per field, the page reference (file name and the
link to the page in its source), and a citation from the connector's `cite_source` tool with
the evidence label (`VERIFIED` when read from the original image).

Then offer to save the results in the archive (`organise-archive`): the transcription next to
the image, a row in `acts.csv`, and the people and facts in `people.yaml`.

## Ground rules

- The images come from the user: their own downloads, photographs, or copies from an office.
  If they ask for pages from a site, use the `collect-register-pages` skill.
- A surname match is not proof of a family link. Say so, and check dates, parents and places
  before linking a record to a person.
- Records of people who may be alive (events less than 100 years ago, or people born after 1940) are the Comune's to release; don't go looking for them.
