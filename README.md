# Kampoeng Semanggi

A website about Kampoeng Semanggi (Jalan Kendung, Sememi, Benowo, Surabaya) with an online catalog. Sellers list their products, buyers browse the catalog and call or WhatsApp the seller to order, and an admin looks after the whole market.

The site is in Indonesian, with English as a second language. Every page has an **ID | EN** switch in the top bar.

## Pages

The public site has four main tabs in the header: Beranda / Home (`/`), Toko / Shops, Tentang kami / About us and Paket / Packages. **About us** opens a small list: Our story (`/sejarah`), Our semanggi, Our people and Collaborations (sections of `/cerita`). On phones and tablets (narrower than 900px) they sit in a row under the logo.

| Page | Who uses it | What it does |
| --- | --- | --- |
| `/` | Everyone | **Beranda / Home** tab: welcome banner and the product catalog with **Call** and **WhatsApp** buttons. Buyers don't need an account. Filters for **Lagi hits** (trending), the buyer's **favourites** and product **categories**; each product shows the shop's open/closed status and has heart and share buttons. A shared link like `/?p=12` opens that product. |
| `/lokasi` | Everyone | **Toko / Shops** tab: every shop's location on a Google Map with its contact number and a **Directions** button, plus an **Instagram** button when the seller has one. Sellers who also (or only) sell from home are marked; their home address stays private and buyers are told the seller sends it on WhatsApp after they order. Shows each shop's opening hours status; favourite shops come first; `/lokasi#lapak-3` scrolls to a shop. |
| `/cerita` | Everyone | **About us** page (groups and intro text edited under **Warga & Mitra** in `/pengelola`): **Our semanggi** (`#semanggi`: the plant, a portion and a short history linking to `/sejarah`) and **Our people** (`#people`): each group (sellers, farmers, batik makers, community leaders, RW/RT/PKK committees, Karang Taruna) has its own section, with photos from `public/warga-foto/` (your own photos of sellers and farmers, and photos from the history document for the community leaders, RW/RT/PKK and Karang Taruna) that open bigger when tapped; batik makers have no photo yet; the sellers' section lists every seller on the site, linking to their shop. Ends with a box linking to `/wisata`. |
| `/kerja-sama` | Everyone | **Collaborations** page (partners, intro and sponsor text edited under **Warga & Mitra** in `/pengelola`): partners such as Astra, the universities and the district, each with a row of photos from the history document (`public/kerja-sama-foto/`) that open bigger when tapped, then the sponsor/partner box with the contacts set under **Situs** in `/pengelola`. Old `/cerita#collab` links forward here. |
| `/wisata` | Everyone | **Paket / Packages** tab (a dropdown: Tours, Experiences, Homestays): **tours** are the full package, a guided visit combining several experiences, and each tour card lists its experiences; **experiences** are one short activity that can be booked on its own (or set to *only inside tours*), and each shows the tours it is part of; **homestays** are overnight stays. The admins list them, with photos, price, duration, group size, location, what's included and the schedule (set dates, or bookable any day with a notice period; past dates are hidden). **Daftar / Tanya** opens a helper that writes the WhatsApp message (always in Indonesian for the host). Shows "coming soon" when there are none. |
| `/sejarah` | Everyone | The history of Kampoeng Semanggi in six short sections, a photo carousel and a download of the original document (`public/sejarah-foto/`). Text is from the residents' document *Sejarah Kampoeng Semanggi Surabaya*. |
| `/penjual` | Sellers | Sign in, add, edit and remove products with photos and prices, mark items sold out, temporarily close the shop with a note for buyers, and update their shop details, shop location and home address. Sellers can set weekly opening hours (Surabaya time) and a category per product. One photo per product, a **Statistik lapak** panel (how many buyers viewed, contacted and shared each product over 7 and 30 days), and a **large orders** setting (notice in days plus a note) that buyers see as a label and can filter by. A **pickup or delivery** setting: pickup only, or delivery to chosen countries (Indonesia first, the rest alphabetical, with a search box) and, when Indonesia is ticked, chosen provinces. Buyers see it on product cards, the product window, shop pages and the shop list, and can filter the catalog to shops that deliver. Delivery is only information: in the order helper, buyers of a shop that delivers can pick **Minta diantar**, type the area and day, and the WhatsApp message asks the seller for the delivery cost, which they agree between them. |
| `/pengelola` | Admins (two accounts) | Create and edit seller accounts (including shop location and home address), reset seller passwords, suspend sellers, hide or delete products, and view totals. Under **Situs**: Kampoeng Semanggi's Instagram (shown in every footer; starts as @kampoeng_semanggi), the sponsor contact name, number and email (starts as admin1semanggi@gmail.com) and the homestay number. Empty numbers show "coming soon" instead of buttons. Under **Warga & Mitra**: the groups on Our People and the partners on Collaborations (add, edit, remove, reorder; name, text, years for partners, icon for groups, and photos with captions, up to 20 per group and 30 per partner), plus the intro texts of both pages and the sponsor invitation; English left empty is machine-translated on save. The starting content is in `content-seed.js` and goes into the database the first time the server starts. Under **Paket**: add, edit and delete tours, experiences and homestays (up to 10 photos, status Tampil / Disembunyikan / Penuh, and for experiences *Hanya di dalam tur*); English boxes left empty are machine-translated on save. A tour has a checklist of the experiences it includes and an **Isi otomatis dari pengalaman** button that writes its description, included list (both languages) and length from them; an experience has a **Bantu tulis deskripsi** helper that writes the description from four short answers. **Situs** also holds the number for tours and experiences. |

