---
name: collect-register-pages
description: Get images of Italian register pages to read. Use when the user wants pages from Portale Antenati, FamilySearch, a State Archive, a diocese or another site, asks how to download or save register images, asks to download pages automatically or in bulk, or wants a list of pages fetched overnight.
---

# Collect register pages

Get the pages the user needs, the proper way for each site. Quality over speed: a slow,
respectful collection is better than a fast one that a site has to block.

## 1. Find the register first

Use the connector's `which_records_exist` and `find_archive_contact` to know which archive and
series hold the year and event, and `register_guide` to know what the register looks like.
Ask the user for the comune, years, register types and surnames.

## 2. Check how the site allows access

Look the site up in `references/sites.md`. For a site not listed, read its terms of use and its
robots.txt before anything else, and check whether images need a login, a CAPTCHA or another
check. Tell the user what you found and the route:

- **Manual:** the site needs a login, shows a CAPTCHA or bot check, excludes the pages in
  robots.txt, or its terms forbid automated access or bulk downloading. This is the case for
  every major Italian register source, including Portale Antenati and FamilySearch.
- **Automated:** when no login or check stands in the way, robots.txt doesn't exclude the pages,
  and the terms allow automated access or say nothing about it. When the terms are silent, tell
  the user so before starting. If the terms are ambiguous and could be read as forbidding it,
  use the manual route.

Never try to get around a login, CAPTCHA, block or limit, and never use another site's or
third-party tool to do so. If access is refused, stop and use the manual route.

On manual-route sites, don't drive the user's browser either: no browser extension, computer
use or other automation paging through the site's viewer, opening pages or taking screenshots
for the user. The user gets the pages themselves; you guide them. Nothing beyond the Claude app
they already use is needed, so never ask them to install Claude Code, a browser extension or
other software for this.

## 3. Manual route

Give the user the steps for that site from `references/sites.md`: where the register is, how
to use the site's own download (or a request to the archive), and exactly how to name and file
each page so the `read-register-pages` and `organise-archive` skills pick it up. For a long list,
make a checklist of the pages to get, with their links, and tick them off as the user adds them.

## 4. Automated route (sites that pass the check above; Claude Code or Cowork on a computer)

The download runs on the user's computer, so it needs Claude Code or Cowork on a computer; no
browser or browser extension is used. In the Claude website or mobile app, give the manual
checklist instead, and mention once that Claude Code or Cowork could download these pages
automatically if the user has one. Don't press them to install anything.

Download with plain HTTP requests (for example `curl`), following every rule below. Show the user
the plan and the commands before the first request.

1. **List first.** Write the list of pages: URL and file name for each
   (`<comune>_<year>_<series>_img<M>.<ext>`). Check the whole list before any request: file names
   use only letters, digits, `.`, `_` and `-`, start with a letter or digit, and none is used
   twice. If one fails, fix the list; download nothing until it passes.
2. **Slowly, one at a time.** One request at a time, at least 5 seconds apart (the user may choose
   more, never less), and longer if the site's robots.txt asks for a crawl delay. Send a
   User-Agent that names the plugin and gives a contact, for example
   `italian-archive-navigator (family-history research; one request at a time; contact: https://archives.fiorfelix.com)`.
3. **Resume, don't repeat.** Skip pages already saved in the register folder, so a stopped run can
   simply start again.
4. **Stop when the site says so.**
   - 401 or 403, or a web page where an image was expected (a login or CAPTCHA page): stop at
     once, don't retry, and tell the user the site refused access. Don't restart that site.
   - 429 or 503: wait as long as the site's Retry-After says, otherwise 1, 2, then 4 minutes;
     after three in a row, stop for the day.
   - Other errors: try a page at most three times, then skip it and note it.
5. **Keep a log.** For each request, record the time, URL, file name, status, size and SHA-256
   checksum in `fetch-log.tsv` in the register folder.
6. Tell the user how long it will take (pages × delay) before starting; it can run overnight.
   Report progress, and if it stops, why.
7. Add the pages to `sources.csv` with their links and licences.

## 5. Then

Hand over to `read-register-pages` to read them, and `organise-archive` to keep them tidy.
