#!/usr/bin/env bash
# fetch-pages.sh: download register page images from a site that allows automated access,
# slowly and politely. Part of the Italian Archive Navigator plugin.
#
# Usage:
#   fetch-pages.sh LIST DEST [DELAY_SECONDS] [CONTACT]
#
#   LIST     text file, one page per line: URL, a tab, then the file name to save it as
#   DEST     folder to save into (created if missing); a log is written to DEST/fetch-log.tsv
#   DELAY    seconds between requests: 5 or more (default 5); never less than 5
#   CONTACT  contact address sent in the User-Agent (default: the plugin's support page)
#
# Rules it follows:
#   - one request at a time, at least DELAY seconds apart;
#   - files already in DEST are skipped, so a stopped run can simply be started again;
#   - 429 or 503: wait as long as the site's Retry-After says, otherwise 1, 2, then 4 minutes;
#     after 3 in a row it stops for the day;
#   - 401, 403, or a web page where an image was expected (a login or CAPTCHA page): it stops
#     at once and does not retry. Respect the site's decision.
#
# Exit codes: 0 done, 2 stopped by the site (429/503 repeated), 3 access refused (401, 403,
# login or CAPTCHA page), 1 usage error.

set -u

LIST="${1:-}"
DEST="${2:-}"
DELAY="${3:-5}"
CONTACT="${4:-https://archives.fiorfelix.com}"
MIN_DELAY=5

if [ -z "$LIST" ] || [ -z "$DEST" ] || [ ! -f "$LIST" ]; then
  echo "Usage: fetch-pages.sh LIST DEST [DELAY_SECONDS] [CONTACT]" >&2
  exit 1
fi
case "$DELAY" in
  '' | *[!0-9]*) echo "DELAY must be a whole number of seconds." >&2; exit 1 ;;
esac
if [ "$DELAY" -lt "$MIN_DELAY" ]; then
  echo "DELAY must be at least $MIN_DELAY seconds." >&2
  exit 1
fi

# Check the whole list before any request: safe file names, no name used twice.
BAD=$(awk -F'\t' 'NF && $1 != "" {
  if ($2 !~ /^[A-Za-z0-9][A-Za-z0-9._-]*$/) print "bad file name on line " NR ": \"" $2 "\" (use letters, digits, . _ - only)";
  else if (seen[$2]++) print "file name used twice on line " NR ": " $2 }' "$LIST")
if [ -n "$BAD" ]; then
  echo "$BAD" >&2
  echo "Fix the list and run again. Nothing was downloaded." >&2
  exit 1
fi

mkdir -p "$DEST"
LOG="$DEST/fetch-log.tsv"
[ -f "$LOG" ] || printf 'time\turl\tfile\tstatus\tbytes\tsha256\n' > "$LOG"
USER_AGENT="italian-archive-navigator/1.0 (family-history research; slow, one request at a time; contact: $CONTACT)"

TOTAL=$(grep -c . "$LIST")
DONE=0
STRIKES=0
FIRST=1
TMP="$DEST/.part"
HEADERS="$DEST/.headers"

log() { printf '%s\t%s\t%s\t%s\t%s\t%s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$1" "$2" "$3" "$4" "$5" >> "$LOG"; }

while IFS=$'\t' read -r URL NAME || [ -n "${URL:-}" ]; do
  [ -z "${URL:-}" ] && continue
  DONE=$((DONE + 1))
  if [ -s "$DEST/$NAME" ]; then
    echo "[$DONE/$TOTAL] already saved: $NAME"
    continue
  fi

  ATTEMPT=0
  while :; do
    if [ "$FIRST" -eq 0 ]; then sleep "$DELAY"; fi
    FIRST=0
    STATUS=$(curl -sS -L --max-time 120 -A "$USER_AGENT" -D "$HEADERS" -o "$TMP" -w '%{http_code}' "$URL" 2>/dev/null)
    STATUS=${STATUS:-000}
    TYPE=$(grep -i '^content-type:' "$HEADERS" 2>/dev/null | tail -1 | tr -d '\r' | cut -d' ' -f2- | tr 'A-Z' 'a-z')

    if [ "$STATUS" = "401" ] || [ "$STATUS" = "403" ]; then
      log "$URL" "$NAME" "$STATUS" 0 -
      echo "[$DONE/$TOTAL] access refused ($STATUS). Stopping: this site does not allow it." >&2
      rm -f "$TMP" "$HEADERS"
      exit 3
    fi
    if [ "$STATUS" = "200" ] && echo "$TYPE" | grep -q 'text/html'; then
      log "$URL" "$NAME" "html" 0 -
      echo "[$DONE/$TOTAL] got a web page instead of an image (login or CAPTCHA?). Stopping." >&2
      rm -f "$TMP" "$HEADERS"
      exit 3
    fi
    if [ "$STATUS" = "429" ] || [ "$STATUS" = "503" ]; then
      STRIKES=$((STRIKES + 1))
      log "$URL" "$NAME" "$STATUS" 0 -
      if [ "$STRIKES" -ge 3 ]; then
        echo "[$DONE/$TOTAL] the site asked us to slow down 3 times in a row. Stopping for today; run again later." >&2
        rm -f "$TMP" "$HEADERS"
        exit 2
      fi
      WAIT=$(grep -i '^retry-after:' "$HEADERS" 2>/dev/null | tail -1 | tr -d '\r' | awk '{print $2}')
      case "$WAIT" in
        '' | *[!0-9]*) WAIT=$((60 * (1 << (STRIKES - 1)))) ;;
      esac
      echo "[$DONE/$TOTAL] site busy ($STATUS); waiting ${WAIT}s." >&2
      sleep "$WAIT"
      continue
    fi
    if [ "$STATUS" = "200" ]; then
      STRIKES=0
      mv "$TMP" "$DEST/$NAME"
      BYTES=$(wc -c < "$DEST/$NAME" | tr -d ' ')
      SUM=$( (sha256sum "$DEST/$NAME" 2>/dev/null || shasum -a 256 "$DEST/$NAME") | cut -d' ' -f1)
      log "$URL" "$NAME" 200 "$BYTES" "$SUM"
      echo "[$DONE/$TOTAL] saved: $NAME"
      break
    fi
    # Other errors: retry up to twice, then move on.
    ATTEMPT=$((ATTEMPT + 1))
    log "$URL" "$NAME" "$STATUS" 0 -
    if [ "$ATTEMPT" -ge 3 ]; then
      echo "[$DONE/$TOTAL] failed ($STATUS) three times; skipping $NAME." >&2
      break
    fi
  done
done < "$LIST"

rm -f "$TMP" "$HEADERS"
echo "Done: $TOTAL pages listed. Log: $LOG"
exit 0
