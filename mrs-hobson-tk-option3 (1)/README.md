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
