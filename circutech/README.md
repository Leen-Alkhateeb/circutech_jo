# ♻ CircuTech Jo

CircuTech Jo is a vanilla HTML, CSS, and JavaScript project exploring electronics reuse, e-waste awareness, device estimates, marketplace listings, and sustainable technology. It is a browser-based demo: account and activity data are stored locally, and there is no application server or shared database.

## ✨ Features

- **News:** Browse articles, open stable article URLs, and return to the listing. Administrators can create, edit, publish, draft, search, filter, and delete articles. Local article covers are in `assets/`.
- **Sign-in and roles:** Register and sign in as a regular user or administrator. Admins have a separate dashboard; Business Workspace access can be assigned to an account from Admin user management.
- **User dashboard:** Device scanner, estimates, rewards, drop-off information, EcoBot, Business Workspace for authorized accounts, and personal Settings.
- **User statistics:** Shows device scans, estimated value, estimated CO₂, points, and the number of unique articles opened while signed in. Estimates are not verified recycling totals.
- **Admin dashboard:** Browser-local account and role management, platform summaries, News management, marketplace listing review, collection points, rewards, business pickup requests, and settings.
- **Marketplace:** Local listings, search, filters, unique-item cart, subtotal, reservations, and checkout details validation.
- **Cookie preferences:** Stores necessary/optional choices locally. Analytics and marketing integrations are not connected.

## 🔐 Demo Admin Login

Select the **Admin** tab on the sign-in page:

| Field | Value |
| --- | --- |
| Email | `admin@circutech.com` |
| Password | `AdminPassword123!` |

The login seed and `validateCredentials()` function are in `loginpage/login.html`. The source stores a salted PBKDF2 hash rather than the password itself. This credential is intentionally documented for local testing; change it before sharing or deploying the project.

## 📊 User Dashboard & Stats

The Dashboard summarizes locally saved scanner activity: device scans, estimated JOD value, estimated CO₂, and earned points. **Articles read** counts unique published article IDs opened while the user is signed in. Reopening an article updates its last-read time without increasing the unique count. These values are browser-local estimates, not measured recycling outcomes, and do not sync between devices.

Use **Settings → Download my data** to export the account's locally stored records. **Clear activity and vouchers** removes scans, article reads, and vouchers from this browser.

## 🗂 Project Structure

```text
circutech/
├── index.html                 Homepage
├── LandingPage/               Shared public styles and scripts
├── assets/                    Logo and local News cover artwork
├── apppage/                   User and Admin dashboard UI, styles, and logic
├── loginpage/                 Sign-in, registration, and legacy Admin redirect
├── newspage/                  News listing, article detail, and article data
├── marketpage/                Marketplace, local store, cart, and checkout demo
├── servicespage/               Services information
├── businesspage/               Business information
├── contactpage/                Contact page (demo form)
├── privacypage/                Project privacy information
├── cookie-consent.css          Shared cookie preference styling
└── cookie-consent.js           Shared cookie preference behavior
```

## 🚀 Run Locally

No package installation or build step is required.

1. Open the `circutech` folder in VS Code.
2. Start `index.html` with the **Live Server** extension, or run a local static server from the project folder, for example:

   ```powershell
   py -m http.server 8000
   ```

3. Open `http://localhost:8000` in a browser. Use `http://localhost` or another secure context for Web Crypto-based password hashing; avoid opening the files directly with `file://`.

## ⚠ Prototype Limitations

- Accounts, roles, News edits, marketplace listings, cart, and dashboard activity use browser storage. They are not shared or protected from a user who can edit that storage.
- Frontend role checks are for this prototype only. Production authorization requires a trusted server or authentication service to validate sessions and permissions.
- No payment provider or backend is configured. Checkout does not place orders, take payment, or report a successful transaction. Secure hosted payment and server-side verification are required before enabling purchases.
- The contact form is demo-only. Optional cookie categories are saved as preferences but do not activate analytics or marketing tools.
- `privacypage/privacy.html` is a basic project notice, not a reviewed legal policy.