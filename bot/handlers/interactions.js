// Routes every slash command, dropdown, button and form.
const {
  MessageFlags,
  ContainerBuilder,
  TextDisplayBuilder,
} = require('discord.js');

require('../utils/restFix').install();

const config = require('../config');
const content = require('../content');
const db = require('../utils/db');
const ui = require('../utils/ui');
const tickets = require('../utils/tickets');
const { isStaff } = require('../utils/perms');

const ephemeral = (text) =>
  ui.toPayload(text, { ephemeral: true });

// Acknowledge interactions before slow operations.
async function ack(interaction, { priv = true } = {}) {
  if (interaction.deferred || interaction.replied) return true;

  if (
    typeof interaction.deferReply !== 'function' ||
    !interaction.isRepliable()
  ) {
    return false;
  }

  await interaction.deferReply(
    priv ? { flags: MessageFlags.Ephemeral } : {}
  );

  return true;
}

// Reply, edit a deferred reply, or follow up as appropriate.
async function respond(interaction, payload) {
  const body = ui.toPayload(payload);

  if (interaction.deferred) {
    return interaction.editReply(body);
  }

  if (interaction.replied) {
    return interaction.followUp(body);
  }

  return interaction.reply(body);
}

// Reset a dropdown panel and privately show its selected option.
async function pickAndShow(interaction, panel, view) {
  await interaction.update(ui.asUpdate(panel));

  if (!view) {
    return interaction.followUp(
      ephemeral('That option no longer exists.')
    );
  }

  return interaction.followUp(
    ui.toPayload(view, { ephemeral: true })
  );
}

// ---- Dropdowns ----

async function handleRegulation(interaction, kind) {
  const key = interaction.values[0];

  const entry =
    (kind === 'server' ? content.regulations : content.banned)[key];

  const view = entry
    ? kind === 'server'
      ? ui.ruleView(entry)
      : ui.bannedView(entry)
    : null;

  return pickAndShow(
    interaction,
    ui.regulationsPanel(),
    view
  );
}

async function handleInfoTopic(interaction) {
  const topic = content.infoTopics[interaction.values[0]];

  return pickAndShow(
    interaction,
    ui.informationPanel(),
    topic ? ui.infoTopicView(topic) : null
  );
}

async function handleDepartment(interaction) {
  const dept = config.departments.find(
    (d) => d.id === interaction.values[0]
  );

  return pickAndShow(
    interaction,
    ui.departmentsPanel(),
    dept ? ui.departmentView(dept) : null
  );
}

async function handleApplication(interaction) {
  const app = config.applications.find(
    (a) => a.id === interaction.values[0]
  );

  return pickAndShow(
    interaction,
    ui.applicationsPanel(),
    app ? ui.applicationView(app) : null
  );
}

async function handleStaffInfo(interaction) {
  const option = config.staffInfo?.options?.find(
    (o) => o.id === interaction.values[0]
  );

  if (!option) {
    return pickAndShow(
      interaction,
      ui.staffInfoPanel(),
      null
    );
  }

  const card = {
    components: [
      new ContainerBuilder()
        .setAccentColor(0xf0b232)
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            `## ${option.label.toUpperCase()}\n${option.info}`
          )
        ),
    ],
  };

  return pickAndShow(
    interaction,
    ui.staffInfoPanel(),
    card
  );
}

// ---- New ticket system ----

async function handleTicketSelect(interaction) {
  // Reset the dropdown before creating the ticket.
  await interaction.update(
    ui.asUpdate(ui.assistancePanel())
  );

  const message = await tickets.createTicket(
    interaction,
    interaction.values[0]
  );

  return interaction.followUp(ephemeral(message));
}

// ---- Notification roles ----

async function toggleRole(interaction, roleId, name) {
  if (!roleId) {
    return respond(
      interaction,
      ephemeral(
        `The ${name} role has not been set up yet. ` +
        'Staff: add its role ID in config.js.'
      )
    );
  }

  try {
    if (interaction.member.roles.cache.has(roleId)) {
      await interaction.member.roles.remove(roleId);

      return respond(
        interaction,
        ephemeral(
          `You will **no longer** receive **${name}** pings.`
        )
      );
    }

    await interaction.member.roles.add(roleId);

    return respond(
      interaction,
      ephemeral(
        `You will now receive **${name}** pings.`
      )
    );
  } catch (err) {
    console.error(err);

    return respond(
      interaction,
      ephemeral(
        'I could not change your role. Staff: move my bot role above that role.'
      )
    );
  }
}

async function handleNotify(interaction) {
  return toggleRole(
    interaction,
    config.roles.sessionPing,
    'Session Notification'
  );
}

async function handleNotification(interaction) {
  const key = interaction.customId.slice('notif:'.length);

  const entry = config.notificationRoles.find(
    (n) => n.key === key
  );

  if (!entry) {
    return respond(
      interaction,
      ephemeral('That notification no longer exists.')
    );
  }

  const roleId =
    entry.roleId ||
    (entry.key === 'session' ? config.roles.sessionPing : '');

  return toggleRole(interaction, roleId, entry.label);
}

