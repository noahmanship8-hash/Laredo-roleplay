# Laredo Roleplay bot

Your supplied CommonJS Discord.js bot, isolated from the website in the repository root. Node.js 22 or newer is required. The new moderation tools use consistent blue embeds, timestamps, no automatic mentions, and a Laredo Roleplay confidentiality footer.

## Install / update safely

1. **Stop your existing bot and back up its entire folder, especially `data/db.json`.** Never run two copies against the same database.
2. Install this `bot/` folder as the bot's application root, or run commands from this folder. Do not replace the website's root `package.json`.
3. Copy your existing `data/` and `assets/` folders into this folder. They are intentionally excluded from Git. **Do not publish member records.** The supplied uploads did not contain these folders.
4. Replace the placeholder `shop.js` with your original file. Your real marketplace prices were not supplied.
5. Copy `.env.example` to `.env`; fill in `DISCORD_TOKEN`, `CLIENT_ID`, and `GUILD_ID` privately. Keep existing ER:LC configuration (see `utils/erlc.js`). Never upload your `.env`.
6. Review `config.js`, especially staff role, log channel, welcome/verification IDs in `index.js`, and banner filenames. The original server IDs were preserved.
7. In the Discord Developer Portal, enable **Server Members Intent** and **Message Content Intent**, which the supplied bot requests.
8. Run:

   ```sh
   cd bot # omit if already using this folder as your hosting application root
   npm ci
   npm test
   npm run deploy
   npm start
   ```

   `deploy` registers all commands for the configured server. It **replaces that application's guild command list**. `start` no longer re-registers commands on every restart.

Test in a private server first. No live Discord actions were performed during development. Grant only required bot permissions and place the bot role above members/roles it needs to manage.

### Existing records

Existing case IDs and other database collections are preserved. On startup, old cases without a server ID are assigned to `GUILD_ID` (the old bot was single-server). New cases are server-scoped. Removed cases are voided, not deleted. Back up `data/db.json` before migration. Invalid/unreadable JSON stops startup instead of silently resetting the records. This is a single-process, local JSON database, not a multi-instance database.

## Quick guide

| Task | Commands |
|---|---|
| Private dashboard | `/dashboard`, `/dashboard user:`; Overview, Cases, Warnings, Previous/Next |
| Member discipline | `/warn`, `/mute` (minutes), `/unmute`, `/kick`, `/ban`, `/unban` (user ID) |
| Case records | `/case`, `/editcase` (reason only), `/modlogs`, `/warnings`, `/points` |
| Void mistakes | `/mod remove case:`, `/mod clearwarnings user:` |
| Escalation | `/mod escalation settings`, `toggle`, `settimeout`, `setban` |
| Staff discipline | `/staffwarn add`, `list`, `void` — administrators only |
| Private notes | `/note add`, `edit`, `remove`; `/notes user:` with optional note ID/edit history |
| Roles and members | `/role add`, `/role remove`, `/roles` (user/search/page), `/members` (include/exclude/page) |
| Channels | `/lock` (optional minutes), `/unlock`, `/locked`, `/purge`, `/clean` |
| Staff utilities | `/nick`, `/inviteinfo`, `/modstats`, `/moderations`, `/diagnose` |
| Information | `/help`, `/docs`, `/info user`, `/info server`, `/ping`, `/status`, `/invite`, `/support` |

Original tickets, sessions, appeals, panels, economy, suggestions, reviews, verification, and anti-nuke command modules are included. They retain their existing UI and behaviour except for the documented targeted permission/scoping fixes; the new embeds do not redesign every original panel. Missing image files are skipped by the supplied UI.

## Warning and punishment rules

- Each active member warning contributes **one point**. Voided warnings stop counting. Staff warnings are separate and contribute no member points.
- Escalation starts **disabled**. Default thresholds are 3 warnings → 60-minute timeout, 5 warnings → ban. Only administrators can configure it.
- A new warning must hit the exact threshold to trigger escalation; changing settings does not punish historical cases retroactively.
- The issuing moderator must have the corresponding native Discord permission for an escalation action. Failed escalation is reported; the warning remains recorded and no fake punishment case is created.
- Successful escalation creates its own timeout/ban case. Discord itself expires timeouts. DM failures are reported without undoing an action.
- Dashboard and member history exclude staff warnings. Staff discipline is visible through administrator-only `/staffwarn` and restricted case lookup, and is not posted to the general moderation channel.
- Role grants require Manage Roles, a lower target/role hierarchy, and administrator permission for roles with moderation/administration privileges.
- Keep `config.roles.staff` and your general moderation-log channel restricted to trusted staff. Administrators are trusted to access the database and all moderation records.

