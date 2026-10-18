# Laredo Roleplay website

This version is prepared for **Cloudflare Pages**. It serves the website from Pages, runs the `/api/*` endpoints as Pages Functions, and stores site settings, applications, and Roblox links in Cloudflare D1.

## Deploy on Cloudflare Pages

### 1. Put the files in GitHub

Upload the contents of this folder to the root of your GitHub repository and commit them. The repository root should contain `index.html`, `functions/`, `wrangler.jsonc`, and `announcements.json`.

Deploy from a Git repository. Cloudflare Pages Functions are not supported by dashboard Direct Upload.

### 2. Create the Pages project

In Cloudflare, open **Workers & Pages > Create application > Pages > Connect to Git** and select the repository. Name the Pages project `laredorp` to match `wrangler.jsonc`. Use these build settings:

| Setting | Value |
| --- | --- |
| Framework preset | None |
| Build command | `exit 0` |
| Build output directory | `.` |
| Root directory | `/` (the repository root) |

The `wrangler.jsonc` file also records the Pages output directory and compatibility date. Do not use `npx wrangler deploy` as the Pages build command; that command deploys a Worker.

### 3. Add the D1 database binding

1. In Cloudflare, open **Workers & Pages > D1 SQL Database > Create database**. Name it `laredo` or another name you prefer.
2. Open the Pages project and go to **Settings > Bindings > Add > D1 database**.
3. Set **Variable name** to `DB`, select the database, save, and redeploy.

The `laredo_data` table is created automatically the first time an API endpoint uses the database.

### 4. Add the site secrets and variables

In the Pages project, open **Settings > Variables and Secrets**. Add the following for the Production environment. Encrypt the secret values.

| Name | Value |
| --- | --- |
| `SESSION_SECRET` | A random string at least 40 characters long |
| `DISCORD_CLIENT_ID` | Your Discord application's client ID |
| `DISCORD_CLIENT_SECRET` | Your Discord application's client secret |
| `DISCORD_BOT_TOKEN` | Your Discord bot token |
| `SITE_URL` | Your final site address, such as `https://laredorp.pages.dev` |
| `DISCORD_GUILD_ID` | Optional; defaults to the Laredo server ID already in the code |
| `STAFF_ROLE_ID` | Optional; overrides the default staff role ID |
| `ADMIN_ROLE_IDS` | Optional; administrator role IDs separated by commas |
| `ROBLOX_CLIENT_ID` | Optional; needed for Roblox account linking |
| `ROBLOX_CLIENT_SECRET` | Optional; needed for Roblox account linking |
| `APPLICATIONS_WEBHOOK_URL` | Optional; Discord webhook for application notifications |

Set `SESSION_SECRET`, `DISCORD_CLIENT_SECRET`, `DISCORD_BOT_TOKEN`, and optional `ROBLOX_CLIENT_SECRET` and `APPLICATIONS_WEBHOOK_URL` as encrypted secrets. The IDs and `SITE_URL` can be regular text variables.

### 5. Set OAuth redirect URLs

In the Discord Developer Portal, add this redirect to **OAuth2 > Redirects**:

`https://YOUR-SITE-ADDRESS/api/auth/discord/callback`

If Roblox linking is enabled, add this redirect to the Roblox OAuth app:

`https://YOUR-SITE-ADDRESS/api/auth/roblox/callback`

Use the same final address as the `SITE_URL` value. Redeploy after changing Pages variables or bindings.

### 6. Check the deployment

Open `https://YOUR-SITE-ADDRESS/api/health`. A working API returns:

```json
{"ok":true}
```

## Announcements

The GitHub Actions workflow in `.github/workflows/update-announcements.yml` continues to update `announcements.json`. Add `DISCORD_BOT_TOKEN` and `ANNOUNCEMENTS_CHANNEL_ID` as GitHub Actions secrets for that workflow.

## What the staff panel does

- Members can sign in with Discord, link Roblox (optional), and submit applications.
- Staff can review applications; approved administrators can change site settings.
- Settings are saved in the Cloudflare D1 database.

The existing role IDs and application questions are in `functions/_lib/core.mjs` and `functions/_lib/forms.mjs`.

## Data note

Cloudflare D1 starts with a new, empty database. It does not automatically copy any data from a previous Netlify deployment.

## Tests

Run `npm test` locally to run the site's existing API and frontend checks.

## Safety

Keep bot tokens, OAuth client secrets, webhook URLs, and the session secret in Cloudflare's encrypted secrets. Never commit them to GitHub. If a secret leaks, reset it in the service that issued it and update the Cloudflare secret.
