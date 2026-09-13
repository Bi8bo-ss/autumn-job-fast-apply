type PdfTextItem = {
  str: string;
  transform?: number[];
  width?: number;
  height?: number;
  hasEOL?: boolean;
};

function sequentialText(items: PdfTextItem[]) {
  let output = '';
  for (const item of items) {
    if (output && !output.endsWith('\n') && item.str && !/^\s/.test(item.str)) output += ' ';
    output += item.str;
    if (item.hasEOL) output += '\n';
  }
  return output;
}

// PDF paint order is not reading order: edited labels can be drawn after the
// final skills section despite appearing near the top of the page. Reconstruct
// rows from their page positions, keeping those labels with their real bullets.
export function textFromPdfItems(items: unknown[], pageTransform?: number[]) {
  const textItems = items.filter((raw): raw is PdfTextItem => (
    raw !== null && typeof raw === 'object' && 'str' in raw && typeof raw.str === 'string'
  ));
  const nonempty = textItems.filter((item) => item.str.trim());
  if (nonempty.some((item) => !Array.isArray(item.transform) || item.transform.length < 6
    || !Number.isFinite(item.transform[4]) || !Number.isFinite(item.transform[5]))) return sequentialText(textItems);
  const positioned = nonempty.map((item, index) => {
    const sourceX = item.transform![4];
    const sourceY = item.transform![5];
    const [a, b, c, d, e, f] = pageTransform || [1, 0, 0, -1, 0, 0];
    return {
      item, index,
      x: a * sourceX + c * sourceY + e,
      y: b * sourceX + d * sourceY + f,
    };
  }).sort((left, right) => left.y - right.y || left.index - right.index);

  const rows: Array<{ y: number; parts: typeof positioned }> = [];
  for (const part of positioned) {
    const row = rows.at(-1);
    if (row && Math.abs(part.y - row.y) <= 2) row.parts.push(part);
    else rows.push({ y: part.y, parts: [part] });
  }
  return rows.map(({ parts }) => {
    parts.sort((left, right) => left.x - right.x || left.index - right.index);
    let output = '';
    let previous: typeof parts[number] | undefined;
    for (const part of parts) {
      if (previous && output && !/\s$/.test(output) && !/^\s/.test(part.item.str)) {
        const gap = part.x - previous.x - (previous.item.width || 0);
        if (gap > Math.max(0.8, (part.item.height || 0) * 0.15)) output += ' ';
      }
      output += part.item.str;
      previous = part;
    }
    return output;
  }).join('\n');
}
