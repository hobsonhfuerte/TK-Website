const WEEKLY_NEWS_URL = "https://docs.google.com/document/d/e/2PACX-1vQ4bA4N4M1JzWZTaAFxgXl0iyXldLpBbZt00LNYnZfCPEQd614aVoi2TLWM6KyqPNMeLJ2I4v9eUA2r/pub";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/weekly-news") {
      return handleWeeklyNewsApi();
    }

    return env.ASSETS.fetch(request);
  }
};

async function handleWeeklyNewsApi() {
  try {
    const upstream = await fetch(WEEKLY_NEWS_URL, {
      headers: { "User-Agent": "Mozilla/5.0 Room21Website/1.0" },
      cf: { cacheTtl: 60, cacheEverything: true }
    });

    if (!upstream.ok) {
      return jsonResponse(
        { ok: false, error: "Weekly News is temporarily unavailable." },
        upstream.status
      );
    }

    const sourceHtml = await upstream.text();
    const weeks = parseWeeks(sourceHtml);

    if (!weeks.length) {
      return jsonResponse({
        ok: false,
        error: 'No "WEEK OF:" sections were found in the published Google Doc.'
      }, 200);
    }

    return jsonResponse({
      ok: true,
      source: WEEKLY_NEWS_URL,
      updatedAt: new Date().toISOString(),
      weeks
    });
  } catch (error) {
    return jsonResponse({
      ok: false,
      error: "Weekly News is temporarily unavailable. Please try again shortly."
    }, 502);
  }
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=UTF-8",
      "Cache-Control": "public, max-age=60"
    }
  });
}

/*
  Published Google Docs are HTML. We intentionally use WEEK OF: as the only
  required delimiter so Heather can keep one running document all year.

  Strategy:
  1. Extract the main published document body.
  2. Find each occurrence of WEEK OF: in the rendered HTML.
  3. Segment the HTML into week-sized blocks.
  4. Preserve safe formatting and links.
  5. Extract common optional sections (This Week, Coming Up, Reminders, etc.)
     when they exist; otherwise the full week content is still preserved.
*/
function parseWeeks(sourceHtml) {
  let body = extractDocumentBody(sourceHtml);
  if (!body) return [];

  body = cleanGoogleHtml(body);

  // Locate WEEK OF: markers in the HTML while tolerating embedded span tags.
  const markerRegex = /WEEK(?:\s|&nbsp;|<[^>]+>)*OF(?:\s|&nbsp;|<[^>]+>)*:/gi;
  const markers = [];
  let match;
  while ((match = markerRegex.exec(body)) !== null) {
    markers.push({ index: match.index, length: match[0].length });
  }

  if (!markers.length) return [];

  const weeks = [];
  for (let i = 0; i < markers.length; i++) {
    const start = markers[i].index;
    const end = i + 1 < markers.length ? markers[i + 1].index : body.length;
    let block = body.slice(start, end);
    block = normalizeWeekBlock(block);

    const plain = textFromHtml(block);
    const labelMatch = plain.match(/WEEK\s+OF\s*:\s*([^\n\r]+)/i);
    let label = labelMatch ? labelMatch[1].trim() : `Week ${i + 1}`;

    // Keep the label concise in case Google collapses multiple lines.
    label = label.split(/\s{3,}/)[0].trim();

    const sections = extractNamedSections(block);
    const fullHtml = sanitizeHtml(block);

    weeks.push({
      id: slugify(label) || `week-${i + 1}`,
      label,
      fullHtml,
      sections
    });
  }

  // The agreed workflow is newest week at the top of the Google Doc,
  // so Google-document order is the site order.
  return weeks;
}

