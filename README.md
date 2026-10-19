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
