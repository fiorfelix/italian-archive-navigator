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
  robots.txt, forbids automated access, or its terms are unclear. This is the case for every
  major Italian register source, including Portale Antenati and FamilySearch.
- **Automated:** only when the terms clearly allow it, robots.txt doesn't exclude the pages,
  and no login or check stands in the way.

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

## 4. Automated route (allowed sites only; Claude Code or Cowork on a computer)

1. Make a list file of the pages: one line each, the page URL, a tab, and the file name
   (`<comune>_<year>_<series>_img<M>.<ext>`).
2. Run `scripts/fetch-pages.sh LIST DEST [DELAY] [CONTACT]` from this skill's folder
   (`${CLAUDE_SKILL_DIR}/scripts/fetch-pages.sh`). DEST is the register folder in the archive.
   - It waits at least 5 seconds between requests (the user may choose more, never less), and
     longer if the site's robots.txt asks for a crawl delay: pass that as DELAY.
   - It handles one request at a time, skips pages already saved, and logs each file with its
     checksum in `DEST/fetch-log.tsv`.
   - On 429 or 503 it waits as the site asks, then backs off; after three in a row it stops for
     the day. On 401, 403 or a login or CAPTCHA page it stops at once.
3. Tell the user how long it will take (pages × delay) before starting; it can run overnight.
   Report progress, and if it stops, why. Don't restart a site that refused access.
4. Add the pages to `sources.csv` with their links and licences.

## 5. Then

Hand over to `read-register-pages` to read them, and `organise-archive` to keep them tidy.
