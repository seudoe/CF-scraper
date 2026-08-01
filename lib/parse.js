// Ported from seudoe/src/scraper/parse.ts — exact same logic, plain JS

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function extractInner(html, tag, className) {
  const classPattern = new RegExp(
    `<${tag}[^>]*class="[^"]*${escapeRegex(className)}[^"]*"[^>]*>`, 'i'
  );
  const match = classPattern.exec(html);
  if (!match) { return null; }
  const start = match.index + match[0].length;
  return extractUntilClosingTag(html, tag, start);
}

function extractUntilClosingTag(html, tag, start) {
  let depth = 1;
  let i = start;
  const openTag  = new RegExp(`<${tag}[\\s>]`, 'gi');
  const closeTag = new RegExp(`</${tag}>`, 'gi');

  while (i < html.length && depth > 0) {
    openTag.lastIndex  = i;
    closeTag.lastIndex = i;
    const nextOpen  = openTag.exec(html);
    const nextClose = closeTag.exec(html);
    if (!nextClose) { break; }
    if (nextOpen && nextOpen.index < nextClose.index) {
      depth++;
      i = nextOpen.index + nextOpen[0].length;
    } else {
      depth--;
      if (depth === 0) { return html.slice(start, nextClose.index); }
      i = nextClose.index + nextClose[0].length;
    }
  }
  return html.slice(start);
}

function stripTags(html) {
  return html
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ').trim();
}

export function parseBlocks(html) {
  const blocks = [];
  let remaining = html.trim();

  while (remaining.length > 0) {
    remaining = remaining.trimStart();
    if (!remaining) { break; }

    const imgMatch = /^<img([^>]*)>/i.exec(remaining);
    if (imgMatch) {
      const attrs = imgMatch[1];
      const src = /src="([^"]+)"/.exec(attrs)?.[1] ?? '';
      const alt = /alt="([^"]+)"/.exec(attrs)?.[1];
      if (src) {
        console.log(`[parse] Image found: ${src}`);
        blocks.push({ type: 'image', src, alt });
      }
      remaining = remaining.slice(imgMatch[0].length);
      continue;
    }

    if (/^<table/i.test(remaining)) {
      const end = remaining.toLowerCase().indexOf('</table>');
      if (end !== -1) {
        const tableHtml = remaining.slice(0, end + '</table>'.length);
        blocks.push({ type: 'table', html: tableHtml });
        remaining = remaining.slice(tableHtml.length);
      } else { remaining = ''; }
      continue;
    }

    const listMatch = /^<(ul|ol)[^>]*>/i.exec(remaining);
    if (listMatch) {
      const listTag = listMatch[1].toLowerCase();
      const ordered = listTag === 'ol';
      const inner = extractUntilClosingTag(remaining, listTag, listMatch[0].length);
      const items = [];
      const liRe = /<li[^>]*>(.*?)<\/li>/gis;
      let liMatch;
      while ((liMatch = liRe.exec(inner)) !== null) { items.push(stripTags(liMatch[1])); }
      blocks.push({ type: 'list', ordered, items });
      remaining = remaining.slice(listMatch[0].length + inner.length + `</${listTag}>`.length);
      continue;
    }

    const preMatch = /^<pre[^>]*>([\s\S]*?)<\/pre>/i.exec(remaining);
    if (preMatch) {
      blocks.push({ type: 'code', code: stripTags(preMatch[1]) });
      remaining = remaining.slice(preMatch[0].length);
      continue;
    }

    const blockTagMatch = /^<(p|div)[^>]*>/i.exec(remaining);
    if (blockTagMatch) {
      const bTag = blockTagMatch[1].toLowerCase();
      const inner = extractUntilClosingTag(remaining, bTag, blockTagMatch[0].length);
      const trimmed = inner.trim();
      if (trimmed) {
        if (/^<img[^>]*>$/i.test(trimmed)) {
          const src = /src="([^"]+)"/.exec(trimmed)?.[1] ?? '';
          const alt = /alt="([^"]+)"/.exec(trimmed)?.[1];
          if (src) {
            console.log(`[parse] Image found (in block): ${src}`);
            blocks.push({ type: 'image', src, alt });
          }
        } else {
          blocks.push({ type: 'paragraph', html: trimmed });
        }
      }
      remaining = remaining.slice(blockTagMatch[0].length + inner.length + `</${bTag}>`.length);
      continue;
    }

    const nextTag = /^<[^>]+>/.exec(remaining);
    if (nextTag) {
      remaining = remaining.slice(nextTag[0].length);
    } else {
      const nextTagStart = remaining.indexOf('<');
      const text = nextTagStart === -1 ? remaining : remaining.slice(0, nextTagStart);
      const trimmed = text.trim();
      if (trimmed) { blocks.push({ type: 'paragraph', html: trimmed }); }
      remaining = nextTagStart === -1 ? '' : remaining.slice(nextTagStart);
    }
  }

  return blocks;
}