function extractDocumentBody(sourceHtml) {
  // Google published docs commonly put content inside #contents.
  let match = sourceHtml.match(/<div[^>]+id=["']contents["'][^>]*>([\s\S]*?)<\/div>\s*<\/body>/i);
  if (match) return match[1];

  match = sourceHtml.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  return match ? match[1] : sourceHtml;
}

function cleanGoogleHtml(value) {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/\sdata-[\w-]+=(["']).*?\1/gi, "")
    .replace(/\sclass=(["']).*?\1/gi, "")
    .replace(/\sid=(["']).*?\1/gi, "")
    .replace(/\sstyle=(["']).*?\1/gi, "");
}

function normalizeWeekBlock(block) {
  // Add line boundaries around block elements so text extraction is reliable.
  return block
    .replace(/<(p|div|li|h1|h2|h3|h4|h5|h6|br)\b[^>]*>/gi, match => "\n" + match)
    .replace(/<\/(p|div|li|h1|h2|h3|h4|h5|h6)>/gi, match => match + "\n");
}

function extractNamedSections(block) {
  const sectionNames = [
    "THIS WEEK",
    "COMING UP",
    "REMINDERS",
    "FAMILY NOTES",
    "NOTES",
    "IMPORTANT DATES"
  ];

  const plain = textFromHtml(block);
  const upper = plain.toUpperCase();

  const found = [];
  for (const name of sectionNames) {
    const idx = upper.indexOf(name);
    if (idx >= 0) found.push({ name, idx });
  }

  found.sort((a, b) => a.idx - b.idx);

  if (!found.length) {
    return [{ title: "Weekly Update", html: sanitizeHtml(removeWeekLabel(block)) }];
  }

  const sections = [];
  for (let i = 0; i < found.length; i++) {
    const current = found[i];
    const next = found[i + 1];

    // We slice by plain-text locations only to identify headings, then fall back
    // to an HTML split helper to preserve links/formatting.
    const htmlSection = sliceHtmlBetweenLabels(
      block,
      current.name,
      next ? next.name : null
    );

    sections.push({
      title: titleCase(current.name),
      html: sanitizeHtml(htmlSection)
    });
  }

  // Preserve any intro content before the first named heading.
  const intro = sliceHtmlBeforeLabel(removeWeekLabel(block), found[0].name);
  if (textFromHtml(intro).trim()) {
    sections.unshift({
      title: "Overview",
      html: sanitizeHtml(intro)
    });
  }

  return sections;
}

function sliceHtmlBetweenLabels(html, startLabel, endLabel) {
  const start = findLabelHtmlIndex(html, startLabel);
  if (start < 0) return "";

  const startEnd = findEndOfHeading(html, start, startLabel);
  const end = endLabel ? findLabelHtmlIndex(html, endLabel, startEnd) : -1;
  return html.slice(startEnd, end >= 0 ? end : html.length);
}

function sliceHtmlBeforeLabel(html, label) {
  const idx = findLabelHtmlIndex(html, label);
  return idx >= 0 ? html.slice(0, idx) : html;
}

function findLabelHtmlIndex(html, label, from = 0) {
  const escaped = label
    .split(/\s+/)
    .map(part => escapeRegex(part))
    .join("(?:\\s|&nbsp;|<[^>]+>)*");
  const regex = new RegExp(escaped, "i");
  const sub = html.slice(from);
  const m = sub.match(regex);
  return m ? from + m.index : -1;
}

function findEndOfHeading(html, labelIndex, label) {
  const afterLabel = labelIndex + label.length;
  const candidates = [
    html.indexOf("</p>", afterLabel),
    html.indexOf("</div>", afterLabel),
    html.indexOf("</h1>", afterLabel),
    html.indexOf("</h2>", afterLabel),
    html.indexOf("</h3>", afterLabel),
    html.indexOf("<br", afterLabel)
  ].filter(x => x >= 0);

  return candidates.length ? Math.min(...candidates) + 5 : afterLabel;
}

function removeWeekLabel(html) {
  return html.replace(
    /WEEK(?:\s|&nbsp;|<[^>]+>)*OF(?:\s|&nbsp;|<[^>]+>)*:[\s\S]*?(?=<\/p>|<\/div>|<br|$)/i,
    ""
  );
}

function sanitizeHtml(value) {
  // Google is the trusted published source, but keep only presentation-safe tags.
  let safe = value
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, "")
    .replace(/<object[\s\S]*?<\/object>/gi, "")
    .replace(/<embed[^>]*>/gi, "")
    .replace(/\son\w+=(["']).*?\1/gi, "")
    .replace(/\son\w+=([^\s>]+)/gi, "");

  // Make links open safely in a new tab.
  safe = safe.replace(/<a\s+([^>]*href=["'][^"']+["'][^>]*)>/gi, (m, attrs) => {
    const cleaned = attrs
      .replace(/\starget=(["']).*?\1/gi, "")
      .replace(/\srel=(["']).*?\1/gi, "");
    return `<a ${cleaned} target="_blank" rel="noopener noreferrer">`;
  });

  return safe.trim();
}

function textFromHtml(value) {
  return decodeEntities(
    value
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|div|li|h1|h2|h3|h4|h5|h6)>/gi, "\n")
      .replace(/<[^>]+>/g, "")
  )
  .replace(/\r/g, "")
  .replace(/[ \t]+\n/g, "\n")
  .replace(/\n{3,}/g, "\n\n")
  .trim();
}

function decodeEntities(value) {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

function titleCase(value) {
  return value.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
}

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
