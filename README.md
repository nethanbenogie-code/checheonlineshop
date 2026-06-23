# Cheche Cabalida Online Shop

A simple, installable (PWA) storefront that shows your Facebook posts, lets shoppers
filter by **Home Accessories** or **Beauty Products**, and opens **Messenger** with one tap.
No backend, no database — it runs as static files, perfect for **GitHub Pages**.

---

## First, the honest part about "fetch every post"

Facebook does **not** allow a plain website to automatically pull *all* posts from a Page.
Doing that needs Meta's Graph API, a registered Facebook App, a Page access token, Meta app
review, and a server running 24/7 — none of which work on free static hosting like GitHub Pages,
and Meta restricts those permissions heavily.

So this site uses the reliable method instead: **you add each post once** (paste its link),
tag it Home or Beauty, and the site shows the **real, live Facebook embed** — likes, comments,
photos, everything. Adding a post takes about 10 seconds. There's a built-in **Manage** panel
for it, so you never touch code.

Everything else you wanted works fully: category filtering, the Messenger button, and installable PWA.

---

## 1. Put it online (GitHub Pages)

1. Create a new GitHub repository, e.g. `cheche-shop`.
2. Upload **all the files in this folder** (keep the structure — the `icons/` folder matters).
3. Repo → **Settings → Pages** → *Build and deployment* → Source: **Deploy from a branch** →
   Branch: `main`, Folder: `/ (root)` → **Save**.
4. Wait ~1 minute. Your shop is live at `https://YOUR-USERNAME.github.io/cheche-shop/`.

> Tip: HTTPS is automatic on GitHub Pages, which the PWA install and Facebook embeds both require.

---

## 2. Set up your shop

Open **`posts.json`** and edit the top `shop` block:

```json
"shop": {
  "name": "Cheche Cabalida",
  "subtitle": "Online Shop",
  "tagline": "Home accessories & beauty finds...",
  "location": "Iligan City, Philippines",
  "hours": "Open daily · We reply fast on Messenger",
  "payment": "GCash · Cash on Delivery",
  "messenger": "https://m.me/61564275938442",
  "pageUrl": "https://www.facebook.com/profile.php?id=61564275938442",
  "manage": { "passcode": "cheche2026" }
}
```

**Change the passcode** (`manage.passcode`) to your own. This only keeps casual visitors out of
the Manage panel — it is **not real security** (the code is visible in the files), so don't store
anything secret here.

### Get the right Messenger link

- Easiest reliable option: give your Page a username in Facebook (Page → Settings → Username),
  then use `https://m.me/yourusername`.
- The numeric form `https://m.me/61564275938442` also works for most Pages.
- Make sure your Page allows messages: Page → Settings → **Privacy / Messaging** → allow people to message the Page.

The Messenger button opens the **Messenger app** on phones (if installed) or **Messenger web** on computers.

---

## 3. Add and manage posts

1. Open your live site and scroll to the footer → click **Manage shop**.
2. Enter your passcode.
3. **Add a post:**
   - On Facebook, open the post → **•••** menu → **Embed** → copy. *(Or just copy the post's link.)*
   - Paste it into the box, choose **Home Accessories** or **Beauty Products**, add an optional caption.
   - Click **Add post**. It appears instantly.
4. Reorder, edit, or delete posts from the list below.
5. **Publish your changes:** click **Download posts.json**, then upload/commit that file to your
   GitHub repo (replace the old one). Within a minute, everyone sees the update.

> Your edits are saved on your device as you work (an **Unpublished changes** banner reminds you).
> They only go live for visitors after you commit `posts.json` to GitHub.
> Use **Discard** to throw away local edits and reload the published version.

You can also **Copy JSON** or **paste/import** a `posts.json` from the same panel.

---

## 4. Add more categories (optional)

In `posts.json`, extend the `categories` list. Each needs an `id`, a `label`, and a `color`:

```json
"categories": [
  { "id": "home",   "label": "Home Accessories", "color": "#C77D4A" },
  { "id": "beauty", "label": "Beauty Products",   "color": "#B4456B" },
  { "id": "kids",   "label": "Kids & Baby",       "color": "#6FA8A0" }
]
```

New categories show up automatically as filter chips and in the Manage dropdown.

---

## 5. Install as an app (PWA)

- **Android / Chrome:** an **Install app** button appears in the header — tap it.
- **iPhone / Safari:** tap **Share → Add to Home Screen**.
- **Desktop Chrome/Edge:** click the install icon in the address bar, or use the header button.

The shop's shell works offline once installed; the live Facebook posts still need internet (they're live content).

---

## 6. Promo bar, How-to/FAQ, and Analytics

Open **Manage shop** and you'll find collapsible sections for all of these. Edits preview live and publish the same way (Download `posts.json` → commit to GitHub).

**Promo bar** — the pink banner at the very top. Toggle it on/off, set the message, and optionally add a link. Visitors can dismiss it; it comes back automatically whenever you change the text.

**Shop details** — name, tagline, location, hours, payment, Messenger link, and Page URL are all editable here now, so you don't have to hand-edit `posts.json` anymore.

**How to order** — the numbered steps shown on the page. One line per step.

**FAQ** — add, edit, or remove question/answer pairs. They appear as an accordion next to "How to order."

**Visitor analytics (privacy-friendly)** — uses [GoatCounter](https://www.goatcounter.com), which is free, cookie-free, and doesn't track personal data:
1. Sign up at goatcounter.com and pick a site code (e.g. `mycheche`).
2. In Manage → *Visitor analytics*, paste that code (or your full count URL).
3. Download `posts.json`, commit it, and counts start after the site reloads.
   Leave it blank and no analytics load at all. (Cloudflare Web Analytics works too if you prefer — it's also free and cookieless.)

**Performance note:** posts now **lazy-load** — each Facebook post only loads as it scrolls into view, so the page opens fast and saves mobile data even with lots of posts.

> Because Manage now edits the whole shop (not just posts), your local draft holds everything until you publish. If you ever hand-edit `posts.json` directly, open Manage → **Discard** to reload the published version on your device.

## Troubleshooting

- **A post won't show up.** The post must be set to **Public** on Facebook. Private or
  friends-only posts can't be embedded.
- **Embeds are blank.** Some ad/privacy blockers block Facebook's script. The site shows an
  **Open on Facebook ↗** fallback link in that case.
- **Messenger opens the wrong thing.** Double-check the `messenger` link in `posts.json`
  (`https://m.me/...`) and that messaging is enabled on your Page.
- **I edited posts.json but my own browser shows the old list.** You have a local draft —
  open Manage → **Discard** to load the published file.
- **Facebook version note:** embeds use Facebook SDK `v25.0`. If Meta ever retires it, bump the
  `version=` value in the SDK `<script>` tag near the bottom of `index.html`.

---

## Files

| File | What it is |
|------|------------|
| `index.html` | The page |
| `styles.css` | Design / styling |
| `app.js` | All the logic (loading posts, filtering, Manage panel, install) |
| `posts.json` | **Your data** — shop info + the list of posts |
| `manifest.json` | PWA app info |
| `sw.js` | Service worker (offline + install) |
| `icons/` | App icons and favicons |
| `.nojekyll` | Tells GitHub Pages to serve files as-is |

---

Built for Cheche Cabalida Online Shop · Iligan City · by Gieo Software.
