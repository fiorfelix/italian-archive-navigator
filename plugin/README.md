# Italian Archive Navigator

A plugin for Italian family-history research. It pairs the Italian Archive Navigator MCP
connector with a skill that tells Claude how to use it. Ask where an ancestor's birth, marriage,
death or military record is kept, and Claude finds what the place was called and which comune it
belonged to in that year, which records exist and which office holds each copy today, gives the
office's address and PEC, drafts the request letter in Italian, and formats a citation for what
you find.

## Use it

Ask a question such as:

- "My great-grandfather was born in Corneto in 1880. Where is his birth record?"
- "Which archive has the 1895 marriage records of Orvieto?"
- "Write the letter to ask the State Archive for that marriage act and its supporting papers."
- "Where are the military service records for a man born in Pescia in 1890?"

Answers say which rule they rest on and whether that rule is confirmed from an official source.
Coverage is deepest for Lazio, Umbria, Toscana and Marche.

## Skills

| Skill                       | What it does                                                                                                                                                    |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Italian records research    | Finds the place, the records and the office, and drafts the request letter                                                                                      |
| Read register pages         | Reads pages you provide: index first, spelling-tolerant surname matching, careful transcription with confidence marks and a citation for each act               |
| Collect register pages      | Explains how to get pages from each site the proper way (manual for Antenati, FamilySearch and archives), and downloads slowly from the few sites that allow it |
| Organise the archive        | Keeps pages, transcriptions, letters and results in one tidy folder on your computer, mirrored to your Google Drive if connected                                |
| Family tree and biographies | A tree that opens offline and short biographies, every fact with its source and certainty; optional GEDCOM export                                               |
| Family presentation         | A slide deck about a family line, in Google Slides if your Drive is connected                                                                                   |

Readings are done by your own Claude, in your conversation. People who may be alive (born after
1940, or less than 100 years ago without a death record) are never shown in trees, biographies
or presentations.

## What it runs and sends

- The plugin is text only: skills written in Markdown, with no scripts, hooks or local servers.
  When you ask Claude Code or Cowork to download register pages, the `collect-register-pages`
  skill has Claude do it only from sites with no login or bot check, whose robots.txt doesn't
  exclude the pages and whose terms allow automated access or say nothing about it: one page at a
  time, at least 5 seconds apart, with a User-Agent naming the plugin and a contact address,
  stopping if a site refuses access or asks it to slow down repeatedly, and saving the pages and a
  log in your own archive folder. Nothing else is sent anywhere.
- The connector entry in `.mcp.json` points to the Italian Archive Navigator MCP server. Claude
  sends that server the details of your question (place, year, event, and, for a letter, the
  names and contact details you give). The server only reads its own copy of public data; it
  makes no outgoing requests while answering and sends nothing anywhere.
- Letters are returned as text. Nothing is sent to any office; you send the letter yourself.

## Status

The connector runs at `https://archives-mcp.fiorfelix.com/mcp`, so the plugin works in Claude
chat, Cowork and Claude Code. To run the server on your own computer instead, see the
project README.

## Data sources

ISTAT (comuni, their history since 1861, and inhabited localities) and IndicePA (office contacts
and PEC), both under CC BY 4.0; the Guida generale degli Archivi di Stato and other official
sources for the rules, each cited in the answers.

## Privacy Policy

Full policy: https://archives.fiorfelix.com/privacy

- **Collection:** the server receives only what Claude sends in a tool call. It asks for no
  account and no sign-in.
- **Use and storage:** request contents are used only to produce that answer and are not
  stored: not in a database, files or logs. Logs record the tool name, timing, success and an
  error code only.
- **Sharing:** nothing is shared with third parties; the server makes no outgoing requests while
  answering.
- **Retention:** request contents are not retained. Logs are kept for at most 30 days.
- **Network addresses:** used only for rate limiting, held in memory for at most one minute,
  never logged.
- **Contact:** https://archives.fiorfelix.com/contact
