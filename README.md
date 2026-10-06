# draw in my universe

A browser-based hand-tracking experiment that turns finger movement into a trail of stars.

## How it works

1. The browser requests webcam permission.
2. MediaPipe Hand Landmarker detects one hand from the live video feed.
3. Holding an extended index finger still starts drawing.
4. Finger movement is sampled into spaced points and rendered as stars on a canvas.
5. Holding an open palm finishes the drawing.
6. Saved drawings are stored as point coordinates in `localStorage` and rendered back into a personal collection.

## Tech

- JavaScript
- Vite
- MediaPipe Tasks Vision
- Canvas API
- `navigator.mediaDevices.getUserMedia()`
- `localStorage`

## Privacy

There is no custom backend in this project. The webcam stream is used by the browser-side hand-tracking experience and is not intentionally uploaded to an application server. Saved drawings stay in the browser's local storage on the current device.

MediaPipe runtime/model files are loaded from public Google/jsDelivr resources.

## Run locally

```bash
npm install
npm run dev
```

Open the local Vite URL, allow camera access, and use:

- **index finger:** hold still briefly, then move to draw
- **open palm:** hold to finish
- **save:** adds the drawing to your local collection

## Notes

This repository is a standalone extraction of an interactive experiment originally built into my personal portfolio. Portfolio-specific code, unrelated site logic, analytics/data integrations, and private assets are intentionally excluded.
