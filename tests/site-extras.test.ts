import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  buildAll,
  htmlToMarkdown,
  loadPages,
  pagePath,
  withMarkdownLink,
} from '../scripts/site-extras.js';

const URL_ = 'https://archives.fiorfelix.com/guides/x';
const md = (body: string) => htmlToMarkdown(`<html><body><main>${body}</main></body></html>`, URL_);

describe('htmlToMarkdown', () => {
  it('turns headings, paragraphs and inline formatting into Markdown', () => {
    expect(
      md(`<h1>Title</h1>
        <p class="lead">Some   <strong>bold</strong> and <em>italic</em>
        text with <code>code</code>.</p><h2 id="a">Part</h2>`),
    ).toBe('# Title\n\nSome **bold** and *italic* text with `code`.\n\n## Part\n');
  });
  it('makes every link absolute', () => {
    expect(
      md('<p><a href="/it/">Home</a> <a href="#add">Add</a> <a href="https://x.org/">X</a></p>'),
    ).toBe(`[Home](https://archives.fiorfelix.com/it/) [Add](${URL_}#add) [X](https://x.org/)\n`);
  });
  it('renders lists, nested formatting and tables', () => {
    expect(
      md('<ul><li><strong>A:</strong> one</li><li>two</li></ul><ol><li>x</li><li>y</li></ol>'),
    ).toBe('- **A:** one\n- two\n\n1. x\n2. y\n');
    expect(
      md('<table><tr><th>Tool</th><th>Gets</th></tr><tr><td>A | B</td><td>c</td></tr></table>'),
    ).toBe('| Tool | Gets |\n| --- | --- |\n| A \\| B | c |\n');
  });
  it('leaves out buttons, scripts, hidden parts and decodes entities', () => {
    expect(
      md(`<div><code class="url">https://a.example/mcp</code><button>Copy</button></div>
        <div hidden><p>secret</p></div><script>alert(1)</script><p>Tom &amp; Jerry&#39;s</p>`),
    ).toBe("`https://a.example/mcp`\n\nTom & Jerry's\n");
  });
});

describe('pages', () => {
  it('maps files to public paths and Markdown paths', () => {
    expect(pagePath('site/index.html')).toEqual({ path: '/', mdPath: '/index.md' });
    expect(pagePath('site/it/index.html')).toEqual({ path: '/it/', mdPath: '/it/index.md' });
    expect(pagePath('site/guides/x.html')).toEqual({ path: '/guides/x', mdPath: '/guides/x.md' });
  });
  it('adds the Markdown link once, and replaces it on later runs', () => {
    const html = '<head>\n    <title>t</title>\n    <link rel="icon" href="/icon.svg" />\n</head>';
    const once = withMarkdownLink(html, 'https://e.org/a.md');
    expect(once).toContain(
      '    <link rel="alternate" type="text/markdown" href="https://e.org/a.md" />\n    <link rel="icon"',
    );
    expect(withMarkdownLink(once, 'https://e.org/a.md')).toBe(once);
    expect(withMarkdownLink(once, 'https://e.org/b.md')).not.toContain('a.md');
    const twice = once.replace(
      '<link rel="icon"',
      '<link\n rel="alternate"\n type="text/markdown"\n href="x.md"\n />\n<link rel="icon"',
    );
    expect(withMarkdownLink(twice, 'https://e.org/a.md').match(/text\/markdown/g)).toHaveLength(1);
  });
  it('indexes only pages meant for search engines', () => {
    const paths = loadPages().map((p) => p.path);
    expect(paths).toContain('/');
    expect(paths).toContain('/it/guide/fogli-matricolari');
    expect(paths).not.toContain('/contact');
    expect(paths).not.toContain('/it/contatti');
    expect(paths).not.toContain('/404');
  });
});

describe('generated files', () => {
  it('are up to date with the HTML pages (run npm run site:build)', async () => {
    const stale = [...(await buildAll())]
      .filter(([file, content]) => !existsSync(file) || readFileSync(file, 'utf8') !== content)
      .map(([file]) => file);
    expect(stale).toEqual([]);
  });
});
