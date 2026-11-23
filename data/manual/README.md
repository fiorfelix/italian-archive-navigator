# Manual downloads

`npm run refresh-data` normally gets the SITUAS reports from ISTAT's documented report service. If that
fails, it prints which report to download from the SITUAS website and asks you to save the
CSV here, unchanged. The next refresh then uses the file and records it in `data/SOURCES.md`.

CSV files in this folder are not committed (they are reproducible official data).
