// ============================================================================
//  CONFIG  -  this is the main file you edit.
//  Anything left as '' (empty) is simply skipped, so you can fill things in bit by bit.
//  To copy an ID: Discord -> User Settings -> Advanced -> turn ON Developer Mode,
//  then right-click a role / channel / category -> "Copy ID".
// ============================================================================

module.exports = {
  name: 'Laredo Roleplay',

  // Coloured bar down the left of every panel. null = no bar.
  accentColor: null,

// ---- BANNER IMAGES -------------------------------------------------------
  banners: {
    regulations: 'rules.png',
    information: 'information.png',
    assistance: 'assistance.png',
    session: 'session_info.png',
    roles: 'roles.png',
    marketplace: 'marketplace.png',
    departments: 'departments.png',
    applications: 'applications.png',
    staffInfo: 'staff-Info.png',  // <--- ADDED HERE
    footer: 'divider_bar.png',
  },

  // ---- ROLE IDs ------------------------------------------------------------
  roles: {
    staff: '1558228597402243153',           // can use every staff command and sees every ticket
    sessionPing: '1557829275015712829',     // given by the "Session Notification" button, pinged on /session start
    announcementPing: '1558196501019365386', // pinged by /announce
  },

  // ---- CHANNEL IDs ---------------------------------------------------------
  channels: {
    ticketCategory: '1557837372945866852', // the CATEGORY new ticket channels get created in
    ticketLogs: '1557837475882205184',     // transcripts are posted here when a ticket closes
    modLogs: '1554215148506587267',        // every warn / kick / ban / timeout is logged here
    suggestions: '1554214636562161684',    // where /suggest posts
    staffReviews: '1558190601890172948',   // where /staffreview posts
  },

  // ---- MODERATION ----------------------------------------------------------
  // At this many warns/kicks/timeouts the bot alerts staff in the mod logs (it does NOT auto-ban).
  maxModerations: 75,

  // ---- TEXT SHOWN ON PANELS ------------------------------------------------
  kickTimer: '30 Minutes',
  responseTime: '12-20 minutes',

  // Intro text on the Information panel. **bold** works.
  information:
"**Laredo Roleplay** opened on the 1st of October, 2026. " +
"Our aim is to make our roleplay realistic and create a great experience for all our server members. " +
"From Discord to our in-game server, we're always here to help with whatever you need!",

  // Link buttons on the Information panel. '' hides a button. Must be full https:// links.
  links: {

    ChainOfCommand: '',
    website: 'https://laredo-roleplay.pages.dev/',
    erlcGame: 'https://www.roblox.com/games/2534724415/Emergency-Response-Liberty-County',
  },

  // ---- TICKETS -------------------------------------------------------------
  maxOpenTicketsPerUser: 1,

  // The "Select a ticket type..." dropdown. emoji can be a normal emoji or a custom one like <:name:123456>
  ticketTypes: [
    { id: 'general',    label: 'General Support',   description: 'Questions or general help',         emoji: '🎫', extraRoles: [] },
    { id: 'report',     label: 'Player Report',     description: 'Report a player for breaking rules', emoji: '🚨', extraRoles: [] },
    { id: 'appeal',     label: 'Moderation Appeal', description: 'Appeal a warning, kick or ban',      emoji: '⚖️', extraRoles: [] },
    { id: 'management', label: 'Management',        description: 'Speak with management directly',     emoji: '👑', extraRoles: [] },
  ],

  // Opened by the Marketplace panel's "Open Shop Ticket" button. extraRoles = roles that can also see shop tickets.
  shopTicket: {
    id: 'shop',
    label: 'Shop Purchase',
    description: 'Buy something from the marketplace',
    emoji: '🛒',
    extraRoles: [],
    welcome: 'Tell us which item(s) from the shop you would like to buy, and your Roblox username.',
  },

  // ---- DEPARTMENTS ---------------------------------------------------------
  // Shown on the Departments panel and in its dropdown.
  // invite = the department's Discord invite link ('' = shows "link coming soon").
  // emoji can be a normal emoji or a custom one like <:name:123456>
  departmentHub: '', // invite to your Department Hub server ('' hides the hub line)
  departments: [
    { id: 'lpd',    name: 'Laredo Police Department',          emoji: '🚓', invite: 'https://discord.gg/R65Y2cfGTH', description: 'Patrol the streets of Laredo, respond to calls and keep the community safe.' },
    { id: 'wcso',   name: "Webb County Sheriff's Office",  emoji: '⭐', invite: '', description: 'County law enforcement: patrol outside the city, serve warrants and run the county jail.' },
    { id: 'dps',    name: 'Texas DPS / Highway Patrol',        emoji: '🚔', invite: 'https://discord.gg/KbFmgQndKk', description: 'State troopers: highway patrol, traffic enforcement and statewide response.' },
    { id: 'lfd',    name: 'Laredo Fire Department',            emoji: '🚒', invite: '', description: 'Fight fires, respond to emergencies and rescue people in need.' },
    { id: 'fbi',    name: 'Federal Bureau of Investigation',   emoji: '🕵️', invite: '', description: 'Federal investigations and major cases.' },
    { id: 'bp',     name: 'Border Patrol',                     emoji: '🛃', invite: '', description: 'Secure the border and work the checkpoints.' },
    { id: 'swat',   name: 'SWAT',                              emoji: '🛡️', invite: '', description: 'High-risk operations and tactical response.' },
    { id: 'dot',    name: 'Department of Transportation',      emoji: '🚧', invite: '', description: 'Keep the roads clear and safe: roadwork, tow and traffic support.' },
  ],

  // ---- NOTIFICATION ROLES (the Notifications panel buttons) ------------------
  // Each button gives/removes that role. For "session", leave roleId '' to use roles.sessionPing.
  notificationRoles: [
    { key: 'announcement', label: 'Announcement Notification', emoji: '📢', roleId: '1558196501019365386' },
    { key: 'giveaway',     label: 'Giveaway Notification',     emoji: '🎉', roleId: '1558205628910927872' },
    { key: 'chat',         label: 'Active Chat Notification',  emoji: '💬', roleId: '1558205753876025344' },
    { key: 'session',      label: 'Session Notification',      emoji: '🎮', roleId: '1557829275015712829' },
  ],

  // ---- APPLICATIONS (the Applications panel dropdown) ------------------------
  // open: false shows "currently closed" instead of the link. Add more by copying a block.
  applications: [
    {
      id: 'moderator',
      label: 'Moderator Application',
      description: 'Apply to join our moderation team',
      emoji: '🛡️',
      open: true,
      url: 'https://laredo-roleplay.pages.dev/#applications',
      info: 'Read the requirements below, then press the button to open the application form. Answer honestly and in detail.\nOnly submit once. Our team will contact you if you are accepted.',
    },
  ],

// ---- STAFF INFO PANEL -----------------------------------------------------
  staffInfo: {
    description: 'Select an option from the dropdown menu below to view staff resources, links, and guidelines.',
    dashboardUrl: 'https://laredo-roleplay.pages.dev/#dashboard',
    options: [
      {
        id: 'join_melonly',
        label: 'Join Melonly',
        description: 'Link to join our Melonly workspace',
        emoji: '🍉',
        url: 'https://melon.ly/join/CJXCJR',
        info: 'Click the link below to join our official Melonly staff team portal:\nhttps://melon.ly/join/CJXCJR',
      },
      {
        id: 'staff_handbook',
        label: 'Staff Handbook',
        description: 'Read the official staff handbook',
        emoji: '📖',
        url: 'https://docs.google.com/document/d/17clfPXv-j7i1PyCrL5o32dL5GG7jinqBv2kT5Dhb8_k/edit?usp=sharing',
        info: 'Click the link below to view the full Staff Handbook:\nhttps://docs.google.com/document/d/17clfPXv-j7i1PyCrL5o32dL5GG7jinqBv2kT5Dhb8_k/edit?usp=sharing',
      },
      {
        id: 'app_requirements',
        label: 'Staff Application Requirements',
        description: 'Requirements needed to apply for staff',
        emoji: '📋',
        url: 'https://melonly.com/doc/7515098925661949952',
        info: 'Click the link below to view the full Staff Application Requirements:\nhttps://melonly.com/doc/7518052786215325696', // wait, 7515098925661949952 link
      },
      {
        id: 'ticket_guidelines',
        label: 'Ticket Guidelines',
        description: 'Guidelines for handling support tickets',
        emoji: '🎫',
        url: 'https://melonly.com/doc/7518052786215325696',
        info: 'Click the link below to view our official Ticket Guidelines:\nhttps://melonly.com/doc/7518052786215325696',
      },
    ],
},
  // ---- SESSION PANEL DEFAULTS ----------------------------------------------
  session: {
    serverName: 'Laredo Roleplay I Texas I Strict I Realistic',
    owner: 'Australlianboy17',
    code: 'EATCX',
    maxPlayers: 50,
  },
};
