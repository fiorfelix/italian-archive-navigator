# people.yaml schema

One file per project. The tree template's JSON uses the same fields.

```yaml
title: Rossi family
root: p1 # the person the tree starts from
people:
  - id: p1 # short, stable id
    given: Giuseppe # given names as written
    surname: Rossi # surname as written
    sex: M # M, F or omit
    living: false # true hides all details (born after 1940, or <100 years, no death)
    parents: [p2, p3] # ids; father first when known
    spouses: [p4]
    facts:
      # type: birth, baptism, marriage, death, burial, occupation, residence, military,
      # emigration or note
      - type: birth
        date: 1880-03-05 # yyyy-mm-dd, yyyy-mm, yyyy, "about 1855", "before 1876", "after 1890"
        place: Montefiore
        value: '' # for occupation, residence, note
        evidence: VERIFIED # VERIFIED, INDEX, SECONDARY, INFERENCE, FAMILY_ACCOUNT
        source: 'Comune di Montefiore, Nati 1880, atto n. 45' # citation (cite_source)
        act_id: montefiore-1880-nati-45 # row in acts.csv, if any
    bio: bios/rossi-giuseppe-1880.md
    notes: 'Two Giuseppe Rossi born in 1880 in the same comune: check parents.'
```

Rules:

- Names exactly as in the records; alternative spellings go in `notes`.
- A fact without a source is `FAMILY_ACCOUNT` or `INFERENCE`, never `VERIFIED`.
- Conflicting facts: two entries of the same `type`, each with its own source.
