# Kampoeng Semanggi

A website about Kampung Semanggi (Jalan Kendung, Sememi, Benowo, Surabaya) with an online catalog. Sellers list their products, buyers order from the catalog, and an admin looks after the whole market.

## Pages

| Page | Who uses it | What it does |
| --- | --- | --- |
| `/` | Everyone | About the kampung, the product catalog, basket and order tracking. Buyers don't need an account. |
| `/seller` | Sellers | Sign up, add, edit and remove products with photos and prices, mark items sold out, and handle incoming orders. |
| `/admin` | Admin | Approve or suspend sellers, hide or delete products, see and change every order, and view totals. |

### How an order flows

1. A seller signs up at `/seller`. Their stall stays **pending** until the admin approves it.
2. Once approved, the seller's products show up in the catalog on `/`.
3. A buyer adds items to the basket and places the order with their name, WhatsApp number and pick-up or delivery. Items from different stalls become separate orders, each with an 8-character order code.
4. The seller sees the order on `/seller` and moves it along: **Accept → Ready → Completed**, or **Decline**.
5. The buyer sees the status under **My orders** on the same device, or on any device by entering the order code. They can cancel while the order is still **New**.

Payment happens in person, on pick-up or delivery.

## Run it on your computer

You need [Node.js](https://nodejs.org) 22.13 or newer.

```bash
npm install
npm start
```

Open http://localhost:3000.

The first time it starts, the server creates the admin account. Its email and a random password are saved in `data/initial-admin.txt`. Sign in at `/admin`, change the password under **Account**, then delete that file.

## Deploy it

Any host that runs Node.js works, such as Render, Railway or Fly.io.

- Start command: `npm start`
- Environment variables: see `.env.example`. Set `ADMIN_EMAIL` and `ADMIN_PASSWORD` for the first start, and `NODE_ENV=production`.
- **Persistent disk:** all data (the SQLite database and uploaded photos) lives in `DATA_DIR`. Point it at a persistent disk or volume, or everything is lost when the host restarts.

GitHub Pages can't run this, because it only serves static files and this site needs its server.

## How it's built

- `server.js` is an Express server using Node's built-in SQLite (`node:sqlite`), so the only dependency is Express.
- `public/` holds the pages: `index.html` + `shop.js`, `seller.html` + `seller.js`, `admin.html` + `admin.js`, plus the shared `styles.css` and `common.js`.
- Passwords are hashed with scrypt. Sign-in uses an HTTP-only session cookie. Sign-in attempts are limited to 10 per 15 minutes per IP address.
- Prices are always taken from the database when an order is placed, so buyers can't change what they pay.
- Buyers only see their order status and the seller's WhatsApp number. The buyer's contact details and address are visible only to that seller and the admin.

### API

| Method & path | Who |
| --- | --- |
| `GET /api/catalog` | anyone |
| `POST /api/orders`, `GET /api/orders?codes=…`, `POST /api/orders/:code/cancel` | anyone (buyers) |
| `POST /api/auth/register`, `/login`, `/logout`, `/password`, `GET /api/me` | sellers and admin |
| `/api/seller/profile`, `/api/seller/products[/:id]`, `/api/seller/orders[/:id]` | signed-in sellers |
| `/api/admin/overview`, `/api/admin/sellers[/:id]`, `/api/admin/products[/:id]`, `/api/admin/orders[/:id]` | admin |
