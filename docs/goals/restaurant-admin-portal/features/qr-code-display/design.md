# Design: QR code display/download

## Blob fetch, not `<img src>`

`GET /restaurants/:id/qr` requires session auth (cookie-based, per
[`docs/architecture/system-overview.md`](../../../../architecture/system-overview.md)). A plain
`<img src="/restaurants/:id/qr">` would send the browser's own request without going through the app's
fetch wrapper, and cross-origin `<img>` requests don't reliably carry `credentials: "include"` the way an
explicit `fetch()` call does. `apiGetRestaurantQr` instead does an authenticated `fetch` with
`credentials: "include"`, reads the response as a `Blob`, and turns it into an object URL
(`URL.createObjectURL`) that an `<img>` tag in the modal can then point at.

## Lifecycle

The object URL is created fresh each time the "QR code" button is clicked (`qrM` mutation) and explicitly
revoked (`URL.revokeObjectURL`) when the modal closes, to avoid leaking blob URLs if an admin opens the
modal for several restaurants in one session.

## Tradeoffs

No caching - reopening the modal for the same restaurant re-fetches the PNG every time. Given QR codes are
opened rarely (an occasional admin action, not a hot path) and the payload is small, this was judged not
worth adding query caching for.
