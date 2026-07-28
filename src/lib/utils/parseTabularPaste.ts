export interface ParsedTabularPaste {
  headers: string[];
  rows: Record<string, string>[];
}

function stripBOM(s: string): string {
  return s.charCodeAt(0) === 0xfeff ? s.slice(1) : s;
}

// Quote-aware delimiter split (same algorithm shape as src/lib/import/notion-parser.ts's
// parseCSV, generalized to accept either a comma or tab delimiter).
function splitDelimited(raw: string, delimiter: string): string[][] {
  const text = stripBOM(raw).replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const records: string[][] = [];
  let cur = '';
  let inQuote = false;
  let row: string[] = [];

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuote) {
      if (ch === '"') {
        if (text[i + 1] === '"') { cur += '"'; i++; }
        else { inQuote = false; }
      } else { cur += ch; }
    } else {
      if (ch === '"') { inQuote = true; }
      else if (ch === delimiter) { row.push(cur); cur = ''; }
      else if (ch === '\n') { row.push(cur); cur = ''; records.push(row); row = []; }
      else { cur += ch; }
    }
  }
  if (cur || row.length) { row.push(cur); records.push(row); }
  return records;
}

// Parses either a JSON array of flat objects or delimited text with a header row
// (tab-delimited if any of the first few lines contains a tab, else comma-delimited).
// Used both for the bulk-import dialog's client-side preview and as a shared shape
// for what gets sent to the server action (which re-validates/coerces independently).
export function parseTabularPaste(raw: string): ParsedTabularPaste {
  const trimmed = raw.trim();
  if (!trimmed) return { headers: [], rows: [] };

  if (trimmed.startsWith('[')) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      throw new Error('Invalid JSON input');
    }
    if (!Array.isArray(parsed)) throw new Error('JSON input must be an array of objects');

    const headerSet = new Set<string>();
    const rows: Record<string, string>[] = parsed.map((item) => {
      if (typeof item !== 'object' || item === null || Array.isArray(item)) {
        throw new Error('Each JSON array item must be an object');
      }
      const obj: Record<string, string> = {};
      for (const [k, v] of Object.entries(item as Record<string, unknown>)) {
        headerSet.add(k);
        obj[k] = v == null ? '' : Array.isArray(v) ? v.join(', ') : String(v);
      }
      return obj;
    });
    return { headers: [...headerSet], rows };
  }

  const sampleLines = trimmed.split('\n', 5);
  const delimiter = sampleLines.some((line) => line.includes('\t')) ? '\t' : ',';
  const records = splitDelimited(trimmed, delimiter);
  if (records.length === 0) return { headers: [], rows: [] };

  const headers = records[0].map((h) => h.trim());
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < records.length; i++) {
    if (records[i].every((c) => !c.trim())) continue;
    const obj: Record<string, string> = {};
    headers.forEach((h, j) => { obj[h] = (records[i][j] ?? '').trim(); });
    rows.push(obj);
  }
  return { headers, rows };
}
