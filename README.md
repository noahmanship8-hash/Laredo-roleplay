# Laredo Roleplay website for Cloudflare

The navy and sunset look of the original, laid out like the Texas reference, with frosted glass panels, a Dark / Light / Halloween look, and a Settings page for each visitor. It also has Sign in with Discord, Roblox linking, applications filled in on the site, and a staff panel.

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

## Two kinds of settings

**Visitor settings** are on the Settings page (`#settings`, linked from the header and footer). Each visitor chooses for themselves, and the choice is saved on their own device:
- Colour mode: Match my device, Light or Dark, plus the Halloween look on or off.
- Accent colour: Sunset, Gold, Teal or Rose.
- Glass effects, background glow, text size, an easy-read font, high contrast, animations and the highway sign ticker.

**Site settings** are in the staff panel, for Head of Staff, Executive, Leadership and Discord Developers. They change the site for everyone:
- Open or close each department and change its Discord invite.
- Open or close each application.
- A notice banner, maintenance mode, shop prices, and the default look (Dark, Light or Halloween) for visitors who have not chosen one.

Changes can take up to a minute to reach everyone, because Cloudflare KV spreads data around the world. Maintenance mode is a cover over the site rather than a lock on the files.

## Changing things yourself

- **Application questions:** edit `src/forms.mjs`.
- **Photos:** drop `hero.jpg` in `public/assets/photos/` to show a photo beside the headline. Add `gallery-1.jpg`, `gallery-2.jpg` and `gallery-3.jpg` and a "Taken in Laredo" section appears on the home page. Without photos, those parts stay hidden or use the logo.
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

## Tests (optional)

`npm test` runs the checks used while building this. They use pretend Discord, Roblox and Cloudflare, so they need no keys.
