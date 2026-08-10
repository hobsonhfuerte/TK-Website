const WISH_LIST_URL = "https://docs.google.com/document/d/e/2PACX-1vRLZ7QLgACG9xD2uPL7E9IKntiF8niLbKVVAU0H3sjxG4LCmRc-gAvHP2vY7SM-k-2aMwxWRv24Bgg1/pub";
const WEEKLY_NEWS_URL = "https://docs.google.com/document/d/e/2PACX-1vQ4bA4N4M1JzWZTaAFxgXl0iyXldLpBbZt00LNYnZfCPEQd614aVoi2TLWM6KyqPNMeLJ2I4v9eUA2r/pub";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/weekly-news") {
      return handleWeeklyNewsApi();
    }


    if (url.pathname === "/api/wish-list") {
      return handleWishListApi();
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
      });
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

function parseWeeks(sourceHtml) {
  let body = extractDocumentBody(sourceHtml);
  if (!body) return [];

  body = cleanGoogleHtml(body);

  const markerRegex = /WEEK(?:\s|&nbsp;|<[^>]+>)*OF(?:\s|&nbsp;|<[^>]+>)*:/gi;
  const markers = [];
  let match;
  while ((match = markerRegex.exec(body)) !== null) {
    markers.push({ index: match.index });
  }

  if (!markers.length) return [];

  const weeks = [];

  for (let i = 0; i < markers.length; i++) {
    const start = markers[i].index;
    const end = i + 1 < markers.length ? markers[i + 1].index : body.length;
    const rawBlock = body.slice(start, end);
    const block = normalizeBlock(rawBlock);
    const plain = textFromHtml(block);

    const labelMatch = plain.match(/WEEK\s+OF\s*:\s*([^\n\r]+)/i);
    let label = labelMatch ? labelMatch[1].trim() : `Week ${i + 1}`;
    label = label.split(/\s{3,}/)[0].trim();

    weeks.push({
      id: slugify(label) || `week-${i + 1}`,
      label,
      fullHtml: sanitizeHtml(removeWeekHeading(block)),
      sections: extractSections(block)
    });
  }

  // Heather will keep the newest WEEK OF: section at the top.
  return weeks;
}

