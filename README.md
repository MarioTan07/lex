# Kampoeng Semanggi

A website about Kampung Semanggi (Jalan Kendung, Sememi, Benowo, Surabaya) with a market where sellers list their products and buyers place orders.

- `kampung-semanggi.html` is the whole site: one HTML file with its CSS and JavaScript.
- Live version: https://claude.ai/artifact/6RktQiWRFLMvcZS2xXJuq4

## How the market works

The shop, basket, orders and seller desk use the claude.ai artifact runtime (`window.claude.use("db")` and `window.claude.use("user")`) to store stalls and orders. That runtime only exists when the page is opened on claude.ai.

If you open the file anywhere else (locally, GitHub Pages), the "about" part works. The market shows a notice that it only connects on claude.ai. To run the market on your own hosting, replace the `db` and `user` calls with a backend such as Firebase or Supabase.

### Data layout

- `stalls/<sellerId>`: `{ name, phone, products: { <pid>: { name, price, unit, desc, available, photoV, createdAt } } }`
- `stalls/<sellerId>/photos/<pid>`: `{ src }` (a compressed JPEG data URL)
- `orders/<id>`: `{ stallId, stallName, buyerId, items[], total, buyerName, contact, fulfil, address, note, status, createdAt }`

Each seller can only write their own `stalls/<sellerId>` subtree.
