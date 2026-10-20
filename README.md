# Laredo Roleplay website for Cloudflare

The navy and sunset look of the original, with a picture carousel on the home page, moving light in the background, a dark / light / Halloween / Christmas look, and a Settings page for each visitor. It also has Sign in with Discord, Roblox linking, applications filled in on the site, a dashboard for every member (live player count, Discord roles, badges and a daily check-in), an editable staff page, and a staff panel.

## What is in this folder

| Folder or file | What it is |
| --- | --- |
| `public/` | The website itself: `index.html`, `styles.css`, `site.js`, `config.js`, your logo and `announcements.json`. |
| `functions/api/[[path]].js` | The small server part that Cloudflare runs for sign in, applications and settings. |
| `src/` | The logic behind it. `src/forms.mjs` holds the application questions. |
| `scripts/` and `.github/` | The job that copies your Discord announcements into `public/announcements.json`. |
| `tests/` | Checks used while building this. You can ignore them. |

## Part 1: Put the files on GitHub

The layout changed: the website now lives in `public/`. In your repository:

1. Delete the old website files at the top level (`index.html`, `styles.css`, `site.js`, `config.js`, `assets`, and any `netlify` folder or `netlify.toml`).
2. Click **Add file > Upload files** and drag in everything from this folder, including the hidden `.github` folder. Your announcements are already included in `public/announcements.json`.
3. Commit the changes.

Your two GitHub secrets for the announcements (`DISCORD_BOT_TOKEN` and `ANNOUNCEMENTS_CHANNEL_ID`) stay as they are.

## Part 2: Create the Cloudflare Pages project

It must be a **Pages** project, not a Worker. Pages runs the `functions` folder by itself.

1. In Cloudflare open **Workers & Pages > Create** and choose the **Pages** tab, then **Connect to Git**. Pick your repository.
2. Set **Framework preset** to None, leave **Build command** empty, and set **Build output directory** to `public`.
3. Click **Save and Deploy**.

If you already have a Pages project for this repository, open its **Settings > Builds** and change the output directory to `public` instead.

Your site address is shown at the top of the project (for example `https://laredoroleplay.pages.dev`). If you use your own domain, use that everywhere this guide says SITE ADDRESS.

## Part 3: Connect storage (KV)

Applications, Roblox links and the site settings are saved in a Cloudflare KV store.

1. Go to **Storage and Databases > KV** and **Create a namespace**. Call it `laredo`.
2. Open your Pages project, then **Settings > Bindings > Add > KV namespace**.
3. Set the **Variable name** to exactly `LAREDO` and pick the `laredo` namespace. Save.

## Part 4: Discord sign in

1. Open **discord.com/developers/applications** and choose the same application your announcements bot uses.
2. Under **OAuth2 > Redirects**, add `SITE ADDRESS/api/auth/discord/callback` and save.
3. On that page copy the **Client ID** and **Client Secret**. The bot must be in your server. It only reads roles, so it needs no special permissions.

## Part 5: Add the variables

In your Pages project open **Settings > Variables and Secrets** and add these. Use the **Secret** type for anything secret.

| Name | Value |
| --- | --- |
| `SESSION_SECRET` | A long random string of 40 characters or more. A password generator works. |
| `DISCORD_CLIENT_ID` | From Part 4 |
| `DISCORD_CLIENT_SECRET` | From Part 4 |
| `DISCORD_BOT_TOKEN` | Your bot token, the same one the announcements use |
| `ROBLOX_CLIENT_ID` | From Part 6 (optional) |
| `ROBLOX_CLIENT_SECRET` | From Part 6 (optional) |
| `APPLICATIONS_WEBHOOK_URL` | A Discord webhook link (optional). Staff get a message when someone applies or a decision is made. |
| `ERLC_API_KEY` | Your ER:LC private-server key (optional). Turns on the live player count. You can also paste it in the staff panel instead. |
| `ERLC_API_BASE` | Only if ER:LC changes its address again. Defaults to `https://api.erlc.gg/v1`. |

Cloudflare only picks up new variables and bindings on a new deployment. Open **Deployments**, find the latest one and choose **Retry deployment**, or push any small change to GitHub.

## Part 6: Roblox linking (optional, you can do it later)

1. Open **create.roblox.com**, go to **Creator Hub > OAuth 2.0 apps** (it may be under Credentials) and create an app.
2. Add the redirect `SITE ADDRESS/api/auth/roblox/callback` and choose the scopes **openid** and **profile**.
3. Copy the **Client ID**, generate a **Client Secret**, and add both to Cloudflare (Part 5). Redeploy.

Roblox may only let a few people use a new app until it passes their review. Everything else keeps working in the meantime.

## Who can do what

| Role | ID | Access |
| --- | --- | --- |
| Staff Team | 1558228597402243153 | Staff panel and reviewing applications |
| Head of Staff | 1559256083292495962 | Staff panel plus site settings |
| Executive | 1558209179276017735 | Staff panel plus site settings |
| Leadership | 1558209177778913330 | Staff panel plus site settings |
| Discord Developer | 1558209180723060808 | Staff panel plus site settings |

Roles are checked against your server whenever something private is opened, so removing a role removes access within about a minute. To change them later, add the variables `STAFF_ROLE_ID` (one ID) or `ADMIN_ROLE_IDS` (IDs separated by commas).

## What is new in this version