### How ordering works

1. An admin creates the seller's account at `/pengelola` and gives the seller their email and starting password. There is no public sign-up.
2. The seller signs in at `/penjual`, changes their password and lists products, which show up in the catalog on `/`.
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

On start, the server makes sure there are two admin accounts. Any it creates get a random password, saved with its email in `data/initial-admin.txt`. Sign in at `/pengelola`, change each password under **Account**, then delete that file.

## Shop locations and maps

Each seller has a **shop location** and a **home address**, each an address plus an optional map pin. Admins fill them in when creating the account, and sellers can update them under **Shop details**. To set a pin, paste a Google Maps link or coordinates, or tap **Use my current location**.

- The shop location and contact number are public: they appear in **Find the shops** on the main page with an embedded Google Map.
- The home address is private: only that seller and the admins see it.

Maps use Google Maps' standard embed, so no API key is needed.

## Deploy it on Vercel

On Vercel the data lives online: accounts, shops and products in a **Turso** database, and product photos in **Vercel Blob**. On your own computer the same code uses `data/semanggi.db` and `data/uploads` instead.

1. In the Vercel project, open **Storage** and connect a **Turso** database and a **Blob** store to the project. This adds `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN` and `BLOB_STORE_ID` (or `BLOB_READ_WRITE_TOKEN` for older Blob stores) to the project's environment variables.
2. Either copy your local data up (step 3), or set `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN2_EMAIL` and `ADMIN2_PASSWORD` under **Settings → Environment Variables** so the two admins are created on first start.
3. To copy your local admins, sellers, products and photos: create a `.env` file in the project folder with `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` (copy them from Vercel's environment variables page; see `.env.example`), then run `npm run copy-to-turso`. Product photos are only copied if Blob credentials are in `.env` too; otherwise re-add them on the live site. The `.env` file is never uploaded to GitHub.
4. Push to GitHub, or press **Redeploy** in Vercel. `vercel.json` makes `/penjual` and `/pengelola` work without `.html`, and sends the old addresses `/seller` and `/admin` to them.

To remove the example shops from the live site: `npm run demo:remove:online` (uses the `.env` file).

Any other Node.js host (Render, Railway, Fly.io) also works: run `npm start` and either set the Turso and Blob variables, or point `DATA_DIR` at a persistent disk.

### Opening hours, favourites, sharing and "lagi hits"

- **Opening hours** are stored per seller as JSON (`{ mon: ["07:00", "15:00"], sun: null }`) in Surabaya time (WIB). A closing time earlier than the opening time means open past midnight. Sellers without hours show no status.
- **Favourites** are kept in the buyer's browser (`localStorage` key `ks-fav`), not on the server.
- **Share** uses the phone's share sheet where available, otherwise a WhatsApp link.
- **Seller statistics:** `POST /api/tap` also takes a `kind` (view, call, whatsapp, order, share), counted once per visitor, product, kind and day into `product_events`; `GET /api/seller/stats` sums them for the last 7 and 30 days. Only totals are stored.
- **Product photos:** one per product. `products.extra_photos` holds extra photos from an earlier version; they aren't shown any more and are deleted from storage with their product.
- **Lagi hits:** `POST /api/tap` counts a visitor's interest in a product (opening it, calling, messaging, ordering or sharing) at most once per visitor per product per day. Only daily totals are stored (`product_taps` table). `GET /api/catalog` returns up to 4 `hot` product ids: those with the most interest over the last 7 days, with at least 3.

### Tours and homestays

Stored in the `listings` table (`kind` tour or homestay, `status` shown, hidden or full). `GET /api/listings` returns everything that isn't hidden, with past tour dates removed (Surabaya time). Admin endpoints: `/api/admin/listings[/:id]` and `/api/admin/listings/:id/photos`. When an admin leaves the English name, description or inclusions empty, they're translated with the same free MyMemory service as order notes (`en_auto` marks them, so they're translated again on the next save).

### Admin sign-in

The two admins sign in at `/pengelola` with **admin1semanggi@gmail.com** and **admin2semanggi@gmail.com** (override with `ADMIN_EMAIL` / `ADMIN2_EMAIL`). The email is only the username: the website keeps its own password, separate from Gmail. Older databases whose admins used admin1@ / admin2@kampoengsemanggi.local are renamed on start, keeping their passwords.

## How it's built

- `server.js` is an Express server. `db.js` connects it to Turso (online) or a local SQLite file, and photos go to Vercel Blob or `data/uploads`.
- `public/` holds the pages: `index.html` + `shop.js` (+ `order.js` for the order helper), `sejarah.html` + `sejarah.js`, `seller.html` + `seller.js`, `admin.html` + `admin.js`, plus the shared `styles.css`, `common.js` and `i18n.js`.
- Passwords are hashed with scrypt. Sign-in uses an HTTP-only session cookie. Sign-in attempts are limited to 10 per 15 minutes per IP address.
- The public pages show each seller's shop name, shop location and contact number. Home addresses are visible only to that seller and the admins.
- Call buttons are `tel:` links and WhatsApp buttons are `wa.me` links; Indonesian numbers like `0812…` are converted to `62812…` for WhatsApp.

### Languages

- The Indonesian text lives in the HTML pages: to change wording, edit the HTML. `public/i18n.js` holds the English translation of each piece of text, plus Indonesian only for text the scripts build. HTML elements are linked to their translation with `data-i18n="key"` (text), `data-i18n-html="key"` (text with markup) or `data-i18n-attr="placeholder:key"` (attributes). Scripts call `t("key")`. If you change Indonesian text in the HTML, update its English line in `i18n.js` too.
- The site always opens in Indonesian. English only shows after a visitor taps **EN**, and that choice is remembered in their browser.
- Server error messages are in `MESSAGES` at the top of `server.js`. The pages send the chosen language in an `X-Lang` header.
- To add a language, add its code to `LANGS` in `i18n.js` and a column to `TEXT` there and to `MESSAGES` in `server.js`.
- Text that sellers type (shop names, product names and descriptions, addresses) isn't translated.

### API

| Method & path | Who |
| --- | --- |
| `GET /api/catalog`, `GET /api/stalls`, `POST /api/tap`, `POST /api/translate` (30 notes per hour per IP) | anyone |
| `POST /api/auth/login`, `/logout`, `/password`, `GET /api/me` | sellers and admins |
| `/api/seller/profile`, `/api/seller/products[/:id]` | signed-in sellers |
| `/api/admin/overview`, `/api/admin/sellers[/:id]` (create, edit, status), `/api/admin/sellers/:id/password`, `/api/admin/products[/:id]` | admins |

## Example sellers

To try the site with some shops and products, run `npm run demo:add`. It adds six example shops with 20 products, all with `@contoh.test` sign-in emails; their passwords are saved in `data/demo-sellers.txt`. Run `npm run demo:remove` to delete them again before real sellers use the site.

## Seller accounts

Admins create a seller with just a **phone number** and a starting password (Pengelola → Penjual → Buat akun penjual). The seller signs in at `/penjual` with that phone number; any way of writing it works (`0812 3456 7890`, `+62 812-3456-7890`, `62812…`). The first time they sign in they must fill in their details (name, contact number, shop address unless they only sell from home, and home address) before they can do anything else; their shop only appears on the website after that. Sellers created earlier with an email keep signing in with their email.

## Forgotten passwords (WhatsApp code)

On `/penjual`, **Lupa kata sandi?** lets a seller reset their password with a 6-digit code sent to their WhatsApp: the number they sign in with, or for older email sign-ins their contact number. Codes last 10 minutes and allow 5 tries; a number gets at most one code a minute and three an hour; the form never reveals whether a number is registered. After a reset the seller is signed in and signed out everywhere else.

Codes are sent through [Fonnte](https://fonnte.com), an Indonesian WhatsApp gateway. Sign up, connect the WhatsApp number that should send the codes, copy the device's token, and set it as `FONNTE_TOKEN` in Vercel (Settings → Environment Variables), then redeploy. Without it, the form tells sellers to contact the admin, who can still use **Reset kata sandi** on `/pengelola`.

## Languages

The public pages come in 16 languages, picked from the globe dropdown in the header (sorted by English name): Arabic, Burmese, Chinese (Simplified), English, Filipino, French, Hindi, Indonesian, Japanese, Khmer, Korean, Lao, Malay, Spanish, Thai and Vietnamese. Indonesian lives in the HTML and English in `public/i18n.js` as before; every other language is a file in `public/lang/<code>.json` with the same keys as the English, loaded only when picked. Text missing from a file shows in English. Arabic switches the page to right-to-left. A first visit opens in Indonesian, or in the phone's language when it is one of the others (not English); the choice is remembered. Text that sellers and admins type (products, packages, groups, partners) exists in Indonesian and English only, so other languages show the English. Buyers writing an order note in any of these languages get it translated into Indonesian for the seller, with a translation back so they can check it. The seller and admin pages offer Indonesian and English only. They always open in Indonesian; their ID/EN switch lasts for that visit and doesn't change the language remembered for the public pages.

## Admin help (Bantuan)

The **Bantuan** button at the top of `/pengelola` opens a help panel in Indonesian (`public/admin-help.js`). It has seven guided tours that dim the page and light up one part at a time with a speech bubble (Next, Back, Skip, and some "tap it yourself" steps), plus a written guide with search. Finished tours get a tick, remembered on that device. A tour never saves or deletes anything: while it runs, clicks outside the bubble and the highlighted part are blocked, forms can't be submitted, and anything it opened or filled in is put back afterwards. Small **?** buttons beside the section headings open the guide at the matching topic. The first time an admin signs in on a device, they're offered the first tour. When a button or field on the admin page changes, update the matching tour step and guide text in that file.

## Shop pages and posters

Every shop has its own page at `/lapak?id=<shop id>`: its details (address, opening hours, map, contact buttons), its posters and ads, and all of its products with search and categories. Shop names on product cards, in the product window and the comparison list, and the shop cards on `/lokasi` link to it. The home catalog still lists every product.

Sellers add posters under **Poster & iklan** on `/penjual`: an image and an optional caption, up to 10 per shop, newest first. Admins see every poster under **Produk** on `/pengelola` and can remove any of them. Deleting a shop also deletes its posters.

## Backups

`npm run backup` saves a copy of the live (Turso) database to `backups/<date>/semanggi.db` on your computer (the folder isn't uploaded to GitHub). Sign-in sessions, attempt counters and reset codes are left out, and photos stay in Vercel Blob.

A GitHub Actions workflow (`.github/workflows/backup.yml`) also does this every day at 02:00 Surabaya time and keeps each copy for 90 days under **Actions → Database backup → a run → Artifacts**. Because the repository is public, it encrypts the copy with a password first and refuses to run without one. To switch it on, add three secrets under GitHub → the repository → **Settings → Secrets and variables → Actions → New repository secret**:

- `TURSO_DATABASE_URL`: the same value as in Vercel.
- `TURSO_AUTH_TOKEN`: preferably a read-only token (`turso db tokens create <database name> --read-only`).
- `BACKUP_PASSWORD`: a long password only you know. Keep it somewhere safe: without it the backups can't be opened.

To try it straight away, open **Actions → Database backup → Run workflow**.

To use a backup: download and unzip the artifact, put `BACKUP_PASSWORD` in `.env`, and run `npm run backup:open -- backups/<date>/semanggi.db.enc` (make the folder and put the file in it first). To put it back on the live site, which replaces everything there, run in Git Bash: `DATA_DIR=backups/<date> npm run copy-to-turso -- --replace`.

## Security

- **Passwords** are hashed with scrypt; sign-in uses a random token in an HTTP-only, SameSite=Lax cookie (Secure on Vercel), stored hashed. Admin passwords need 12+ characters; all passwords are capped at 200.
- **Rate limits** are counted in the database (`rate_limits`), so they hold across Vercel's server copies: sign-in 20 tries per address and 10 per account every 15 minutes, password changes, reset codes, translations and the view counter. Wrong emails take as long to check as wrong passwords, so accounts can't be discovered by timing.
- **Cross-site requests**: the API refuses changes whose `Origin` isn't the site itself.
- **Headers** (in `vercel.json`, and in `server.js` when running locally): a Content Security Policy that only allows the site's own scripts plus Google Fonts and Google Maps, no framing by other sites, HSTS, `nosniff`, a strict referrer policy and a limited permissions policy. API answers aren't cached.
- **Uploads** must really be JPG, PNG or WebP (checked from the file's bytes), up to 1.5 MB; SVG and other types are refused.
- **Access**: sellers can only change their own shop, products and posters; admin routes need an admin; home addresses are only shown to that seller and admins.
