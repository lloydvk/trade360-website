# Trade 360 — going live on Netlify

## What's in this folder

```
index.html                    → homepage (trade360.ai)
pricing/index.html            → trade360.ai/pricing
quote/index.html              → trade360.ai/quote (AI Quote Builder)
netlify/functions/quote-ai.js → serverless function that powers the AI Quote Builder
netlify.toml                  → tells Netlify where the functions live
```

All three pages link to each other with real relative paths now (no more links
pointing back to claude.ai) — this folder is the whole site.

**Important:** because the AI Quote Builder needs a serverless function, this
has to go live through **Git + GitHub connected to Netlify**, not the simple
drag-and-drop upload box. Netlify's drag-and-drop only publishes static files;
it doesn't reliably deploy the `netlify/functions` folder. The CLI method
further down is a fallback if you'd rather skip GitHub.

---

## Option A — Git + GitHub (recommended)

This is the standard way to run a Netlify site with a backend function, and
it means every future update just needs a `git push`.

1. **Create a GitHub repo.** Go to github.com → New repository → name it
   something like `trade360-website` → Create (public or private, either
   works).

2. **Push this folder to it.** On your own computer, open a terminal in this
   folder and run:
   ```
   git init
   git add .
   git commit -m "Initial site"
   git branch -M main
   git remote add origin https://github.com/<your-username>/trade360-website.git
   git push -u origin main
   ```
   (If you don't have git installed, GitHub's "uploading an existing file"
   web UI also works — drag all these files and folders into the repo page.)

3. **Connect it in Netlify.** In your Netlify dashboard → your site
   (`euphonious-palmier-c9f422`, the one already linked to trade360.ai) →
   **Site configuration → Build & deploy → Link repository** (or, if this
   site was never linked to a repo, you may need to create a *new* site via
   **Add new site → Import an existing project** and pick this GitHub repo,
   then move the trade360.ai domain over to it under **Domain management**).
   - Build command: leave blank
   - Publish directory: `.` (already set via `netlify.toml`)
   - Functions directory: `netlify/functions` (already set via `netlify.toml`)

4. **Deploy.** Netlify will build automatically once connected. Check the
   **Deploys** tab for a green "Published" status.

---

## Option B — Netlify CLI (no GitHub)

If you'd rather not set up a repo:

1. Install the CLI (needs Node.js installed on your computer):
   ```
   npm install -g netlify-cli
   ```
2. From inside this folder:
   ```
   netlify login
   netlify link        (choose the existing euphonious-palmier-c9f422 site)
   netlify deploy --prod
   ```
   When it asks for the publish directory, enter `.` — it will detect
   `netlify/functions` automatically from `netlify.toml`.

With this method, future updates mean re-running `netlify deploy --prod`
from an updated copy of this folder.

---

## Required: add your Anthropic API key

The AI Quote Builder won't generate real quotes until this is set — **do
this yourself in the Netlify dashboard, never share the key anywhere else:**

1. Get a key at **console.anthropic.com → API Keys → Create Key** (you'll
   need an Anthropic account with billing set up, since each quote generated
   costs a small amount in API usage).
2. In Netlify: your site → **Site configuration → Environment variables →
   Add a variable**.
   - Key: `ANTHROPIC_API_KEY`
   - Value: the key you just copied (starts `sk-ant-...`)
   - Scopes: all scopes / all deploy contexts is fine.
3. **Trigger a new deploy** after adding it (Deploys tab → Trigger deploy →
   Deploy site) — environment variables only apply to deploys made after
   they're added.

Two more environment variables are optional, only needed if you want to pin
specific models instead of the defaults already in the code
(`claude-haiku-4-5-20251001` for quick tasks, `claude-sonnet-5-5` for
everything else):
- `ANTHROPIC_MODEL_QUICK`
- `ANTHROPIC_MODEL_DEFAULT`

