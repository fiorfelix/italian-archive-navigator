# Archive layout reference

## Example (invented family and places)

```
rossi-family/
  README.md
  sources.csv
  acts.csv
  people.yaml
  registers/
    montefiore/nati/montefiore_1880_nati_img045.jpg
    montefiore/matrimoni/montefiore_1905_matrimoni_img012.jpg
  indexes/
    montefiore/montefiore_1880_nati_index_img098.jpg
    montefiore/montefiore_1880_nati_index_img098.txt
  acts/
    montefiore/montefiore_1880_nati_act45_img046_body.jpg
    montefiore/montefiore_1880_nati_act45_img046_margin.jpg
    montefiore/montefiore_1880_nati_act45.txt
  letters/
    sent/2026-11-20_comune-montefiore_copia-integrale.txt
    replies/2026-12-05_comune-montefiore_reply.pdf
  outputs/
    rossi-tree.html
    bios/rossi-giuseppe-1880.md
```

## sources.csv columns

| Column         | Content                                                                     |
| -------------- | --------------------------------------------------------------------------- |
| `source_id`    | short id, e.g. `montefiore-1880-nati`                                       |
| `archive`      | holder, e.g. `Archivio di Stato di …` or `Comune di …`                      |
| `fonds_series` | e.g. `Stato civile italiano, Nati`                                          |
| `comune`       | comune of the register                                                      |
| `year`         | year or range                                                               |
| `link`         | link to the source in its own viewer or catalogue, if any                   |
| `obtained`     | `user_download`, `automated_download`, `photograph`, `office_copy`, `other` |
| `obtained_on`  | date (yyyy-mm-dd)                                                           |
| `files`        | file names or folder                                                        |
| `notes`        | anything else (missing pages, poor quality)                                 |

## acts.csv columns

| Column                                 | Content                                                                |
| -------------------------------------- | ---------------------------------------------------------------------- |
| `act_id`                               | e.g. `montefiore-1880-nati-45`                                         |
| `event`                                | `birth`, `marriage`, `death`, `banns`, `military`, `baptism`, `burial` |
| `comune`, `year`, `act_number`, `date` | as in the record (`date` as yyyy-mm-dd if known)                       |
| `person`                               | surname and given names as written                                     |
| `father`, `mother`                     | as written (`fu` = deceased)                                           |
| `place`                                | locality or house, if given                                            |
| `source_id`                            | row in `sources.csv`                                                   |
| `files`                                | image and transcription file names                                     |
| `transcription_status`                 | `none`, `partial`, `complete`, `checked` (checked by the user)         |
| `confidence`                           | `high`, `medium`, `low`                                                |
| `evidence`                             | `VERIFIED`, `INDEX`, `SECONDARY`, `INFERENCE`, `FAMILY_ACCOUNT`        |
| `citation`                             | from the `cite_source` tool                                            |
| `notes`                                | marginal notes, doubts, cross-references                               |

## README.md (archive) template

```markdown
# <Family or project name>

Surnames researched: …
Places: …
Started: <date>

## What's where

(see the layout above)

## Privacy

This archive contains family information. Keep it private. People who may be alive are recorded
but not included in anything shared.

## Change log

- <date>: <what was added>
```
