# TerpLink Mobile (MERN)

A mobile-first MERN application built from the **TerpLink Mobile Events App** Figma Make prototype for University of Maryland (`@umd.edu`) students.

## Architecture & Features

- **Splash → Login → Mobile App Flow**
  - Starts with an animated TerpLink splash screen (`Splash.jsx`).
  - Routes unauthenticated users to `/login` (`Login.jsx`), offering **only Google Sign-In** restricted strictly to `.umd.edu` accounts (`@umd.edu` and `@terpmail.umd.edu`).
  - Once signed in, loads the exact UI, typography (`DM Sans` + `Manrope`), color palette (`--red: #e21833`, `--ink: #171615`), custom SVG icon set, local event imagery, RSVP & QR pass sheet, and mobile bottom navigation from the Figma Make file.
- **Mobile-First Navigation**
  - **Home (`/`)**: Greeting header, mobile search bar, Featured on Campus hero card (*Maryland Day*), horizontal category pills (*For you*, *Today*, *Free food*, *Social*, *Career*, *Arts & Music*), snap-scrolling event cards on mobile (`<= 640px`), 1-tap bookmarking, RSVP bottom sheet with digital QR pass, and Organization spotlight.
  - **Discover (`/discover`)**: Full-catalog search and category filtering.
  - **Calendar (`/calendar`)**: *Going* and *Saved* tabs with mobile pass viewer, 1-tap Google Calendar link, and `.ics` download for Apple/Outlook Calendar.
  - **Groups (`/groups`)**: Student organization directory with instant Join/Leave toggle.
  - **Profile (`/profile`)**: Verified UMD student badge, live RSVP/Saved/Group counters, Sign out, and *Sign out of all devices*.

## Security Controls

- **Google OAuth ID Token Verification**: `POST /api/auth/google` verifies the Google ID token signature, issuer, expiration, `email_verified`, and `audience` (`GOOGLE_CLIENT_ID`) using `google-auth-library`.
- **Strict `.umd.edu` Domain Gate**: Enforced on the server via `isAllowedEmail()` (`@umd.edu` and `*.umd.edu` such as `@terpmail.umd.edu`) and hinted on the client via `hosted_domain="umd.edu"`. Non-UMD accounts receive `403 Forbidden`.
- **Hardened Session Cookies**: Sessions use signed `HS256` JWTs stored exclusively in `httpOnly`, `SameSite=strict` cookies (`__Host-tl_session` with `Secure` in production) — never exposed to `localStorage` or `document.cookie`.
- **Session Revocation**: Each user document tracks `tokenVersion`; *Sign out of all devices* (`POST /api/auth/logout-all`) increments `tokenVersion` to immediately invalidate all issued tokens.
- **CSRF Protection**: State-changing requests (`POST`, `PUT`, `DELETE`) require `X-Requested-With: XMLHttpRequest` and a validated `Origin` header matching `CLIENT_ORIGIN` in addition to `SameSite=strict` cookies.
- **Helmet CSP, Rate Limiting & NoSQL Injection Defense**: Strict Content Security Policy (`helmet`), login/API rate limiting (`express-rate-limit`), payload size caps (`10kb`), `express-mongo-sanitize`, and `mongoose.isValidObjectId` parameter checks.

## Getting Started

```bash
# Start both the Express API (:5000) and Vite mobile web client (:5173)
npm run dev
```

### Environment Variables (`server/.env`)

A ready-to-run `server/.env` has been generated with a cryptographic `JWT_SECRET`.
- **Database (`MONGODB_URI`)**: Leave blank in development to use an automatic in-memory MongoDB instance pre-seeded with the Figma events and organizations, or set `MONGODB_URI` to your MongoDB Atlas / local URI and run `npm run seed`.
- **Google OAuth (`GOOGLE_CLIENT_ID`)**: Set `GOOGLE_CLIENT_ID` from the [Google Cloud Console](https://console.cloud.google.com/apis/credentials) (Authorized JavaScript origin: `http://localhost:5173`) for live Google Identity Services popup sign-in. In local development when `GOOGLE_CLIENT_ID` is blank, clicking **Continue with Google** opens a built-in Google Account Chooser so you can immediately test signing in with `@umd.edu` / `@terpmail.umd.edu` accounts and verify that `@gmail.com` accounts are rejected.

