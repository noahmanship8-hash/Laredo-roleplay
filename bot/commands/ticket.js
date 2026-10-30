const { SlashCommandBuilder, MessageFlags, AttachmentBuilder } = require('discord.js');
const db = require('../utils/db');
const { isStaff } = require('../utils/perms');
const tickets = require('../utils/tickets');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ticket')
    .setDescription('Manage the ticket you are in')
    .addSubcommand((s) => s.setName('claim').setDescription('Staff: claim this ticket'))
    .addSubcommand((s) => s.setName('unclaim').setDescription('Staff: release your claim on this ticket'))
    .addSubcommand((s) =>
      s
        .setName('close')
        .setDescription('Close this ticket and save a transcript')
        .addStringOption((o) => o.setName('reason').setDescription('Reason for closing').setMaxLength(300)),
    )
    .addSubcommand((s) =>
      s
        .setName('add')
        .setDescription('Staff: add someone to this ticket')
        .addUserOption((o) => o.setName('user').setDescription('Who to add').setRequired(true)),
    )
    .addSubcommand((s) =>
      s
        .setName('remove')
        .setDescription('Staff: remove someone from this ticket')
        .addUserOption((o) => o.setName('user').setDescription('Who to remove').setRequired(true)),
    )
    .addSubcommand((s) =>
      s
        .setName('rename')
        .setDescription('Staff: rename this ticket channel')
        .addStringOption((o) => o.setName('name').setDescription('New name').setRequired(true).setMaxLength(50)),
    )
    .addSubcommand((s) => s.setName('transcript').setDescription('Staff: get a transcript of this ticket so far')),

  async execute(interaction) {
    const reply = (content) =>
      interaction.reply({ content, flags: MessageFlags.Ephemeral, allowedMentions: { parse: [] } });

    const ticket = db.data.tickets[interaction.channelId];
    if (!ticket) return reply('This command only works inside a ticket channel.');

    const sub = interaction.options.getSubcommand();
    const staff = isStaff(interaction.member);
    const channel = interaction.channel;

    if (sub === 'close') {
      if (!staff && interaction.user.id !== ticket.userId) {
        return reply('Only staff or the ticket owner can close this ticket.');
      }
      const reason = interaction.options.getString('reason') || '';
      await interaction.reply({ content: '🔒 Closing this ticket...', flags: MessageFlags.Ephemeral });
      const result = await tickets.closeTicket(channel, interaction.user, reason);
      if (!result.ok) await interaction.followUp({ content: result.error, flags: MessageFlags.Ephemeral }).catch(() => {});
      return;
    }

    if (!staff) return reply('Staff only.');

    if (sub === 'claim') {
      const problem = tickets.claim(ticket, interaction.member);
      if (problem) return reply(problem);
      await tickets.refreshCard(channel, ticket);
      await tickets.say(channel, `✅ ${interaction.user} has claimed this ticket.`);
      return reply('You claimed this ticket.');
    }

    if (sub === 'unclaim') {
      const problem = tickets.unclaim(ticket, interaction.member);
      if (problem) return reply(problem);
      await tickets.refreshCard(channel, ticket);
      await tickets.say(channel, `↩️ ${interaction.user} has unclaimed this ticket.`);
      return reply('You released this ticket.');
    }

    if (sub === 'transcript') {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const file = await tickets.transcriptFile(channel, ticket);
      return interaction.editReply({
        content: 'Here is the transcript so far. Open the file in your browser.',
        files: [new AttachmentBuilder(file.bytes, { name: file.name })],
      });
    }

    try {
      if (sub === 'add') {
        const user = interaction.options.getUser('user', true);
        await channel.permissionOverwrites.edit(user.id, {
          ViewChannel: true,
          SendMessages: true,
          ReadMessageHistory: true,
          AttachFiles: true,
        });
        await tickets.say(channel, `➕ ${user} was added to the ticket by ${interaction.user}.`, { users: [user.id] });
        return reply(`Added ${user.username}.`);
      }

      if (sub === 'remove') {
        const user = interaction.options.getUser('user', true);
        if (user.id === ticket.userId) return reply('You cannot remove the person who opened the ticket.');
        await channel.permissionOverwrites.delete(user.id);
        await tickets.say(channel, `➖ ${user.username} was removed from the ticket by ${interaction.user}.`);
        return reply(`Removed ${user.username}.`);
      }

      if (sub === 'rename') {
        const name = interaction.options.getString('name', true).toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-');
        await channel.setName(name || 'ticket');
        return reply(`Renamed to **${name}**. (Discord only allows a few renames every 10 minutes.)`);
      }
    } catch (err) {
      console.error('[ticket command]', err);
      return reply('I could not do that. Check that I have the Manage Channels and Manage Roles permissions.');
    }
  },
};
