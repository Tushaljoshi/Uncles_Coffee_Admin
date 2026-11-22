# Uncle's Coffee Admin

The Uncle's Coffee Admin is a React dashboard for managing cafe menu items,
tables, orders, reservations, and operating metrics. It is a Vite frontend and
expects a separate backend API.

## Contents

- [Features](#features)
- [Technology](#technology)
- [Requirements](#requirements)
- [Run locally](#run-locally)
- [Configuration](#configuration)
- [Admin pages](#admin-pages)
- [Backend API](#backend-api)
- [Security notes](#security-notes)
- [Project structure](#project-structure)

## Features

- Cafe-themed responsive interface with sidebar navigation.
- Dashboard with date filters, revenue and order trends, payment summaries,
  menu performance, and order and booking status breakdowns.
- Menu catalog search, category filtering, create/edit/delete actions, images,
  pricing, availability, and item options.
- Table management with search, active status, image uploads, and date/time/
  guest-count availability checks.
- Order tracking with status, customer, table, and text filters; order details
  and status history; kitchen status updates; and counter-payment confirmation.
- Reservation tracking with status and payment filters; reservation details,
  status history, and counter-payment confirmation.

## Technology

- React 18 and React Router
- Vite 5
- Tailwind CSS
- Recharts
- Lucide React

## Requirements

- Node.js 18 or newer
- npm
- The cafe backend API, normally available at `http://localhost:5000`

## Run locally

From the project directory:

```sh
npm install
npm run dev
```

Vite serves the frontend at `http://localhost:5174` by default. In development,
requests to `/api` are proxied to `http://localhost:5000`.

Create a production build with:

```sh
npm run build
```

Preview the production build locally with:

```sh
npm run preview
```

## Configuration

The API helper uses `/api` by default. To use a different backend, create a
local `.env.local` file and set the API base URL:

```dotenv
VITE_API_BASE_URL=http://localhost:5000
```

The frontend adds `/api` to the configured URL unless it already ends with
`/api`. Restart Vite after changing environment variables. Do not put secrets,
passwords, tokens, or private credentials in `VITE_*` variables: Vite exposes
these values in the browser bundle.

## Admin pages

The current routes are:

| Route | Page | Main tasks |
| --- | --- | --- |
| `/` | Login | Displays the admin sign-in form. |
| `/dashboard` | Analytics | Reviews order, menu, booking, and payment indicators. |
| `/menu` | Menu management | Searches, filters, creates, edits, and deletes menu items. |
| `/tables` | Table management | Manages tables and checks availability by date, time, and party size. |
| `/orders` | Order management | Tracks orders, changes kitchen status, and confirms counter payments. |
| `/bookings` | Booking management | Tracks reservations, changes booking status, and confirms counter payments. |

### Orders

Order statuses supported by the admin UI are `cart`, `placed`, `accepted`,
`preparing`, `ready`, `served`, and `cancelled`. For eligible counter/cash
orders, an admin can confirm that payment was collected.

### Bookings

Booking statuses supported by the admin UI are `requested`, `confirmed`,
`preparing`, `ready`, `checked_in`, `completed`, and `cancelled`. Counter
payment confirmation records the collecting staff member and notes.

### Analytics and payments

There is no separate payment-list endpoint in the current frontend contract.
The dashboard derives payment counts and amounts from the payment status and
amounts on orders and reservations. It counts order totals and booking fees,
and shows menu inventory/category totals from the current catalog. These
figures are operational summaries, not a substitute for accounting or a
payment-provider reconciliation report.

## Backend API

The frontend expects JSON responses with a `success` flag and the resource
arrays listed below. Requests are made relative to the configured API root
(normally `/api`). The backend must support CORS when frontend and backend
origins differ.

### Menu

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/menu` | List menu items. |
| `POST` | `/menu` | Create a menu item with multipart form data and optional image. |
| `PUT` | `/menu/:itemId` | Update a menu item with multipart form data. |
| `DELETE` | `/menu/:itemId` | Delete a menu item. |
| `GET` | `/menu/file/:fileId` | Retrieve an uploaded menu image. |

The list response is expected to contain an `items` array. Menu forms send
fields such as item name/code, category, description, prices, badges,
availability, options, and an optional image.

### Tables

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/tables/all` | List tables. |
| `POST` | `/tables` | Create a table with multipart form data and image. |
| `PUT` | `/tables/:tableId` | Update a table with multipart form data. |
| `DELETE` | `/tables/:tableId` | Delete a table. |
| `GET` | `/tables/availability?date=YYYY-MM-DD&time=HH:mm&guests=N` | Check available tables. |
| `GET` | `/tables/file/:fileId` | Retrieve a table image. |

Table list and availability responses are expected to contain a `tables` array.
Availability may also return `availableCount`, `date`, `time`, and `guests`.

### Orders and payments

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/orders` | List orders. Optional query filters: `status`, `mobile`, `tableId`, `search`, and `includeCart`. |
| `PATCH` | `/orders/:orderId/status` | Change an order status and append a status-history message. |
| `PATCH` | `/payments/order/:orderId/confirm-counter` | Confirm counter/cash payment for an order. |

Order list responses are expected to contain an `orders` array. A status update
uses JSON such as:

```json
{
  "status": "accepted",
  "message": "Order accepted by kitchen."
}
```

Counter-payment confirmation accepts a JSON `notes` field. The admin UI sends a
generic cash-collection note.

### Reservations and booking payments

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/reservations` | List reservations. |
| `PATCH` | `/reservations/:bookingId/status` | Change a booking status and append a status-history message. |
| `PATCH` | `/reservations/:bookingId/confirm-counter` | Confirm counter payment and record the collecting staff member. |
| `GET` | `/reservations/file/:fileId` | Retrieve a reservation image. |

Reservation list responses are expected to contain a `reservations` array. A
status update uses JSON such as:

```json
{
  "status": "preparing",
  "message": "Your table is preparing. Please proceed."
}
```

Counter-payment confirmation accepts `collectedBy` and `notes` fields.

### Dashboard data

The analytics page fetches `GET /orders`, `GET /menu`, and
`GET /reservations`. It filters order and booking activity in the browser for
the selected period; menu availability and category totals describe the
current catalog.

## Security notes

- No login email or password is documented in this file.
- The current sign-in form compares credentials in frontend code. This is not
  secure authentication: browser code can be inspected, and the admin routes
  are not protected by a server-verified session.
- Before production use, move authentication and authorization to the backend,
  protect every admin API endpoint, and use secure session/token handling.
- Never store real credentials in source code, README files, browser-visible
  environment variables, or committed configuration. Use a secret manager or
  protected server-side environment configuration.
- Only confirm a counter payment after staff have actually collected it.

## Project structure

```text
src/
  components/
    LoginForm.jsx       Sign-in form
    Sidebar.jsx         Admin page navigation
    TopBar.jsx          Page heading and logout menu
  pages/
    dashboard.jsx       Analytics dashboard
    menu.jsx            Menu catalog management
    tables.jsx          Table management and availability
    orders.jsx          Order and counter-payment management
    bookings.jsx        Reservation and counter-payment management
  utils/
    api.js              API base URL and fetch helper
  App.jsx               Application routes
vite.config.js          Vite server and development API proxy
tailwind.config.js      Cafe color theme
```