**On cost:** every "Generate quote" click makes 2–3 API calls, and the
handwritten-note photo reader makes one more. There's no spending cap built
in — keep an eye on usage under your Anthropic console's usage/billing page,
especially in the first few days after going live.

---

## Required: turn on email notifications for your forms

Every "Book a demo", "Book a call" and "Subscribe" button on the site now
submits a real, working form (handled by **Netlify Forms** — no server of
your own needed). Netlify always stores every submission under your site →
**Forms** in the dashboard, but it does **not** email you by default — that
one toggle has to be switched on once, by hand, in the dashboard (it isn't
something that can be set from the code):

1. Netlify → your site → **Site configuration → Forms → Form notifications**.
2. **Add notification → Email notification.**
3. Enter **`lloyd@bmbifoldingdoors.co.uk`** (the inbox to use for now) as the
   address, and save.
4. Repeat step 2 for each form you want emailed separately — there are two:
   - **`newsletter`** — every "Subscribe" button (homepage footer-area
     signup and the floating bubble) submits here, with just an email
     address.
   - **`demo-request`** — every "Book a demo" and "Book a call" button
     scrolls to the form in the gold band near the bottom of the homepage,
     which submits here with name, company, email, phone and an optional
     message.
   (Both are set to the same inbox above for now — easy to point either one
   somewhere else later from this same screen.)
5. Submit each form once yourself (see the checklist below) to confirm the
   email actually arrives — spam/junk folders are worth a check the first
   time.

Netlify's free tier includes 100 form submissions a month; past that it's a
small add-on. The two forms above both have a honeypot field already wired
in to filter out basic bots.

---

## Finish connecting your domain

You'd already started adding `trade360.ai` as a custom domain on the Netlify
site earlier. Once this deploy is live:

1. Netlify → your site → **Domain management** → confirm `trade360.ai` shows
   as verified (not "Pending DNS verification"). If it's still pending,
   Netlify's domain page shows either nameservers to point your domain at, or
   a couple of DNS records to add at your domain registrar — whichever option
   you picked earlier.
2. Netlify issues a free HTTPS certificate automatically once DNS resolves
   correctly — this can take anywhere from a few minutes to a few hours.

---

## After it's live — a checklist

- [ ] `https://trade360.ai` loads the homepage
- [ ] `https://trade360.ai/pricing` loads the Pricing page, and its nav
      shows "Pricing" underlined as the current page
- [ ] `https://trade360.ai/quote` loads the AI Quote Builder
- [ ] Fill in a test job on `/quote` and click "Generate quote" — a real
      quote should appear within a few seconds (this needs the API key step
      above done first)
- [ ] Click "Download PDF" on a generated quote — a PDF should download
- [ ] Submit the homepage newsletter form — you should see a "thanks"
      message, and the submission should appear under Netlify → your site →
      **Forms**, and (once notifications are set up above) land in your inbox
- [ ] Click any "Book a demo" or "Book a call" button, fill in the form that
      appears near the bottom of the homepage and submit it — same checks:
      "thanks" message, shows up under **Forms**, arrives by email
- [ ] Open the site on a phone (or narrow your browser) and check the mobile
      menu, hero, and pricing toggle all still work

---

## Known gaps worth knowing about

- The **AI Quote Builder isn't linked from the homepage or Pricing page nav**
  yet — right now the only way to reach `/quote` is by typing the URL
  directly. Say the word if you'd like a link added somewhere (e.g. the
  "AI Quote Builder" line in the Sales pillar card, or a nav item).
- The homepage's red **"Limited time: sign up today for a 30-day free
  trial"** banner is still there from before the trial became a standing
  policy rather than a limited-time offer — worth rewording once you're live.
- The **upload placeholders** (hero photo, pillar images, logo) are still
  placeholders — swap in real photos/logo whenever you have them, by editing
  the relevant `<img>`/background references in `index.html`.
- No favicon is set yet — browsers will silently 404 on `/favicon.ico` until
  one's added (cosmetic only, doesn't affect functionality).