- **Home page carousel**: three pictures that change on their own (visitors can turn that off in Settings) with arrows, dots and a caption. The highway sign ticker is gone.
- **Christmas look**: ice blue, pine and brass, with snow across the site. It sits next to Dark, Light and Halloween, and it is in the header's look menu and in Settings.
- **Dashboard for every member**: their Discord roles (names and colours), the live ER:LC player count and join code, who is on duty, a daily check-in with a streak, badges they have earned, and their applications. Staff admin see a link to the panel.
- **Inventory**: badges are earned by playing (linked Roblox account, an application sent, check-in streaks, staff team) or handed out by staff admins. Members can wear one next to their name.
- **Editable staff page**: staff admins add, edit, reorder and remove the people on `#staff`, with a name, role, team, colour, Discord ID, avatar link and a short bio.
- **Themes on and off**: in the staff panel, switch any look off for everybody, and pick the default look for new visitors.
- **More customisation**: dashboard wording, which dashboard cards show, whether the shop is open, plus all the old settings (notice, maintenance, departments, applications, prices).
- **Loading screen**: opening the dashboard or the panel shows a short loading screen while the account and live count are fetched.

## Live player count (ER:LC)

Add `ERLC_API_KEY` in Cloudflare (Part 5), or paste the key into **Staff panel > Site settings > ER:LC server key**, and the home page fact and every dashboard show the live count. The key is kept in your KV store and is never sent to a browser. The site tries `api.erlc.gg` and then the old `api.policeroleplay.community` address, caches the answer for 20 seconds, and falls back to a friendly message if the server is closed or the key is wrong.

## Two kinds of settings

**Visitor settings** are on the Settings page (`#settings`, linked from the header and footer). Each visitor chooses for themselves, and the choice is saved on their own device:
- Colour mode: Match my device, Light or Dark, plus the Halloween and Christmas looks on or off (turning one on turns the other off).
- Accent colour: Sunset, Gold, Teal or Rose.
- Glass effects, background effects, text size, an easy-read font, high contrast, animations, and whether the home page pictures change on their own.

**Site settings** are in the staff panel, for Head of Staff, Executive, Leadership and Discord Developers. They change the site for everyone:
- Open or close each department and change its Discord invite.
- Open or close each application.
- Which looks are allowed, and the default look (Dark, Light, Halloween or Christmas) for visitors who have not chosen one.
- The dashboard wording, which dashboard cards show, and whether the shop is open.
- The ER:LC server key for the live player count.
- The people on the staff page (the **Staff page** tab), and badges for individual members (the **Members** tab).

Changes can take up to a minute to reach everyone, because Cloudflare KV spreads data around the world. Maintenance mode is a cover over the site rather than a lock on the files.

## Changing things yourself

- **Application questions:** edit `src/forms.mjs`.
- **Staff page:** the staff panel writes it; nothing to edit by hand. The teams and their colours live in `TEAM_INFO` in `public/site.js`.
- **Carousel slides:** the three home slides are drawn in the page (wordmark slide, plan grid, rings) so there are no photos to replace. The words live in `public/index.html` under `hero-slide`, and the artwork and colours are in `styles.css` under `slide-art`.
- **Badges:** the list is `INVENTORY` in `src/core.mjs`.
- **Server code:** add your private server code to `public/config.js` and it shows on the home page.
- **Other text:** open `public/index.html` and use Find.
- **Announcements:** nothing to do. The GitHub job keeps `public/announcements.json` up to date, and Cloudflare redeploys when it changes.

## If something goes wrong

| What you see | What to check |
| --- | --- |
| The dashboard says accounts are not switched on | The site is not a Pages project, the output directory is not `public`, or the `functions` folder is not at the top of the repository. Check `SITE ADDRESS/api/health`. It should show `{"ok":true}`. |
| `/api/health` says "Storage is not connected" | The KV binding is missing or not named exactly `LAREDO`. Add it and redeploy. |
| "Sign in is not set up on this site yet" | `SESSION_SECRET`, `DISCORD_CLIENT_ID` or `DISCORD_CLIENT_SECRET` is missing. Redeploy after adding them. |
| Discord says "Invalid redirect" | The redirect in Part 4 does not exactly match your site address. |
| "Could not check your Discord roles" | `DISCORD_BOT_TOKEN` is missing or wrong, or the bot is not in the server. If it persists, turn on **Server Members Intent** on the bot's page. |
| Staff cannot open the panel | They need the Staff Team role in your server. Sign out and back in. |
| Roblox sign in fails | Both Roblox variables are set, the redirect matches, and Roblox has approved the app. |
| Announcements stopped updating | Open the GitHub Actions tab. GitHub pauses scheduled jobs after about 60 days with no activity. |

## Safety

- Keep tokens and secrets only in Cloudflare's variables and GitHub's secrets. Never put them in a file.
- If a secret leaks, reset it (Discord Developer Portal or Roblox) and update Cloudflare.
- The site stores Discord and Roblox IDs, names and application answers in your KV store. The Privacy page explains this to members.

## Previewing locally (optional)

`npm run preview` starts a preview at `http://localhost:4173` with pretend Discord users, a pretend ER:LC server and storage in memory, so you can click through the dashboard and the staff panel without any keys. Then open `/api/dev-login?as=member`, `?as=staff` or `?as=admin`. This file (`scripts/preview-server.mjs`) is not used by Cloudflare and is not part of the public site.

## Tests (optional)

`npm test` runs the checks used while building this. They use pretend Discord, Roblox and Cloudflare, so they need no keys.
