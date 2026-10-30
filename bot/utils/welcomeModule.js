const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

// Channel Configuration
const WELCOME_CHANNEL_ID = '1564763886882922537';
const VERIFY_CHANNEL_ID = '1554214429757935729';

/**
 * Helper function to return ordinal suffix (1st, 2nd, 3rd, 39th, etc.)
 */
function getOrdinalSuffix(n) {
    const remainder100 = n % 100;
    if (remainder100 >= 11 && remainder100 <= 13) return `${n}th`;
    const remainder10 = n % 10;
    switch (remainder10) {
        case 1: return `${n}st`;
        case 2: return `${n}nd`;
        case 3: return `${n}rd`;
        default: return `${n}th`;
    }
}

/**
 * Exported function to attach directly into your existing bot setup
 * @param {import('discord.js').Client} client
 */
function setupWelcomeModule(client) {
    client.on('guildMemberAdd', async (member) => {
        try {
            const channel = member.guild.channels.cache.get(WELCOME_CHANNEL_ID)
                         || await member.guild.channels.fetch(WELCOME_CHANNEL_ID).catch(() => null);

            if (!channel) return;

            const memberCount = member.guild.memberCount;
            const countFormatted = getOrdinalSuffix(memberCount);
            const verifyUrl = `https://discord.com/channels/${member.guild.id}/${VERIFY_CHANNEL_ID}`;

            // Verification Button
            const verifyButton = new ButtonBuilder()
                .setLabel('Verify Here')
                .setStyle(ButtonStyle.Link)
                .setURL(verifyUrl);

            const row = new ActionRowBuilder().addComponents(verifyButton);

            // Message text styled as requested
            const msgContent = `Welcome <@${member.id}> to **Laredo Roleplay** you are our ${countFormatted} member!
` +
                               `> Please Verify in https://discord.com/channels/${member.guild.id}/${VERIFY_CHANNEL_ID}, to gain full access to our sever.`;

            // Embed with Green border accent
            const welcomeEmbed = new EmbedBuilder()
                .setTitle('👋 Welcome to Laredo Roleplay!')
                .setDescription(msgContent)
                .setColor('#57F287')
                .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
                .setFooter({ text: `User ID: ${member.id}` });

            await channel.send({
                content: `Welcome <@${member.id}>!`,
                embeds: [welcomeEmbed],
                components: [row]
            });

        } catch (error) {
            console.error('Error sending welcome message:', error);
        }
    });
}

module.exports = setupWelcomeModule;
