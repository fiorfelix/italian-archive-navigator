---
name: family-presentation
description: Create a slide presentation about a family line or an ancestor from the research. Use when the user asks for slides, a presentation, a deck or a slideshow about their family history, for example to show relatives, and when they want it in Google Slides.
---

# Family-history presentation

Present what the research found, clearly and honestly, for relatives or friends.

## 1. Where to build it

- **Google Drive connected** (the user's own Google Drive or Google Slides connector): build a
  Google Slides presentation in the user's Drive, in the project's `outputs/` folder if the
  archive is mirrored there. Create it **private**; ask before sharing it or changing who can
  see it.
- **Otherwise:** use the slide format this Claude app offers (a slides artifact, or a .pptx file
  in Claude Code or Cowork), saved in the archive's `outputs/` folder.

Tell the user which one you're using before starting.

**Record images in Google Slides.** The Slides connector can only add images from a public web
address, and the archive's images are private. Don't make them public to get around this. Where
you can run code (Claude Code, Cowork), build the deck as a .pptx with the images in it and
upload it through the Google Drive connector, which converts it to Google Slides; then check the
converted deck (export it as PDF and look at each slide). Otherwise build the slides with a
captioned space for each image, and tell the user to add the images in Slides (Insert, Image,
Drive) from the archive folder.

## 2. Content

Build from `people.yaml`, the biographies and the archive's images (see the
`family-tree-and-bios` skill), following `references/deck-outline.md`. Ask the user which
family line or person, how many slides (default about 10–15), and the language (the user's
language; Italian terms such as "atto di nascita" kept where useful).

- Use only images from the user's own archive (record crops, photos they provided), each with a
  caption giving its source.
- Every fact keeps its certainty: say "probably" or "according to the family" where the evidence
  label is INFERENCE or FAMILY_ACCOUNT. Don't round uncertain facts into certain ones.
- People who may be alive are not shown (see the living-people rule in `family-tree-and-bios`).
- End with what is still unknown and where to look next.

## 3. Before handing over

Check names, dates and places against `people.yaml`, confirm no living person's details appear,
and remind the user that the deck contains family information before they share it.
