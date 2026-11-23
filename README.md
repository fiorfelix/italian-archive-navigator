# Italian Archive Navigator

A read-only MCP server for Italian family-history research. Given a place and a date, it says
what the place was called and which comune it belonged to, which records exist and who holds
them today, and drafts a letter in Italian to ask for them. Every rule cites its sources, and
answers say when a rule is not yet confirmed from an official source.

**Use it in Claude:** add a custom connector with the address
`https://archives-mcp.fiorfelix.com/mcp` (no sign-in). Instructions, examples, sources and the
privacy policy: https://archives.fiorfelix.com.

The rest of this README is for running or developing the server yourself. By default it runs
locally at `http://127.0.0.1:8788/mcp` and accepts only local requests.

## Setup

Requires Node 26 (LTS). With nvm:

```sh
nvm use            # reads .nvmrc
npm ci
npm run refresh-data   # downloads ISTAT, SITUAS and IndicePA data and builds the database (~1 min)
npm run dev            # starts the server with reload
```

Then connect an MCP client to `http://127.0.0.1:8788/mcp`, or run `npm run inspect` to open MCP
Inspector against it.

| Command                       | What it does                                                  |
| ----------------------------- | ------------------------------------------------------------- |
| `npm run dev`                 | Run the server from source with reload                        |
| `npm run build` / `npm start` | Compile to `dist/` and run it                                 |
| `npm test`                    | Vitest suite (public tests, plus `tests/private/` if present) |
| `npm run check`               | Typecheck, lint, format check, tests                          |
| `npm run inspect`             | Open MCP Inspector against the running server                 |
| `npm run refresh-data`        | Rebuild `data/navigator.sqlite` from the official sources     |

`PORT=xxxx` overrides the port for `dev`, `start` and `inspect`. The host is always 127.0.0.1;
it cannot be changed. The server accepts requests only with a localhost `Host` and `Origin`.

## Tools

All tools are read-only (`readOnlyHint: true`), validate their input, and never send anything.

- `resolve_comune_history`: a place name from any era (former names, suppressed comuni,
  frazioni, census localities), optional province and year → today's comune, its dated changes
  since 1861, and its name and province in that year.
- `find_archive_contact`: comune and office type (`stato_civile`, `archivio_di_stato`,
  `ufficio_documentale_militare`, `diocesi`) → office name, address, PEC, website, source and
  date, or the official directory when no confirmed entry exists. Army documentation offices
  are curated for Lazio, Umbria, Toscana and Marche from each office's own page.
- `which_records_exist`: comune, year and event (`birth`, `marriage`, `death`, `military`) →
  regime in force, records to expect, who holds which copy, fallbacks, and the rule's source and
  `verified` flag. Events under 100 years old, or people born after 1940, go to the Comune.
- `draft_request_letter`: request type and known facts → formal Italian letter with the
  recipient filled in, English summary, attachments checklist and missing fields.
- `register_guide`: comune, year and event → what to expect inside the register (registers and
  volumes, how acts are numbered, where the index is, typical wording), each note marked
  verified or not, and steps for reading it.
- `match_surnames`: surnames read from records and the surnames being looked for → matches with
  a score and the reason (old spelling, different ending, letters that look alike in handwriting).
- `cite_source`: record details and how a fact is known → citation and evidence label
  (VERIFIED, INDEX, SECONDARY, INFERENCE, FAMILY_ACCOUNT).
- `health`: server name, version and uptime.

Name fields reject anything that looks like a web or e-mail address; every text field has a
length limit; request bodies over 100 KB are refused.

## Data sources and licences

`npm run refresh-data` downloads everything from the official publishers and writes
`data/SOURCES.md` with each file's URL, download date, SHA-256 hash and licence. It checks each
source's published column list and licence first, and keeps the previous database if anything
changed or failed.

