# Nook — interior design studio site

A one-page site for Nook, a fictional interior design studio. The hero is a Kling AI video of a living room, and the scroll section takes a Kling AI house apart frame by frame.

## Run it locally

```bash
node server.mjs
```

Then open http://localhost:3000. Phones on the same Wi-Fi can use the address it prints.

## Deploy

Static site: no build step. Netlify publishes the repository root (`netlify.toml`).

## Notes

- `media/house/` holds the 121 frames of the exploding-house clip; `main.js` draws them on a canvas from scroll position.
- Studio details, prices and project names are sample content.
- Project and studio photos are from Unsplash (credited in the footer).

## Media hosting

Video, house frames and photos are served from jsDelivr, which mirrors this repo
and is far faster than Netlify for visitors in India. The links in `index.html`
(`data-media` on `<html>` and every `src`) are pinned to the commit that holds the
media. If you change anything in `media/`, push it, then replace that commit hash
in `index.html` with the new one.