// ---- Marketplace ----

async function handleShopView(interaction) {
  const pages = ui.ephemeralPages(ui.shopView());

  if (!interaction.deferred && !interaction.replied) {
    await interaction.reply(pages[0]);
  } else {
    await interaction.followUp(pages[0]);
  }

  for (const page of pages.slice(1)) {
    await interaction.followUp(page);
  }
}

async function handleShopTicket(interaction) {
  await ack(interaction);

  if (!config.shopTicket) {
    return respond(
      interaction,
      ephemeral(
        'Shop tickets are not set up yet. ' +
        'Staff: add `shopTicket` to config.js.'
      )
    );
  }

  const message = await tickets.createTicket(
    interaction,
    config.shopTicket
  );

  return respond(interaction, ephemeral(message));
}

// ---- Suggestions ----

async function handleSuggestionVote(interaction, direction) {
  const suggestion = db.data.suggestions[interaction.message.id];

  if (!suggestion) {
    return respond(
      interaction,
      ephemeral('I can no longer find that suggestion.')
    );
  }

  const mine =
    direction === 'up' ? suggestion.up : suggestion.down;

  const other =
    direction === 'up' ? suggestion.down : suggestion.up;

  const userId = interaction.user.id;
  const index = mine.indexOf(userId);

  if (index >= 0) {
    mine.splice(index, 1);
  } else {
    mine.push(userId);

    const otherIndex = other.indexOf(userId);

    if (otherIndex >= 0) {
      other.splice(otherIndex, 1);
    }
  }

  db.save();

  return interaction.update(
    ui.asUpdate(ui.suggestionCard(suggestion))
  );
}

async function handleSuggestionDecision(interaction, status) {
  if (!isStaff(interaction.member)) {
    return respond(
      interaction,
      ephemeral('Only staff can accept or deny suggestions.')
    );
  }

  const suggestion = db.data.suggestions[interaction.message.id];

  if (!suggestion) {
    return respond(
      interaction,
      ephemeral('I can no longer find that suggestion.')
    );
  }

  suggestion.status = status;
  suggestion.by = interaction.user.id;

  db.save();

  return interaction.update(
    ui.asUpdate(ui.suggestionCard(suggestion))
  );
}

// ---- Appeals ----

// Disable every button in an appeal card.
function disableButtons(component) {
  const json =
    typeof component.toJSON === 'function'
      ? component.toJSON()
      : component;

  const clone = JSON.parse(JSON.stringify(json));

  const walk = (node) => {
    if (!node) return;

    if (Array.isArray(node)) {
      return node.forEach(walk);
    }

    if (node.type === 2) {
      node.disabled = true;
      return;
    }

    ['components', 'accessory'].forEach((key) => {
      if (node[key]) walk(node[key]);
    });
  };

  walk(clone);

  return clone;
}

async function handleAppeal(interaction, decision, caseId) {
  if (!isStaff(interaction.member)) {
    return respond(
      interaction,
      ephemeral('Only staff can review appeals.')
    );
  }

  const appeal = db.data.appeals?.[caseId];

  const record = db.data.cases.find(
    (c) => c.guildId === interaction.guildId && String(c.id) === caseId
  );

  if (
    !appeal ||
    appeal.status !== 'pending' ||
    !record
  ) {
    return respond(
      interaction,
      ephemeral('This appeal is no longer pending.')
    );
  }

  if (decision === 'approve' && record.type === 'ban' && !interaction.member.permissions.has(require('discord.js').PermissionFlagsBits.BanMembers)) {
    return respond(interaction, ephemeral('You need Ban Members to approve this appeal.'));
  }
  if (decision === 'approve' && record.type === 'timeout' && !interaction.member.permissions.has(require('discord.js').PermissionFlagsBits.ModerateMembers)) {
    return respond(interaction, ephemeral('You need Moderate Members to approve this appeal.'));
  }

  appeal.status =
    decision === 'approve' ? 'approved' : 'denied';

  appeal.handledBy = interaction.user.id;

  if (decision === 'approve') {
    record.removed = true;

    if (record.type === 'ban') {
      await interaction.guild.members
        .unban(record.userId, 'Appeal approved')
        .catch(() => null);
    }

    if (record.type === 'timeout') {
      const member = await interaction.guild.members
        .fetch(record.userId)
        .catch(() => null);

      if (member) {
        await member
          .timeout(null, 'Appeal approved')
          .catch(() => null);
      }
    }
  }

  db.save();

  const first = interaction.message.components[0];

  await interaction.update({
    components: first ? [disableButtons(first)] : [],
  });

  return interaction.followUp(
    ephemeral(`Appeal ${appeal.status}.`)
  );
}

// ---- Announcement form ----

