const { SlashCommandBuilder, MessageFlags, EmbedBuilder } = require('discord.js');
const db = require('../utils/db');
const config = require('../config');
const { isStaff } = require('../utils/perms');

const cfg = (gid) => (db.data.economy.config[gid] ||= { enabled: true, currency: 'coins', symbol: '🪙', daily: 500, workMin: 100, workMax: 400, shop: [] });
const acct = (gid, uid) => (db.data.economy.users[`${gid}:${uid}`] ||= { wallet: 0, bank: 0, dailyAt: 0, workAt: 0, inventory: [] });
const money = (n, c) => `${c.symbol} ${Math.floor(n).toLocaleString()} ${c.currency}`;

module.exports = {
  data: new SlashCommandBuilder().setName('economy').setDescription('Economy and shop commands')
    .addSubcommand(s => s.setName('balance').setDescription('Check a member’s wallet and bank').addUserOption(o => o.setName('member').setDescription('Member')))
    .addSubcommand(s => s.setName('daily').setDescription('Claim your daily reward'))
    .addSubcommand(s => s.setName('work').setDescription('Work for a random reward'))
    .addSubcommand(s => s.setName('deposit').setDescription('Move wallet money into your bank').addIntegerOption(o => o.setName('amount').setDescription('Amount').setRequired(true).setMinValue(1)))
    .addSubcommand(s => s.setName('withdraw').setDescription('Move bank money into your wallet').addIntegerOption(o => o.setName('amount').setDescription('Amount').setRequired(true).setMinValue(1)))
    .addSubcommand(s => s.setName('pay').setDescription('Pay a member').addUserOption(o => o.setName('member').setDescription('Recipient').setRequired(true)).addIntegerOption(o => o.setName('amount').setDescription('Amount').setRequired(true).setMinValue(1)))
    .addSubcommand(s => s.setName('addmoney').setDescription('Staff: add money to a member').addIntegerOption(o => o.setName('amount').setDescription('Amount').setRequired(true).setMinValue(1)).addUserOption(o => o.setName('member').setDescription('Member (defaults to you)')))
    .addSubcommand(s => s.setName('top').setDescription('Show the richest members by net worth'))
    .addSubcommand(s => s.setName('networthtop').setDescription('Show the richest members by total net worth'))
    .addSubcommand(s => s.setName('settings').setDescription('Show economy settings'))
    .addSubcommand(s => s.setName('toggle').setDescription('Staff: enable or disable the economy').addBooleanOption(o => o.setName('enabled').setDescription('Enabled').setRequired(true)))
    .addSubcommand(s => s.setName('shop').setDescription('List shop items'))
    .addSubcommand(s => s.setName('buy').setDescription('Buy an item').addStringOption(o => o.setName('item').setDescription('Item name').setRequired(true).setAutocomplete(true)))
    .addSubcommand(s => s.setName('inventory').setDescription('View your purchased items').addUserOption(o => o.setName('member').setDescription('Member')))
    .addSubcommand(s => s.setName('shopadd').setDescription('Staff: add a shop item').addStringOption(o => o.setName('name').setDescription('Name').setRequired(true).setMaxLength(60)).addIntegerOption(o => o.setName('price').setDescription('Price').setRequired(true).setMinValue(1)).addRoleOption(o => o.setName('role').setDescription('Role granted on purchase')))
    .addSubcommand(s => s.setName('shopremove').setDescription('Staff: remove a shop item').addStringOption(o => o.setName('name').setDescription('Name').setRequired(true).setAutocomplete(true))),
  async autocomplete(interaction) {
    const c = cfg(interaction.guildId), q = interaction.options.getFocused().toLowerCase();
    await interaction.respond(c.shop.filter(x => x.name.toLowerCase().includes(q)).slice(0, 25).map(x => ({ name: `${x.name} — ${x.price}`, value: x.name })));
  },
  async execute(i) {
    const gid=i.guildId, uid=i.user.id, c=cfg(gid), sub=i.options.getSubcommand();
    if (!c.enabled && !['toggle','settings'].includes(sub)) return i.reply({content:'The economy is disabled.',flags:MessageFlags.Ephemeral});
    const user=acct(gid,uid), ephemeral={flags:MessageFlags.Ephemeral};
    if (sub==='balance') { const member=i.options.getUser('member')||i.user, a=acct(gid,member.id); return i.reply({embeds:[new EmbedBuilder().setTitle(`${member.username}’s balance`).addFields({name:'Wallet',value:money(a.wallet,c),inline:true},{name:'Bank',value:money(a.bank,c),inline:true},{name:'Net worth',value:money(a.wallet+a.bank,c),inline:true})]}); }
    if (sub==='settings') return i.reply({content:`Economy: **${c.enabled?'enabled':'disabled'}** · Currency: **${c.symbol} ${c.currency}** · Daily: **${money(c.daily,c)}**`});
    if (sub==='toggle') { if(!isStaff(i.member)) return i.reply({content:'Staff only.',...ephemeral}); c.enabled=i.options.getBoolean('enabled'); db.save(); return i.reply({content:`Economy ${c.enabled?'enabled':'disabled'}.`,...ephemeral}); }
    if (sub==='daily'||sub==='work') { const key=sub==='daily'?'dailyAt':'workAt', wait=sub==='daily'?86400000:3600000, left=wait-(Date.now()-user[key]); if(left>0) return i.reply({content:`Available in ${Math.ceil(left/60000)} minute(s).`,...ephemeral}); const amount=sub==='daily'?c.daily:Math.floor(c.workMin+Math.random()*(c.workMax-c.workMin+1)); user[key]=Date.now(); user.wallet+=amount; db.save(); return i.reply({content:`You earned ${money(amount,c)}. Wallet: ${money(user.wallet,c)}.`}); }
    if (sub==='deposit'||sub==='withdraw') { const n=i.options.getInteger('amount'); const from=sub==='deposit'?'wallet':'bank', to=sub==='deposit'?'bank':'wallet'; if(user[from]<n)return i.reply({content:`You do not have enough in your ${from}.`,...ephemeral});user[from]-=n;user[to]+=n;db.save();return i.reply({content:`Moved ${money(n,c)} to your ${to}.`,...ephemeral}); }
    if (sub==='pay') { const member=i.options.getUser('member'), n=i.options.getInteger('amount'); if(member.bot||member.id===uid) return i.reply({content:'Choose another non-bot member.',...ephemeral}); if(user.wallet<n) return i.reply({content:'You do not have enough in your wallet.',...ephemeral}); user.wallet-=n; acct(gid,member.id).wallet+=n; db.save(); return i.reply({content:`Paid ${member} ${money(n,c)}.`,allowedMentions:{users:[member.id]}}); }
    if (sub==='addmoney') { if(!isStaff(i.member)) return i.reply({content:'Staff only.',...ephemeral}); const member=i.options.getUser('member')||i.user, n=i.options.getInteger('amount'); acct(gid,member.id).wallet+=n; db.save(); return i.reply({content:`Added ${money(n,c)} to ${member.username}’s wallet.`,...ephemeral}); }
    if (sub==='top'||sub==='networthtop') { const rows=Object.entries(db.data.economy.users).filter(([k])=>k.startsWith(`${gid}:`)).map(([k,a])=>({id:k.split(':')[1],...a,total:a.wallet+a.bank})).sort((a,b)=>b.total-a.total).slice(0,10); return i.reply({embeds:[new EmbedBuilder().setTitle('🏦 Net Worth Leaderboard').setDescription(rows.length?rows.map((a,n)=>`**${n+1}.** <@${a.id}> — ${money(a.total,c)} (${money(a.wallet,c)} wallet · ${money(a.bank,c)} bank)`).join('\n'):'No balances yet.')]}); }
    if (sub==='shop') return i.reply({embeds:[new EmbedBuilder().setTitle('Shop').setDescription(c.shop.length?c.shop.map(x=>`**${x.name}** — ${money(x.price,c)}${x.roleId?' · role reward':''}`).join('\n'):'The shop is empty.')]});
    if (sub==='buy') { const name=i.options.getString('item'), item=c.shop.find(x=>x.name.toLowerCase()===name.toLowerCase()); if(!item) return i.reply({content:'That item is not in the shop.',...ephemeral}); if(user.wallet<item.price) return i.reply({content:'You do not have enough in your wallet.',...ephemeral}); if(item.roleId&&i.member.roles.cache.has(item.roleId)) return i.reply({content:'You already have this role reward.',...ephemeral}); user.wallet-=item.price; user.inventory.push({name:item.name,at:Date.now()}); if(item.roleId) await i.member.roles.add(item.roleId).catch(()=>null); db.save(); return i.reply({content:`Purchased **${item.name}** for ${money(item.price,c)}.`,...ephemeral}); }
    if (sub==='inventory') { const member=i.options.getUser('member')||i.user, a=acct(gid,member.id); return i.reply({content:a.inventory.length?`**${member.username}’s inventory:** ${a.inventory.map(x=>x.name).join(', ')}`:`${member.username}’s inventory is empty.`}); }
    if (!isStaff(i.member)) return i.reply({content:'Staff only.',...ephemeral});
    if (sub==='shopadd') { const name=i.options.getString('name'), price=i.options.getInteger('price'); if(c.shop.some(x=>x.name.toLowerCase()===name.toLowerCase())) return i.reply({content:'An item with that name already exists.',...ephemeral}); const role=i.options.getRole('role'); c.shop.push({name,price,roleId:role?.id||null}); db.save(); return i.reply({content:`Added **${name}** to the shop.`,...ephemeral}); }
    const name=i.options.getString('name'), idx=c.shop.findIndex(x=>x.name.toLowerCase()===name.toLowerCase()); if(idx<0) return i.reply({content:'Shop item not found.',...ephemeral}); c.shop.splice(idx,1); db.save(); return i.reply({content:`Removed **${name}** from the shop.`,...ephemeral});
  }
};
