const {SlashCommandBuilder,MessageFlags,ChannelType}=require('discord.js');
const db=require('../utils/db');const config=require('../config');const {isStaff}=require('../utils/perms');
const types=[...config.ticketTypes,config.shopTicket].filter(Boolean);
const categoryOption=o=>o.setName('category').setDescription('Ticket category').setRequired(true).addChoices(...types.map(t=>({name:t.label,value:t.id})));
module.exports={data:new SlashCommandBuilder().setName('ticketconfig').setDescription('Staff: configure ticket routing')
 .addSubcommand(s=>s.setName('setup').setDescription('Set the ticket category, support role, and transcript channel').addChannelOption(o=>o.setName('category').setDescription('Parent category').addChannelTypes(ChannelType.GuildCategory).setRequired(true)).addRoleOption(o=>o.setName('support_role').setDescription('Default support role').setRequired(true)).addChannelOption(o=>o.setName('log_channel').setDescription('Transcript channel').addChannelTypes(ChannelType.GuildText)))
 .addSubcommand(s=>s.setName('addrole').setDescription('Add a support role to one ticket type').addStringOption(categoryOption).addRoleOption(o=>o.setName('role').setDescription('Support role').setRequired(true)))
 .addSubcommand(s=>s.setName('removerole').setDescription('Remove a support role from one ticket type').addStringOption(categoryOption).addRoleOption(o=>o.setName('role').setDescription('Support role').setRequired(true)))
 .addSubcommand(s=>s.setName('clearroles').setDescription('Clear extra support roles for one ticket type').addStringOption(categoryOption))
 .addSubcommand(s=>s.setName('listroles').setDescription('List support roles for ticket types')),
async execute(i){if(!isStaff(i.member))return i.reply({content:'Staff only.',flags:MessageFlags.Ephemeral});const sub=i.options.getSubcommand(),gid=i.guildId;db.data.ticketSettings[gid] ||= {};db.data.ticketCategoryRoles[gid] ||= {};
 if(sub==='setup'){const c=db.data.ticketSettings[gid];c.categoryId=i.options.getChannel('category').id;c.supportRoleId=i.options.getRole('support_role').id;c.logChannelId=i.options.getChannel('log_channel')?.id||null;db.save();return i.reply({content:'Ticket routing saved. The existing Assistance panel and ticket flow are unchanged.',flags:MessageFlags.Ephemeral})}
 if(sub==='listroles'){const lines=types.map(t=>{const ids=db.data.ticketCategoryRoles[gid][t.id]||[];return `**${t.label}:** ${ids.length?ids.map(id=>`<@&${id}>`).join(', '):'default support role only'}`});return i.reply({content:lines.join('\n'),flags:MessageFlags.Ephemeral})}
 const type=i.options.getString('category'),role=i.options.getRole('role'),list=db.data.ticketCategoryRoles[gid][type] ||= [];
 if(sub==='addrole'){if(!list.includes(role.id))list.push(role.id);db.save();return i.reply({content:`Added ${role} to **${types.find(t=>t.id===type).label}** tickets.`,flags:MessageFlags.Ephemeral})}
 if(sub==='removerole'){db.data.ticketCategoryRoles[gid][type]=list.filter(id=>id!==role.id);db.save();return i.reply({content:`Removed ${role} from that ticket type.`,flags:MessageFlags.Ephemeral})}
 delete db.data.ticketCategoryRoles[gid][type];db.save();return i.reply({content:`Cleared extra support roles for **${types.find(t=>t.id===type).label}**.`,flags:MessageFlags.Ephemeral})}
};
