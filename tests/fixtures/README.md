# Test fixtures

Small extracts of public data, so the public test suite runs without network access.

- `istat_comuni_rows.json`: header plus 13 rows of the ISTAT "Elenco dei comuni italiani".
- `situas/r<id>.json`, `situas/m<id>.json`: rows and column metadata of SITUAS public reports
  98, 100, 103, 104, 105 (comuni around Viterbo, Castro, Bolzano, Briga Marittima) and 112–114.
- `localita_2021.tsv`: rows of the ISTAT 2021 census locality file for the same comuni.
- `indicepa/`: rows of the IndicePA "enti", "aoo" and "unita-organizzative" datasets and their
  data dictionaries. Names of office holders and non-PEC addresses were removed.

Sources: ISTAT and IndicePA (AgID), licensed under CC BY 4.0. Apart from the removals above,
rows were selected, not changed. `aliases.yaml` and `offices.yaml` here are test fixtures,
not curated data.
