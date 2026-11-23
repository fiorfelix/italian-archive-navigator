# Per-archive overrides

Rules here take precedence over the general rules in `data/rules/it/` (same YAML format).
Use them for facts that differ by archive, such as the birth class from which military
service records are at the Army instead of the State Archive. Each needs a `source_url`
from that archive and `verified: true` only when the archive states it.

No overrides yet: no per-archive cut-off has been confirmed.
