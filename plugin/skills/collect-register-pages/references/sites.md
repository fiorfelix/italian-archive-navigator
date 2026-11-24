# Sites and how to get pages from them

Checked November 2026 (terms pages and robots.txt read; register images not downloaded).
Terms change: if a site's page says something different now, follow the site.

**Summary:** the big sources of Italian civil, parish and military register images all need the
manual route. Automated download is possible on sites marked "automated OK", and on any other
site that passes the check in `SKILL.md` (no login or check, robots.txt doesn't exclude the
pages, terms allow it or say nothing about it). Check each site afresh; don't assume.

| Site                                              | Holds                                                  | Route                            | Why                                                                                                                                                            |
| ------------------------------------------------- | ------------------------------------------------------ | -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Portale Antenati (antenati.cultura.gov.it)        | State Archives' civil registers, some military lists   | **Manual**                       | Downloads need a login (User Area); permitted uses are limited ([image use](https://antenati.cultura.gov.it/information-on-the-use-of-portal-images/?lang=en)) |
| FamilySearch                                      | Italian civil and parish registers                     | **Manual**                       | Login required; personal, non-commercial use ([terms](https://www.familysearch.org/en/legal/terms))                                                            |
| State Archives' own sites (archivi di Stato)      | Inventories, some digitised series                     | **Manual**, or ask the archive   | Terms vary; reuse beyond free uses may need a concession                                                                                                       |
| Diocesan and parish archives                      | Parish registers                                       | **Manual**, or ask the archive   | Often viewing only, sometimes registration                                                                                                                     |
| Kirchenbücher Südtirol (findbuch.net)             | Bozen-Brixen parish registers 1565–1923                | **Manual** (view online)         | robots.txt excludes the viewer ([robots.txt](https://www.xn--kirchenbcher-sdtirol-wecg.findbuch.net/robots.txt))                                               |
| Opera di Santa Maria del Fiore (duomo.firenze.it) | Florence baptisms 1450–1900                            | **Manual** (view online)         | robots.txt excludes the viewer pages ([robots.txt](https://duomo.firenze.it/robots.txt))                                                                       |
| Internet Archive (archive.org)                    | Printed genealogies and gazetteers; very few registers | **Automated OK** with conditions | Bulk download documented ([guide](https://help.archive.org/help/downloading-a-basic-guide/)); each item has its own licence                                    |
| Wikimedia Commons                                 | A few individual acts, no register series              | **Automated OK** with conditions | API etiquette: serial requests, descriptive User-Agent ([etiquette](https://www.mediawiki.org/wiki/API:Etiquette))                                             |

## Manual routes

**Portale Antenati.** Find the register in the portal (archive → fonds → comune → year → type).
Sign in to the User Area and use the portal's own download for the pages you need, within its
permitted uses. Save each page into the archive as
`registers/<comune>/<series>/<comune>_<year>_<series>_img<M>.jpg`, where `M` is the image number
shown in the viewer, and add a row to `sources.csv` with the viewer link for that page.

**FamilySearch.** Sign in, open the image, and use its own download or print where offered, for
personal use. Name and log the file as above, with the image link.

**State Archives, dioceses, parishes, Comuni.** Ask for reproductions in writing (the connector's
`draft_request_letter` drafts the letter for a Comune or State Archive; ask about fees and
formats), or photograph in the reading room where the archive allows it, under its rules.

**Sites with a viewer but no download.** Read on screen, write down the reference (archive,
series, year, act, image number, link) and request a copy from the holder if needed.

## Automated route (sites marked "automated OK", or that pass the check in SKILL.md)

Use the site's documented download links or API, one request at a time, at least 5 seconds
apart, following the rules in `SKILL.md` section 4. Respect each item's licence and keep its
link and licence in `sources.csv`.
