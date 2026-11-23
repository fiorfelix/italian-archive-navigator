# GEDCOM export

GEDCOM is the common exchange format for genealogy software. Export version 5.5.1 (the most
widely supported) as UTF-8 text, from `people.yaml`:

```
0 HEAD
1 SOUR ITALIAN_ARCHIVE_NAVIGATOR
1 GEDC
2 VERS 5.5.1
2 FORM LINEAGE-LINKED
1 CHAR UTF-8
0 @I1@ INDI
1 NAME Giuseppe /Rossi/
1 SEX M
1 BIRT
2 DATE 5 MAR 1880
2 PLAC Montefiore
2 SOUR Comune di Montefiore, Nati 1880, atto n. 45
3 QUAY 3
1 FAMC @F1@
0 @F1@ FAM
1 HUSB @I2@
1 WIFE @I3@
1 CHIL @I1@
0 TRLR
```

- Dates in GEDCOM form (`5 MAR 1880`, `ABT 1855`, `1880`).
- Evidence labels as `QUAY`: VERIFIED 3, INDEX 2, SECONDARY 2, INFERENCE 1,
  FAMILY_ACCOUNT 0; keep the label itself in a `NOTE`.
- Leave out people marked `living: true` (or include them only as `NAME Living /Surname/`
  with no events, if the user wants the structure).