function extractDocumentBody(sourceHtml) {
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

function normalizeBlock(value) {
  return value
    .replace(/<(p|div|li|h1|h2|h3|h4|h5|h6|br)\b[^>]*>/gi, m => "\n" + m)
    .replace(/<\/(p|div|li|h1|h2|h3|h4|h5|h6)>/gi, m => m + "\n");
}

function extractSections(block) {
  /*
    Flexible section syntax:
      [HEADING] This Week
      [HEADING] Look Ahead
      [HEADING] Field Trip Info

    WEEK OF: remains the only required weekly delimiter.
    [HEADING] is optional. If a week has none, the entire weekly block
    is returned as one "Weekly Update" section.
  */
  const content = removeWeekHeading(block);
  const headingRegex = /\[HEADING\](?:\s|&nbsp;|<[^>]+>)*([^<\n\r]+)/gi;

  const matches = [];
  let match;

  while ((match = headingRegex.exec(content)) !== null) {
    const title = decodeEntities(match[1] || "").trim();
    if (title) {
      matches.push({
        title,
        index: match.index,
        markerEnd: headingRegex.lastIndex
      });
    }
  }

  if (!matches.length) {
    return [{
      title: "Weekly Update",
      html: sanitizeHtml(content)
    }];
  }

  const sections = [];

  // Preserve any text before the first [HEADING].
  const intro = content.slice(0, matches[0].index);
  if (textFromHtml(intro).trim()) {
    sections.push({
      title: "Overview",
      html: sanitizeHtml(intro)
    });
  }

  for (let i = 0; i < matches.length; i++) {
    const current = matches[i];
    const next = matches[i + 1];

    // Start after the heading marker/title itself.
    let sectionStart = current.markerEnd;

    // If the heading is inside a paragraph/div/heading tag, skip to its closing tag.
    const closingCandidates = [
      content.indexOf("</p>", sectionStart),
      content.indexOf("</div>", sectionStart),
      content.indexOf("</h1>", sectionStart),
      content.indexOf("</h2>", sectionStart),
      content.indexOf("</h3>", sectionStart),
      content.indexOf("</h4>", sectionStart),
      content.indexOf("<br", sectionStart)
    ].filter(index => index >= 0);

    if (closingCandidates.length) {
      const nearestClose = Math.min(...closingCandidates);
      // Only use that close if it occurs before the next [HEADING] marker.
      if (!next || nearestClose < next.index) {
        sectionStart = nearestClose + 5;
      }
    }

    const sectionEnd = next ? next.index : content.length;

    sections.push({
      title: current.title,
      html: sanitizeHtml(content.slice(sectionStart, sectionEnd))
    });
  }

  return sections;
}

function findWeekHeadingEnd(html) {
  const idx = html.search(/WEEK(?:\s|&nbsp;|<[^>]+>)*OF(?:\s|&nbsp;|<[^>]+>)*:/i);
  return idx >= 0 ? findHeadingEnd(html, idx) : 0;
}

function findHeadingEnd(html, from) {
  const closingTags = [
    "</p>", "</div>", "</h1>", "</h2>", "</h3>", "</h4>", "<br"
  ];
  const found = closingTags
    .map(tag => html.indexOf(tag, from))
    .filter(index => index >= 0);
  return found.length ? Math.min(...found) + 5 : from;
}

function removeWeekHeading(html) {
  const end = findWeekHeadingEnd(html);
  return end ? html.slice(end) : html;
}

function sanitizeHtml(value) {
  let safe = value
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, "")
    .replace(/<object[\s\S]*?<\/object>/gi, "")
    .replace(/<embed[^>]*>/gi, "")
    .replace(/\son\w+=(["']).*?\1/gi, "")
    .replace(/\son\w+=([^\s>]+)/gi, "");

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


async function handleWishListApi() {
  try {
    const upstream = await fetch(WISH_LIST_URL, {
      headers: { "User-Agent": "Mozilla/5.0 Room21Website/1.0" },
      cf: { cacheTtl: 60, cacheEverything: true }
    });

    if (!upstream.ok) {
      return jsonResponse(
        { ok: false, error: "Wish List is temporarily unavailable." },
        upstream.status
      );
    }

    const sourceHtml = await upstream.text();
    const body = extractDocumentBody(sourceHtml);
    const parsed = parseWishList(body);

    return jsonResponse({
      ok: true,
      source: WISH_LIST_URL,
      introHtml: parsed.introHtml,
      dailyUseHtml: parsed.dailyUseHtml,
      funExtrasHtml: parsed.funExtrasHtml,
      donorsChooseHtml: parsed.donorsChooseHtml,
      giftCardsHtml: parsed.giftCardsHtml
    });
  } catch (error) {
    return jsonResponse({
      ok: false,
      error: "Wish List is temporarily unavailable. Please try again shortly."
    }, 502);
  }
}

function parseWishList(sourceHtml) {
  const cleaned = cleanGoogleHtml(sourceHtml || "");
  const blocks = wishListBlocks(cleaned);

  let mode = "intro";
  const buckets = { intro: [], daily: [], fun: [], donors: [], gifts: [] };

  for (const block of blocks) {
    const text = wishPlainText(block);

    if (wishHeadingMatches(text, /^DAILY\s+USE$/i)) {
      mode = "daily";
      continue;
    }
    if (wishHeadingMatches(text, /^FUN\s+EXTRAS$/i)) {
      mode = "fun";
      continue;
    }
    if (wishHeadingMatches(text, /^DONOR'?S?\s+CHOOSE(?:\s+PROJECT)?$/i) ||
        wishHeadingMatches(text, /^DONORSCHOOSE(?:\s+PROJECT)?$/i)) {
      mode = "donors";
      // Preserve any content appearing on the same heading line after the
      // heading itself, such as "(click here)" with its embedded link.
      const remainder = wishHeadingRemainder(block);
      if (remainder) buckets.donors.push(remainder);
      continue;
    }
    if (wishHeadingMatches(text, /^(?:GREAT\s+)?GIFT\s+CARDS?(?:\s+FOR\s+CLASSROOM\s+SUPPLIES)?$/i)) {
      mode = "gifts";
      continue;
    }

    if (isGooglePublishChrome(text)) continue;
    buckets[mode].push(block);
  }

  return {
    introHtml: sanitizeWishListHtml(buckets.intro.join("")),
    dailyUseHtml: sanitizeWishListHtml(buckets.daily.join("")),
    funExtrasHtml: sanitizeWishListHtml(buckets.fun.join("")),
    donorsChooseHtml: sanitizeWishListHtml(buckets.donors.join("")),
    giftCardsHtml: sanitizeWishListHtml(buckets.gifts.join(""))
  };
}

function wishHeadingMatches(text, headingPattern) {
  const normalized = (text || "").replace(/\s+/g, " ").trim();
  const match = normalized.match(/^\[HEADING\]\s*(.*)$/i);
  if (!match) return false;

  // The Donor's Choose heading may contain "(click here)" after the heading.
  // Test both the complete remainder and the part before an opening parenthesis.
  const headingText = match[1].trim();
  const beforeParen = headingText.split(/\s*\(/)[0].trim();
  return headingPattern.test(headingText) || headingPattern.test(beforeParen);
}

function wishHeadingRemainder(block) {
  // For: [HEADING] Donor's Choose project (click <a>here</a>)
  // remove only the heading text and retain the linked "(click here)" portion.
  const html = block || "";
  const marker = /(\[HEADING\](?:\s|&nbsp;|<[^>]+>)*DONOR'?S?(?:\s|&nbsp;|<[^>]+>)+CHOOSE(?:\s|&nbsp;|<[^>]+>)+PROJECT)/i;
  if (!marker.test(html)) return "";
  return html.replace(marker, "").trim();
}

function wishListBlocks(html) {
  // Published Google Docs normally use paragraphs/list items. Keep each as a
  // self-contained block so embedded <a href> links survive unchanged.
  const matches = html.match(
    /<(?:p|li|h1|h2|h3|h4|h5|h6)\b[^>]*>[\s\S]*?<\/(?:p|li|h1|h2|h3|h4|h5|h6)>/gi
  );

  if (matches && matches.length) return matches;

  // Fallback for an unexpected Google markup change.
  return html
    .split(/<br\s*\/?>|\n+/i)
    .map(value => `<p>${value}</p>`)
    .filter(value => wishPlainText(value));
}

function wishPlainText(html) {
  return (html || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;|&#34;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function isGooglePublishChrome(text) {
  const value = (text || "").trim();
  return /^(Published using Google Docs|Report abuse|Learn more|Updated automatically every \d+ minutes?|Wish List)$/i.test(value);
}

function sanitizeWishListHtml(value) {
  let safe = (value || "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, "")
    .replace(/<object[\s\S]*?<\/object>/gi, "")
    .replace(/<embed[^>]*>/gi, "")
    .replace(/\son\w+=(["']).*?\1/gi, "")
    .replace(/\son\w+=([^\s>]+)/gi, "");

  // Preserve every Google Doc hyperlink and make it safe.
  safe = safe.replace(/<a\s+([^>]*href=["'][^"']+["'][^>]*)>/gi, (m, attrs) => {
    const cleaned = attrs
      .replace(/\starget=(["']).*?\1/gi, "")
      .replace(/\srel=(["']).*?\1/gi, "");
    return `<a ${cleaned} target="_blank" rel="noopener noreferrer">`;
  });

  return safe.trim();
}