function extractSampleTests(html) {
  const examples = [];
  const sampleTestRe = /<div[^>]*class="[^"]*sample-test[^"]*"[^>]*>/gi;
  let match;

  while ((match = sampleTestRe.exec(html)) !== null) {
    const sampleStart = match.index + match[0].length;
    const sampleInner = extractUntilClosingTag(html, 'div', sampleStart);
    const inputInner  = extractInner(sampleInner, 'div', 'input')  ?? '';
    const outputInner = extractInner(sampleInner, 'div', 'output') ?? '';
    const noteInner   = extractInner(sampleInner, 'div', 'note')   ?? '';
    const inputPre    = /<pre[^>]*>([\s\S]*?)<\/pre>/i.exec(inputInner)?.[1]  ?? '';
    const outputPre   = /<pre[^>]*>([\s\S]*?)<\/pre>/i.exec(outputInner)?.[1] ?? '';
    const example = {
      input:  stripTags(inputPre).replace(/\r\n/g, '\n'),
      output: stripTags(outputPre).replace(/\r\n/g, '\n'),
    };
    const noteText = stripTags(noteInner).trim();
    if (noteText) { example.explanation = noteText; }
    examples.push(example);
  }

  return examples;
}

export function parseProblemPage(html, problemKey = '?') {
  console.log(`[parse] Parsing problem statement for ${problemKey} ...`);

  const psInner = extractInner(html, 'div', 'problem-statement');
  if (!psInner) {
    console.warn(`[parse] ✗ Could not find .problem-statement in HTML for ${problemKey}`);
    return null;
  }

  const title       = stripTags(extractInner(psInner, 'div', 'title')         ?? '').trim();
  const timeLimit   = stripTags(extractInner(psInner, 'div', 'time-limit')    ?? '').replace(/time limit per test/i, '').trim();
  const memoryLimit = stripTags(extractInner(psInner, 'div', 'memory-limit')  ?? '').replace(/memory limit per test/i, '').trim();

  console.log(`[parse] Title: "${title}" | Time: ${timeLimit} | Memory: ${memoryLimit}`);

  const description = parseBlocks(extractInner(psInner, 'div', 'legend') ?? '');
  const input       = parseBlocks((extractInner(psInner, 'div', 'input-specification')  ?? '').replace(/<div[^>]*class="[^"]*section-title[^"]*"[^>]*>[\s\S]*?<\/div>/i, ''));
  const output      = parseBlocks((extractInner(psInner, 'div', 'output-specification') ?? '').replace(/<div[^>]*class="[^"]*section-title[^"]*"[^>]*>[\s\S]*?<\/div>/i, ''));
  const examples    = extractSampleTests(psInner);
  const noteBlocks  = parseBlocks((extractInner(psInner, 'div', 'note') ?? '').replace(/<div[^>]*class="[^"]*section-title[^"]*"[^>]*>[\s\S]*?<\/div>/i, ''));

  const imageCount = [...description, ...input, ...output, ...noteBlocks].filter(b => b.type === 'image').length;
  console.log(`[parse] ✓ Parsed ${problemKey}: ${examples.length} examples, ${imageCount} images`);

  const result = { title, timeLimit, memoryLimit, description, input, output, examples };
  if (noteBlocks.length > 0) { result.note = noteBlocks; }
  return result;
}
