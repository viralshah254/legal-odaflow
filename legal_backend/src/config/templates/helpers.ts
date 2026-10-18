export interface TemplateDef {
  kind: string;
  title: string;
  body: string;
}

/** Build a structured template body from section headings and paragraph templates. */
export function sectionsBody(
  title: string,
  sections: Array<{ heading: string; paragraphs: string[] }>,
): string {
  const parts = [`<h2>${title}</h2>`];
  for (const section of sections) {
    parts.push(`<h3>${section.heading}</h3>`);
    for (const p of section.paragraphs) {
      parts.push(`<p>${p}</p>`);
    }
  }
  return parts.join('');
}

export function simpleDef(kind: string, title: string, intro: string, sections: string[]): TemplateDef {
  const body = [
    `<h2>${title}</h2>`,
    `<p>${intro}</p>`,
    ...sections.map((s, i) => `<h3>${i + 1}. ${s.split(' — ')[0]}</h3><p>${s.includes(' — ') ? s.split(' — ').slice(1).join(' — ') : s}</p>`),
  ].join('');
  return { kind, title, body };
}
