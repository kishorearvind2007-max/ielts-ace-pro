# Certificate Template Asset

Place your final certificate background image in this folder as:

- certificate-background.png

Recommended export:

- A4 landscape
- 3508x2480 px (300 DPI)
- PNG

The certificate renderer will overlay dynamic fields (name, register number, module bands, overall band, certificate ID, issue date, QR URL) on top of this image.

Rendering behavior:

- Preview route (`/api/certificates/preview/:certificateId`) and download route (`/api/certificates/download/:certificateId`) now share the same HTML layout source to keep typography and positioning aligned.
- Download route renders a PDF from that shared HTML using headless Chromium (Playwright) for visual parity with preview.
- If Chromium is unavailable at runtime, download automatically falls back to the legacy pdf-lib renderer so certificate downloads continue to work.