async function handleAnnounceSubmit(interaction) {
  if (!isStaff(interaction.member)) {
    return respond(interaction, ephemeral('Staff only.'));
  }

  const [, channelId, ping] = interaction.customId.split(':');

  const title = interaction.fields.getTextInputValue('title');
  const body = interaction.fields.getTextInputValue('body');

  await ack(interaction);

  const channel = await interaction.guild.channels
    .fetch(channelId)
    .catch(() => null);

  if (!channel || !channel.isTextBased()) {
    return respond(
      interaction,
      ephemeral('I cannot post in that channel.')
    );
  }

  const roleId = config.roles.announcementPing;

  try {
    if (ping === '1' && roleId) {
      await channel.send({
        content: `<@&${roleId}>`,
        allowedMentions: { roles: [roleId] },
      });
    }

    await channel.send(
      ui.asMessage(
        ui.announcementCard({
          title,
          body,
          userId: interaction.user.id,
        })
      )
    );
  } catch (err) {
    console.error(err);

    return respond(
      interaction,
      ephemeral(
        'I could not post there. Check my permissions in that channel.'
      )
    );
  }

  return respond(
    interaction,
    ephemeral(`Announcement posted in ${channel}.`)
  );
}

// ---- Main interaction handler ----

module.exports = async function onInteraction(interaction) {
  try {
    if (!interaction.inGuild()) return;

    if (interaction.isButton() && interaction.customId.startsWith('dash:')) {
      return await require('../commands/dashboard').button(interaction);
    }

    if (interaction.isUserSelectMenu?.() && interaction.customId.startsWith('dashscope:')) {
      return await require('../commands/dashboard').select(interaction);
    }

    // Autocomplete.
    if (interaction.isAutocomplete()) {
      const command = interaction.client.commands.get(
        interaction.commandName
      );

      if (command?.autocomplete) {
        await command.autocomplete(interaction);
      } else {
        await interaction.respond([]);
      }

      return;
    }

    // Slash commands.
    if (interaction.isChatInputCommand()) {
      require('../utils/presentation').install(interaction);
      const command = interaction.client.commands.get(
        interaction.commandName
      );

      if (command) {
        await command.execute(interaction);
      }

      return;
    }

    // Dropdowns.
    if (interaction.isStringSelectMenu()) {
      switch (interaction.customId) {
        case 'reg:server':
          return await handleRegulation(interaction, 'server');

        case 'reg:banned':
          return await handleRegulation(interaction, 'banned');

        case 'info:topic':
          return await handleInfoTopic(interaction);

        case 'dept:select':
          return await handleDepartment(interaction);

        case 'app:select':
          return await handleApplication(interaction);

        case 'ticket:create':
          return await handleTicketSelect(interaction);

        case 'select_staff_info':
          return await handleStaffInfo(interaction);

        default:
          return;
      }
    }

    // Buttons.
    if (interaction.isButton()) {
      const id = interaction.customId;

      if (id === 'verification:verify') {
        return await require('../commands/verification').button(
          interaction
        );
      }

      if (id.startsWith('bj:')) {
        return await require('../commands/gamble').button(
          interaction
        );
      }

      if (id.startsWith('appeal:')) {
        const [, decision, caseId] = id.split(':');

        return await handleAppeal(
          interaction,
          decision,
          caseId
        );
      }

      if (id.startsWith('notif:')) {
        return await handleNotification(interaction);
      }

      // The newer ticket module handles ticket buttons.
      if (id.startsWith('ticket:')) {
        return await tickets.handleButton(interaction);
      }

      switch (id) {
        case 'session:notify':
          return await handleNotify(interaction);

        case 'shop:view':
          return await handleShopView(interaction);

        case 'shop:ticket':
          return await handleShopTicket(interaction);

        case 'sug:up':
          return await handleSuggestionVote(interaction, 'up');

        case 'sug:down':
          return await handleSuggestionVote(interaction, 'down');

        case 'sug:accept':
          return await handleSuggestionDecision(
            interaction,
            'accepted'
          );

        case 'sug:deny':
          return await handleSuggestionDecision(
            interaction,
            'denied'
          );

        default:
          return;
      }
    }

    // Modal submissions.
    if (interaction.isModalSubmit()) {
      if (interaction.customId === 'ticketclose') {
        return await tickets.handleCloseModal(interaction);
      }

      if (interaction.customId.startsWith('announce:')) {
        return await handleAnnounceSubmit(interaction);
      }
    }
  } catch (err) {
    const what =
      interaction.customId ||
      interaction.commandName ||
      'unknown';

    console.error(
      `[interaction error] while handling "${what}":`,
      err
    );

    if (err?.rawError) {
      console.error(
        '[discord said]',
        JSON.stringify(err.rawError).slice(0, 2000)
      );
    }

    if (err?.requestBody?.json) {
      console.error(
        '[request sent]',
        JSON.stringify(err.requestBody.json).slice(0, 3000)
      );
    }

    const message =
      'Something went wrong. Please try again, or let staff know.';

    try {
      if (interaction.deferred) {
        await interaction.editReply(ephemeral(message));
      } else if (interaction.replied) {
        await interaction.followUp(ephemeral(message));
      } else if (interaction.isRepliable()) {
        await interaction.reply(ephemeral(message));
      }
    } catch {
      // Interaction expired or was already acknowledged.
    }
  }
};
