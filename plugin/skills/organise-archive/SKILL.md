---
name: organise-archive
description: Set up and keep a tidy family-history archive. Use when the user starts researching a family, asks where to save register pages, transcriptions, letters or results, wants their research organised, backed up or moved to Google Drive, or when another step (reading pages, building a tree) needs to save files.
---

# Organise the family-history archive

Keep everything the research produces in one predictable place, so pages, transcriptions,
letters and results can be found again and checked against their sources.

## 1. Decide where the archive lives

- **On the computer** (Claude Code, or Cowork on the computer): always keep a local folder.
  Ask the user where; suggest `~/family-history/<project>` if they have no preference.
- **Google Drive:** if the user has the Google Drive connector, keep a mirror of the archive in
  their Drive as well (a folder with the same layout), and say so. Create it as a **private**
  folder. Never share it or move it into a shared drive without the user asking.
- **In chat** (no local folder): use Google Drive if connected; otherwise say that nothing is
  being saved, that results stay in this conversation, and suggest connecting Google Drive.

## 2. Layout

Create this layout (see `references/archive-layout.md` for details and examples):

```
<project>/
  README.md        what is where, the surnames and places being researched, privacy note
  sources.csv      one row per register or document used
  acts.csv         one row per act found
  people.yaml      the people and facts found (used for the tree and biographies)
  registers/<comune>/<series>/   page images as obtained
  indexes/<comune>/              index pages and their transcriptions
  acts/<comune>/                 crops and transcriptions of individual acts
  letters/sent/  letters/replies/
  outputs/                       trees, biographies, presentations
```

## 3. Naming

Use lowercase names without spaces, with Italian series names (`nati`, `matrimoni`, `morti`,
`pubblicazioni`, `leva`, `ruoli`):

- act images: `<comune>_<year>_<series>_act<N>_img<M>_<part>.<ext>`, where `part` is `head`,
  `body`, `margin`, `witnesses` or `end` when a page is cropped;
- index pages: `<comune>_<years>_<series>_index_img<M>.<ext>`;
- transcriptions: the same stem with `.txt`, next to the image.

`img<M>` is the image number in the source (for example the viewer's page number), so the user
can find the original again.

## 4. Keep the tables current

- Every time a page or document is added, add a row to `sources.csv`: where it came from (link
  to the page in the source's own viewer, archive, fonds, series, year), how it was obtained
  (downloaded by the user, automated download, photograph, received from an office), the date,
  and the file names.
- Every time an act is found, add a row to `acts.csv` (columns in the reference), with the
  citation from the connector's `cite_source` tool and the evidence label.
- Never overwrite a file silently. If a better copy of a page arrives, keep both and note which
  is which.

## 5. Privacy and safety

- Family data stays in the user's own folder and Drive. Don't upload it anywhere else, and don't
  put it in public places (public repositories, shared links) unless the user asks.
- People who may be alive (born after 1940, or less than 100 years ago without a death record)
  are kept private: record them, but leave their details out of anything shared.
- Suggest a backup when the archive grows: the Drive mirror, or a dated archive file.
- Keep a short change log at the end of `README.md` (date, what was added).
