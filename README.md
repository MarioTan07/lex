# Kampoeng Semanggi

A website about Kampoeng Semanggi (Jalan Kendung, Sememi, Benowo, Surabaya) with an online catalog. Sellers list their products, buyers browse the catalog and call or WhatsApp the seller to order, and an admin looks after the whole market.

The site is in Indonesian, with English as a second language. Every page has an **ID | EN** switch in the top bar.

## Pages

| Page | Who uses it | What it does |
| --- | --- | --- |
| `/` | Everyone | About Kampoeng Semanggi, the product catalog with **Call** and **WhatsApp** buttons, and every shop's location on a Google Map with its contact number and a **Directions** button. Buyers don't need an account. |
| `/seller` | Sellers | Sign in, add, edit and remove products with photos and prices, mark items sold out, temporarily close the shop with a note for buyers, and update their shop details, shop location and home address. |
| `/admin` | Admins (two accounts) | Create and edit seller accounts (including shop location and home address), reset seller passwords, suspend sellers, hide or delete products, and view totals. |

### How ordering works

1. An admin creates the seller's account at `/admin` and gives the seller their email and starting password. There is no public sign-up.
2. The seller signs in at `/seller`, changes their password and lists products, which show up in the catalog on `/`.
3. A buyer finds something in the catalog and taps **Call** or **WhatsApp** on it. WhatsApp opens with a message naming the shop and product, ready to send. The seller's contact number is used for both, so it should be one that's on WhatsApp.
   On the English version of the site the WhatsApp button says **Order** and opens a short step-by-step helper instead (see below).
4. The buyer taps **Directions** on the seller's shop to get there, picks up the order and pays in person.

Tapping a product's photo or name opens **every shop that sells it**, each with its price, a small Google Map and the contact buttons. Names match when they're the same apart from capitals and spaces, or when one contains the other ("Pecel semanggi" matches "Pecel Semanggi Suroboyo"). The list can be sorted by **cheapest** or **closest** (straight-line distance from the buyer's location, which the browser asks permission for; shops without a map pin go last), and sold-out or temporarily closed shops can be hidden.

### Order helper for English-speaking buyers

Sellers read Indonesian, so on the English site the **Order** button asks the buyer, one question at a time: which products from that shop and how many, when they'll pick up (as soon as possible, or a half-hour slot between 07.00 and 21.00 today or tomorrow), any ready-made requests (sauce on the side, not spicy, extra spicy, extra krupuk), an optional note, and the name for the order. It then shows the finished WhatsApp message **in Indonesian**, with the English meaning, and an **Open WhatsApp** button. The site still doesn't store the order.

The optional note is translated to Indonesian through `POST /api/translate`, which uses the free [MyMemory](https://mymemory.translated.net/) service (no account; about 5,000 characters a day, or 50,000 with `TRANSLATE_EMAIL` set). Free machine translation can get things wrong, so the message also includes the buyer's original English, and the buyer is shown the translation turned back into English to check it. If translation fails, the note is sent as written.

The site doesn't take orders itself. Orders placed before this change are still in the database (`orders` and `order_items` tables) but aren't shown anywhere.

## Run it on your computer

You need [Node.js](https://nodejs.org) 22.13 or newer.

```bash
npm install
npm start
```

Open http://localhost:3000.

On start, the server makes sure there are two admin accounts. Any it creates get a random password, saved with its email in `data/initial-admin.txt`. Sign in at `/admin`, change each password under **Account**, then delete that file.

## Shop locations and maps

Each seller has a **shop location** and a **home address**, each an address plus an optional map pin. Admins fill them in when creating the account, and sellers can update them under **Shop details**. To set a pin, paste a Google Maps link or coordinates, or tap **Use my current location**.

- The shop location and contact number are public: they appear in **Find the shops** on the main page with an embedded Google Map.
- The home address is private: only that seller and the admins see it.

Maps use Google Maps' standard embed, so no API key is needed.

## Deploy it

Any host that runs Node.js works, such as Render, Railway or Fly.io.

- Start command: `npm start`
- Environment variables: see `.env.example`. Set `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN2_EMAIL` and `ADMIN2_PASSWORD` for the first start, and `NODE_ENV=production`.
- **Persistent disk:** all data (the SQLite database and uploaded photos) lives in `DATA_DIR`. Point it at a persistent disk or volume, or everything is lost when the host restarts.

GitHub Pages can't run this, because it only serves static files and this site needs its server.

## How it's built

- `server.js` is an Express server using Node's built-in SQLite (`node:sqlite`), so the only dependency is Express.
- `public/` holds the pages: `index.html` + `shop.js` (+ `order.js` for the order helper), `seller.html` + `seller.js`, `admin.html` + `admin.js`, plus the shared `styles.css`, `common.js` and `i18n.js`.
- Passwords are hashed with scrypt. Sign-in uses an HTTP-only session cookie. Sign-in attempts are limited to 10 per 15 minutes per IP address.
- The public pages show each seller's shop name, shop location and contact number. Home addresses are visible only to that seller and the admins.
- Call buttons are `tel:` links and WhatsApp buttons are `wa.me` links; Indonesian numbers like `0812…` are converted to `62812…` for WhatsApp.

### Languages

- `public/i18n.js` holds all page text in Indonesian and English. HTML elements point at it with `data-i18n="key"` (text), `data-i18n-html="key"` (text with markup) or `data-i18n-attr="placeholder:key"` (attributes). Scripts call `t("key")`.
- A visitor's choice is remembered in their browser. On a first visit the site uses the browser's language if it's Indonesian or English, and Indonesian otherwise.
- Server error messages are in `MESSAGES` at the top of `server.js`. The pages send the chosen language in an `X-Lang` header.
- To add a language, add its code to `LANGS` in `i18n.js` and a column to `TEXT` there and to `MESSAGES` in `server.js`.
- Text that sellers type (shop names, product names and descriptions, addresses) isn't translated.

### API

| Method & path | Who |
| --- | --- |
| `GET /api/catalog`, `GET /api/stalls`, `POST /api/translate` (30 notes per hour per IP) | anyone |
| `POST /api/auth/login`, `/logout`, `/password`, `GET /api/me` | sellers and admins |
| `/api/seller/profile`, `/api/seller/products[/:id]` | signed-in sellers |
| `/api/admin/overview`, `/api/admin/sellers[/:id]` (create, edit, status), `/api/admin/sellers/:id/password`, `/api/admin/products[/:id]` | admins |
