import { readFileSync } from 'node:fs';

export type Values = Record<string, string | undefined>;

/**
 * Minimal template renderer for letter templates in templates/<country>/:
 * - {{name}}: the value, or "[DA COMPLETARE: label]" when missing (recorded in `missing`);
 * - {{#name}}…{{/name}}: the block only when `name` has a value.
 */
export function render(
  template: string,
  values: Values,
  labels: Record<string, string>,
): { text: string; missing: string[] } {
  const missing = new Set<string>();
  // Repeat so nested blocks ({{#a}}…{{#b}}…{{/b}}…{{/a}}) are resolved from the outside in.
  let sections = template;
  for (let i = 0; i < 5 && /\{\{#\w+\}\}/.test(sections); i++) {
    sections = sections.replace(
      /\{\{#(\w+)\}\}([\s\S]*?)\{\{\/\1\}\}/g,
      (_, key: string, body: string) => (values[key] ? body : ''),
    );
  }
  const text = sections.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
    const v = values[key];
    if (v) return v;
    missing.add(key);
    return `[DA COMPLETARE: ${labels[key] ?? key}]`;
  });
  return { text, missing: [...missing] };
}

export function loadTemplate(dir: string, name: string): string {
  return readFileSync(`${dir}/${name}.txt`, 'utf8');
}
