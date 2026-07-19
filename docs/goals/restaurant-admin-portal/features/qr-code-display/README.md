# Feature: QR code display/download in the admin portal

## What it does

The API already generated a PNG QR code per restaurant (`GET /restaurants/:id/qr`, pre-existing route) that
links to that restaurant's public diner-facing menu, but nothing in the admin portal surfaced it. Restaurant
admins can now click "QR code" next to a restaurant in the restaurant list to fetch and view that PNG in a
modal, with a download link - so they can actually print/display it without hitting the API directly.

## Entry points in code

- `apps/admin-portal/src/routes/restaurants.tsx` - the restaurant list page; QR modal state (`qrModal`,
  `qrError`), the `qrM` mutation that fetches the blob, and the modal markup itself.
- `apps/admin-portal/src/lib/api-client.ts` - `apiGetRestaurantQr`, fetches the PNG as a blob and returns
  an object URL.
- `GET /restaurants/:id/qr` (`apps/api`) - the pre-existing route this feature consumes; unchanged by this
  feature.

## See also

- [`design.md`](./design.md) - why this fetches a blob client-side instead of a plain `<img src>`
- [`task-log.md`](./task-log.md) - chronological history
