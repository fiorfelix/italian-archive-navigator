# Family tree page template

The complete HTML page used by the `family-tree-and-bios` skill. To make a tree, write everything
inside the fenced block below, exactly as it is, to `outputs/<family>-tree.html`, then replace
the JSON in the `tree-data` block with the people from `people.yaml` (same fields). Change nothing
else: the page works offline and needs no other files.

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Family tree</title>
    <!--
      Family tree template (Italian Archive Navigator plugin). Self-contained: no external
      files, works offline. To use: replace the JSON inside <script id="tree-data"> with the
      project's people (same fields as people.yaml, see references/people-schema.md).
    -->
    <style>
      :root {
        --bg: #fbf8f2;
        --card: #ffffff;
        --text: #22212a;
        --muted: #5d5a66;
        --line: #cfc6b6;
        --accent: #0b6b3a;
        --verified: #0b6b3a;
        --index: #2f5d9c;
        --secondary: #7a5a12;
        --inference: #8a3b8f;
        --family: #a2342a;
      }
      @media (prefers-color-scheme: dark) {
        :root {
          --bg: #16151b;
          --card: #1f1e26;
          --text: #ecebf0;
          --muted: #a7a4b2;
          --line: #44414e;
          --accent: #3fbf7f;
          --verified: #3fbf7f;
          --index: #7aa7e8;
          --secondary: #d7b45a;
          --inference: #d28ad6;
          --family: #f08a7d;
        }
      }
      * {
        box-sizing: border-box;
      }
      body {
        margin: 0;
        background: var(--bg);
        color: var(--text);
        font:
          15px/1.5 system-ui,
          -apple-system,
          'Segoe UI',
          Roboto,
          sans-serif;
      }
      header {
        padding: 16px;
        display: flex;
        flex-wrap: wrap;
        gap: 10px 16px;
        align-items: center;
        border-bottom: 4px solid;
        border-image: linear-gradient(to right, #009246 33%, #ffffff 33% 66%, #ce2b37 66%) 1;
      }
      h1 {
        font-size: 1.3rem;
        margin: 0 12px 0 0;
      }
      select,
      button {
        font: inherit;
        padding: 4px 8px;
        border-radius: 6px;
        border: 1px solid var(--line);
        background: var(--card);
        color: var(--text);
      }
      button[aria-pressed='true'] {
        background: var(--accent);
        color: #fff;
        border-color: var(--accent);
      }
      main {
        display: flex;
        flex-wrap: wrap;
        gap: 16px;
        padding: 16px;
      }
      #view {
        flex: 1 1 520px;
        overflow-x: auto;
      }
      #details {
        flex: 0 1 360px;
        background: var(--card);
        border: 1px solid var(--line);
        border-radius: 10px;
        padding: 14px;
        align-self: flex-start;
      }
      .gens {
        display: flex;
        gap: 18px;
        align-items: stretch;
      }
      .gen {
        display: flex;
        flex-direction: column;
        justify-content: space-around;
        gap: 8px;
        min-width: 170px;
      }
      .gen h2 {
        font-size: 0.8rem;
        color: var(--muted);
        margin: 0 0 4px;
        font-weight: 600;
      }
      .person {
        background: var(--card);
        border: 1px solid var(--line);
        border-radius: 8px;
        padding: 6px 9px;
        cursor: pointer;
        text-align: left;
        width: 100%;
      }
      .person:hover,
      .person.sel {
        border-color: var(--accent);
      }
      .person .n {
        font-weight: 600;
      }
      .person .d {
        color: var(--muted);
        font-size: 0.85rem;
      }
      .empty {
        border-style: dashed;
        color: var(--muted);
        cursor: default;
      }
      ul.desc,
      ul.desc ul {
        list-style: none;
        margin: 0;
        padding-left: 22px;
        border-left: 1px solid var(--line);
      }
      ul.desc {
        border-left: none;
        padding-left: 0;
      }
      ul.desc li {
        margin: 6px 0;
      }
      .spouse {
        color: var(--muted);
        font-size: 0.85rem;
        margin-left: 8px;
      }
      .fact {
        margin: 8px 0;
      }
      .label {
        display: inline-block;
        font-size: 0.72rem;
        font-weight: 700;
        padding: 0 6px;
        border-radius: 4px;
        border: 1px solid currentColor;
        margin-left: 4px;
      }
      .VERIFIED {
        color: var(--verified);
      }
      .INDEX {
        color: var(--index);
      }
      .SECONDARY {
        color: var(--secondary);
      }
      .INFERENCE {
        color: var(--inference);
      }
      .FAMILY_ACCOUNT {
        color: var(--family);
      }
      .src {
        color: var(--muted);
        font-size: 0.85rem;
        overflow-wrap: anywhere;
      }
      .legend {
        font-size: 0.8rem;
        color: var(--muted);
      }
      @media print {
        header select,
        header button,
        #details {
          display: none;
        }
        body {
          background: #fff;
          color: #000;
        }
      }
    </style>
  </head>
  <body>
    <header>
      <h1 id="title">Family tree</h1>
      <label
        >Person
        <select id="root"></select
      ></label>
      <button id="b-anc" aria-pressed="true">Ancestors</button>
      <button id="b-desc" aria-pressed="false">Descendants</button>
      <span class="legend">
        Evidence: <span class="label VERIFIED">VERIFIED</span>
        <span class="label INDEX">INDEX</span> <span class="label SECONDARY">SECONDARY</span>
        <span class="label INFERENCE">INFERENCE</span>
        <span class="label FAMILY_ACCOUNT">FAMILY_ACCOUNT</span>
      </span>
    </header>
    <main>
      <div id="view"></div>
      <aside id="details"><p>Select a person to see facts and sources.</p></aside>
    </main>

    <!-- Invented example data: replace with the project's people. -->
    <script type="application/json" id="tree-data">
      {
        "title": "Rossi family (example)",
        "root": "p1",
        "people": [
          {
            "id": "p1",
            "given": "Giuseppe",
            "surname": "Rossi",
            "sex": "M",
            "parents": ["p2", "p3"],
            "spouses": ["p4"],
            "facts": [
              {
                "type": "birth",
                "date": "1880-03-05",
                "place": "Montefiore",
                "evidence": "VERIFIED",
                "source": "Comune di Montefiore, Nati 1880, atto n. 45"
              }
            ],
            "bio": "bios/rossi-giuseppe-1880.md"
          },
          {
            "id": "p2",
            "given": "Luigi",
            "surname": "Rossi",
            "sex": "M",
            "parents": [],
            "spouses": ["p3"],
            "facts": [
              {
                "type": "occupation",
                "value": "contadino",
                "evidence": "VERIFIED",
                "source": "Nati 1880, atto n. 45"
              }
            ]
          },
          {
            "id": "p3",
            "given": "Maria",
            "surname": "Bianchi",
            "sex": "F",
            "parents": [],
            "spouses": ["p2"],
            "facts": [
              {
                "type": "birth",
                "date": "about 1855",
                "evidence": "INFERENCE",
                "source": "age at her son's birth"
              }
            ]
          },
          {
            "id": "p4",
            "given": "Rosa",
            "surname": "Verdi",
            "sex": "F",
            "parents": [],
            "spouses": ["p1"],
            "facts": [
              {
                "type": "marriage",
                "date": "1905-02-10",
                "place": "Montefiore",
                "evidence": "INDEX",
                "source": "Matrimoni 1905, indice"
              }
            ]
          },
          { "id": "p5", "given": "", "surname": "Rossi", "living": true, "parents": ["p1", "p4"] }
        ]
      }
    </script>
    <script>
      (function () {
        const data = JSON.parse(document.getElementById('tree-data').textContent);
        const byId = new Map(data.people.map((p) => [p.id, p]));
        const children = new Map();
        for (const p of data.people) {
          for (const par of p.parents || []) {
            if (!children.has(par)) children.set(par, []);
            children.get(par).push(p.id);
          }
        }
        let rootId = data.root || data.people[0].id;
        let mode =
          new URLSearchParams(location.search).get('view') === 'descendants' ? 'desc' : 'anc';
        const $ = (id) => document.getElementById(id);
        const el = (tag, cls, text) => {
          const e = document.createElement(tag);
          if (cls) e.className = cls;
          if (text !== undefined) e.textContent = text;
          return e;
        };
        const name = (p) =>
          p.living ? 'Living person' : [p.surname, p.given].filter(Boolean).join(' ') || '?';
        const year = (f) => {
          const m = f && f.date ? /\d{4}/.exec(String(f.date)) : null;
          if (!m) return '';
          const d = String(f.date);
          if (/^(about|circa|c\.|abt)/i.test(d)) return `c.${m[0]}`;
          if (/^(before|by|bef\.?)\b/i.test(d)) return `bef.${m[0]}`;
          if (/^(after|aft\.?)\b/i.test(d)) return `aft.${m[0]}`;
          return m[0];
        };
        const span = (p) => {
          if (p.living) return 'living';
          const b = (p.facts || []).find((f) => f.type === 'birth' || f.type === 'baptism');
          const d = (p.facts || []).find((f) => f.type === 'death' || f.type === 'burial');
          return [year(b), year(d)].some(Boolean) ? `${year(b) || '?'}–${year(d) || ''}` : '';
        };
        function card(p) {
          if (!p) {
            const e = el('div', 'person empty', 'unknown');
            return e;
          }
          const b = el('button', 'person');
          b.append(el('div', 'n', name(p)), el('div', 'd', span(p)));
          b.addEventListener('click', () => show(p));
          return b;
        }
        function show(p) {
          const d = $('details');
          d.replaceChildren();
          d.append(el('h2', '', name(p)));
          if (p.living) {
            d.append(el('p', '', 'Details of people who may be alive are not shown.'));
            return;
          }
          for (const f of p.facts || []) {
            const row = el('div', 'fact');
            const what = [f.type, f.date, f.place, f.value].filter(Boolean).join(' · ');
            row.append(el('span', '', what));
            if (f.evidence) row.append(el('span', `label ${f.evidence}`, f.evidence));
            if (f.source) row.append(el('div', 'src', f.source));
            d.append(row);
          }
          if (p.bio) {
            const a = el('a', '', 'Biography');
            a.href = p.bio;
            d.append(el('p'), a);
          }
          if (p.notes) d.append(el('p', 'src', p.notes));
        }
        function ancestors() {
          const gens = [[rootId]];
          for (let g = 1; g < 5; g++) {
            const prev = gens[g - 1];
            if (prev.every((id) => !id || !(byId.get(id)?.parents || []).length)) break;
            gens.push(
              prev.flatMap((id) => {
                const ps = (id && byId.get(id)?.parents) || [];
                return [ps[0] || null, ps[1] || null];
              }),
            );
          }
          const wrap = el('div', 'gens');
          const names = [
            'Person',
            'Parents',
            'Grandparents',
            'Great-grandparents',
            '2× great-grandparents',
          ];
          gens.forEach((ids, g) => {
            const col = el('div', 'gen');
            col.append(el('h2', '', names[g] || `Generation ${g + 1}`));
            for (const id of ids) col.append(card(id ? byId.get(id) : null));
            wrap.append(col);
          });
          return wrap;
        }
        function descendants(id, depth, seen) {
          const ul = el('ul', depth ? '' : 'desc');
          const li = el('li');
          const p = byId.get(id);
          li.append(card(p));
          for (const s of p.spouses || []) {
            const sp = byId.get(s);
            if (sp) li.append(el('span', 'spouse', `∞ ${name(sp)}`));
          }
          seen.add(id);
          const kids = (children.get(id) || []).filter((k) => !seen.has(k));
          if (kids.length && depth < 6) {
            const sub = el('ul');
            for (const k of kids) sub.append(...descendants(k, depth + 1, seen).children);
            li.append(sub);
          }
          ul.append(li);
          return ul;
        }
        function render() {
          $('view').replaceChildren(
            mode === 'anc' ? ancestors() : descendants(rootId, 0, new Set()),
          );
          $('b-anc').setAttribute('aria-pressed', String(mode === 'anc'));
          $('b-desc').setAttribute('aria-pressed', String(mode === 'desc'));
        }
        $('title').textContent = data.title || 'Family tree';
        document.title = data.title || 'Family tree';
        const sel = $('root');
        for (const p of [...data.people]
          .filter((p) => !p.living)
          .sort((a, b) => name(a).localeCompare(name(b)))) {
          const o = el('option', '', `${name(p)} ${span(p)}`);
          o.value = p.id;
          if (p.id === rootId) o.selected = true;
          sel.append(o);
        }
        sel.addEventListener('change', () => {
          rootId = sel.value;
          render();
        });
        $('b-anc').addEventListener('click', () => {
          mode = 'anc';
          render();
        });
        $('b-desc').addEventListener('click', () => {
          mode = 'desc';
          render();
        });
        render();
        show(byId.get(rootId));
      })();
    </script>
  </body>
</html>
```