| Data                                                       | Publisher                                                   | Licence   |
| ---------------------------------------------------------- | ----------------------------------------------------------- | --------- |
| Current comuni, codes, provinces, regions                  | ISTAT, "Codici statistici delle unità amministrative"       | CC BY 4.0 |
| Comune and province history since 17/03/1861               | ISTAT SITUAS public reports 98–114                          | CC BY 4.0 |
| Inhabited localities (frazioni, hamlets)                   | ISTAT Basi territoriali 2021                                | CC BY 4.0 |
| Comuni, State Archives, Defence offices: PEC and addresses | IndicePA (AgID): enti, aoo, unita-organizzative             | CC BY 4.0 |
| Aliases, office mapping, rules, letter templates           | This project (`data/curated/`, `data/rules/`, `templates/`) | —         |
| Army documentation offices (target regions)                | Esercito Italiano, office pages on esercito.difesa.it       | —         |

**Attribution.** Contains data from ISTAT (Istituto Nazionale di Statistica) and from IndicePA
(Agenzia per l'Italia Digitale), licensed under
[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). The data were selected, normalised for
searching and combined into one database; names of office holders are not kept. Neither ISTAT
nor AgID endorses this project.

If the SITUAS service is unavailable, `refresh-data` prints which reports to export by hand into
`data/manual/`.

## Rules

Rules live in `data/rules/it/*.yaml` (one file per historical state) and
`data/rules/it/overrides/` (per-archive exceptions, which win). Each rule has `source_url`,
`verified` and `reviewed_for` (regions it has been reviewed for). Territory is matched on ISTAT
history (province at the first record, date of annexation), not only on today's region.
Unverified rules say so in every answer.

## Letter templates

`templates/it/<request_type>.txt`, between a shared header (`_intestazione.txt`: sender and
recipient blocks) and closing (`_chiusura.txt`), with `{{field}}` placeholders and
`{{#field}}…{{/field}}` optional blocks (which can nest). A required field left empty appears as
`[DA COMPLETARE: …]`. People are listed as `SURNAME Given (di father e di mother, nato a place il
date)`; with `sex` given, Italian agreement follows (nato/nata, Il sottoscritto/La sottoscritta).
Letters can carry the act's banns, supporting papers (allegati), a soldier's rank and register,
the death date (for the 50-year clause in military requests) and up to eight further facts.

## Privacy

See `PRIVACY.md`. In short: no accounts, no stored personal data, and logs that hold only the
tool name, timing and an error code.

## Public mode

By default the server runs locally as above. Setting `PUBLIC_HOST` to a host name switches it
to public mode, for running behind a hosting service that provides HTTPS:

| Setting                        | Meaning                                                    |
| ------------------------------ | ---------------------------------------------------------- |
| `PUBLIC_HOST`                  | The public host name; requests for any other name get 403  |
| `PORT`                         | Port to listen on (the host sets it)                       |
| `RATE_LIMIT_GLOBAL_PER_MINUTE` | Requests per minute for all clients together (default 600) |
| `RATE_LIMIT_CLIENT_PER_MINUTE` | Requests per minute from one address (default 120)         |

The server then listens on all interfaces, answers `GET /healthz` with `ok`, and refuses
requests over the limits with HTTP 429. `render.yaml` deploys it on Render.
`npm run usage-summary -- <log file>` prints calls per tool, error codes and response times
from saved logs.

## Claude plugin

`plugin/` is the Claude plugin: a manifest (`.claude-plugin/plugin.json`), an icon, the
connector entry (`.mcp.json`) and a skill (`skills/italian-records-research/`) that tells Claude
how to use the tools in order. The connector entry points to the public server,
`https://archives-mcp.fiorfelix.com/mcp`.

```sh
claude --plugin-dir ./plugin                          # try it in Claude Code
claude plugin validate ./plugin --profile directory   # directory checks
```

## License

MIT, see `LICENSE`.

## Private tests

`tests/private/` is git-ignored. It is for tests built from your own letters; `npm test` runs
them when present.
