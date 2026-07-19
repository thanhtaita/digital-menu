## 2026-07-12 17:29 — Document admin-portal QR code display in CLAUDE.md and api-routes skill

**Commit:** 0a100cd

Documented the QR-code feature shipped in the immediately preceding commit in the always-loaded project
knowledge base (`CLAUDE.md`) and the `api-routes` skill.

## 2026-07-12 17:29 — Add QR code display/download to the admin portal

**Commit:** fc05bf9

Restaurants can now fetch and view the diner-menu QR code the API already generates
(`GET /restaurants/:id/qr`) directly from the restaurant list, with a download link for the PNG.
