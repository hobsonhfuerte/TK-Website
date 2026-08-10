# Mrs. Hobson's TK — Room 21

Production website for Heather Hobson's Transitional Kindergarten classroom at Fuerte Elementary.

## Cloudflare Workers Static Assets

This project is intentionally a pure static site. Cloudflare serves everything in `public/` as static assets.

### Cloudflare build settings

- **Build command:** leave blank
- **Deploy command:** `npx wrangler deploy`
- **Root directory:** repository root
- **Worker name:** `mrs-hobson-tk`

IMPORTANT: If the Worker you already created in Cloudflare has a different name, either:
1. rename the Worker to `mrs-hobson-tk`, or
2. edit the `"name"` field in `wrangler.jsonc` so it exactly matches the Worker name in Cloudflare.

Cloudflare requires those names to match when Git Builds are connected.

## Website structure

- `public/index.html` — Home
- `public/weekly-news.html`
- `public/scholastic.html`
- `public/tk-faqs.html`
- `public/wish-list.html`
- `public/photos.html`
- `public/about.html`
- `public/calendar.html`
- `public/assets/css/site.css`
- `public/assets/js/site.js`
- `public/assets/images/`

## Adding photos manually

Until Google photo automation is added:

1. Put photo files in `public/assets/photos/`
2. Open `public/assets/js/site.js`
3. Add entries to `classroomPhotos`, for example:

```js
{ src: "assets/photos/first-day.jpg", caption: "Our first day in Room 21!" },
```

## Later phase

After launch, the Google Docs / Drive content can be connected without redesigning the site.


## Final Weekly News Design

Published Google Doc:
https://docs.google.com/document/d/e/2PACX-1vQ4bA4N4M1JzWZTaAFxgXl0iyXldLpBbZt00LNYnZfCPEQd614aVoi2TLWM6KyqPNMeLJ2I4v9eUA2r/pub

Required weekly delimiter:
`WEEK OF:`

Behavior:
- First WEEK OF block = Current Week (left column)
- All older WEEK OF blocks = Previous Weekly News (right column)
- LOOK AHEAD or COMING UP is rendered inside the Current Week card
- Clicking an older week opens the full archived content and preserves links
- Instagram @fantasticfuertekinder is shown in the top bar on all pages


## Flexible Weekly News Headings

The only required syntax in the Google Doc is:

`WEEK OF:`

Optional section headings use:

`[HEADING] Your Heading Here`

Examples:

```text
WEEK OF: August 17–21, 2026

[HEADING] This Week
Language Arts...
Math...

[HEADING] Look Ahead
College Wear Wednesday...

[HEADING] Field Trip Info
Details and links...
```

Heather can use any heading text she wants, change headings week to week,
or use no headings at all. If there are no [HEADING] markers in a week,
the site displays that week's content as one continuous Weekly Update section.