## Channel locks

Locks change only the `@everyone` Send Messages overwrite. An explicit allow from another role/member can still permit messaging; threads are not supported. The previous allow/deny/unset value is stored and restored by `/unlock`. Temporary unlocks are checked every 15 seconds and resume after restarts. Failed automatic unlocks remain stored and retry. Do not change that overwrite manually while a bot lock is active.

## Scope and remaining Circle differences

This is a community-bot upgrade based on the command list you supplied, **not a complete Circle clone or a Circle integration**. Your list cut off at `/soft`; softban and later commands were not specified or implemented.

- `/editcase` edits reasons with retained edit history, not active punishment durations. Use `/mute` or `/unmute` to change a timeout.
- `/moderations` reads active Discord timeouts (up to 25 displayed), not temporary bans. `/modstats` counts saved, non-voided cases immediately (top 20), not Circle's historical database or ten-minute cache.
- `/members` supports one included and one excluded role and requires the privileged members intent; it is not an unlimited multi-role query builder.
- `/presets` explicitly reports that presets are not configured; editable reason presets are not implemented.
- `/premium` and `/vote` explain that no billing/voting integration is configured. `/support` uses your community website, not Circle support. `/status` links to Discord status without claiming to have queried it.
- Existing economy balances, ticket records, and member data must be copied from your host; they cannot be recovered from screenshots.

## Tests

`npm test` covers command schema serialization and uniqueness, server scoping, permission denial, warning persistence, DM failure, escalation success/failure, self-target rejection, staff-record visibility, dashboard button ownership, and corrupt-database protection. Tests use a temporary database and no Discord token. Real server integration, role overrides, uploads, and gateway behaviour still need staging-server testing.

## Coloured server logs

Administrators can now configure event logs without editing channel IDs in files:

```
/logging set category:all channel:#server-logs
/logging set category:voice channel:#voice-logs
/logging set category:messages channel:#message-logs
/logging status
/logging test category:all
/logging disable category:voice
```

Settings persist in your existing database and apply only to this server. Categories are `messages`, `voice`, `channels`, `roles`, `members`, `server`, and `audit`. `all` sets/disables/tests every category. Events may appear twice when both their normal category and the separate audit category are enabled: audit entries provide the responsible actor when available, while ordinary gateway events do not guess who performed an action.

- **Green:** creation, joins, unbans. **Red:** deletion, leaves, bans. **Yellow:** edits and settings changes. **Blue:** voice moves.
- Message logs: text edits, single deletions, and bulk-deletion count with a cached sample. Bot message changes and configured log-channel message changes are excluded to prevent feedback loops.
- Voice logs: joins, leaves, moves, mute/deafen/video/stream changes, and member counts.
- Channel/thread logs: create/delete, names, categories, positions, topics, slowmode, voice settings, permission overwrite changes, thread archive/lock changes.
- Role logs: create/delete, name, colour, position, hoist, mentionability, permissions, and icon changes.
- Member logs: joins/leaves, nickname, role assignment/removal, timeouts, verification status, bans/unbans.
- Server logs: supported name, description, icon/banner, owner, verification, content filter, AFK/system channel and locale changes.
- Audit logs: Discord-delivered audit entries, with actor ID, target ID, reason and a truncated change summary. Includes supported invite, emoji, webhook and other administrative actions recorded by Discord.

The bot requires View Channel, Send Messages and Embed Links in each log channel; **View Audit Log** is needed for audit events. Enable **Server Members Intent** and **Message Content Intent** in the Developer Portal. The updated startup also requests Voice States and message partials. Keep destinations staff-only: logs can expose deleted/private-channel messages. Existing `config.channels.modLogs` is separate from these event-log destinations.

Limits: no historical backfill, no recovery of uncached deleted content, no guaranteed actor attribution outside audit entries, no logging while the bot is offline, no delivery retry queue. Attachment-only edits, reactions, presence and every possible Discord setting are not tracked. Large changes are summarized/truncated; member counts reflect the event-time cache. If bot permissions are revoked, use `/logging status` and check the hosting console for delivery failures.
