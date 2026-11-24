---
name: family-tree-and-bios
description: Build a family tree and biographies from the research. Use when the user asks for a family tree, a pedigree or descendants chart, biographies or life stories of ancestors, a summary of what has been found about a person or family, or a GEDCOM file for other genealogy software.
---

# Family tree and biographies

Turn the facts found in records into a family tree and short biographies, where every fact
shows its source and how certain it is.

## 1. Gather the facts in `people.yaml`

Keep one `people.yaml` in the archive (see the `organise-archive` skill), following
`references/people-schema.md`. For each person: names as written, sex, the facts (birth or
baptism, marriages, death or burial, occupation, residences), parents, spouses, and for every
fact its source and evidence label:

- `VERIFIED`: read from the original record image;
- `INDEX`: from an index entry, not yet checked against the act;
- `SECONDARY`: from a transcription, book or someone else's tree;
- `INFERENCE`: deduced (for example a birth year from an age);
- `FAMILY_ACCOUNT`: from family memory or papers.

When two sources disagree, keep both facts with their sources and say so; don't pick one
silently. Link people only when the records support it (names, dates, parents and places
agree), and record an uncertain link as `INFERENCE`.

## 2. People who may be alive

Anyone born after 1940, or less than 100 years ago without a known death, is marked
`living: true` and shown only as "Living person", with no details, in the tree, biographies,
presentations and exports. Make a fuller copy only if the user explicitly asks, for their own
private use.

## 3. The tree

- Write the page in `references/tree-template.md` (the HTML inside its code block, unchanged) to
  `outputs/<family>-tree.html` and replace the JSON in the `tree-data` block with the people from `people.yaml` (same fields). The page works offline,
  shows ancestors and descendants of any person, and lists each fact with its label and source.
  Adding `?view=descendants` to the address opens the descendants view.
- One tree per family line, plus a combined one when lines meet.
- In chat, show the same page as an artifact.
- PDF: where a browser is available, print the page to PDF.
- GEDCOM: if asked, export following `references/gedcom.md`, leaving out living people.

## 4. Biographies

Write one Markdown file per person in `outputs/bios/`, following
`references/biography-guide.md`: a short narrative in plain language where every statement has
a footnote with its source and evidence label, uncertainty said plainly, and a list of open
questions and next records to look for (use the connector's `which_records_exist` and
`find_archive_contact` to suggest where).

## 5. Check before sharing

Before the user shares any output, remind them it contains family information, confirm living
people are hidden, and keep the files in their private archive.
