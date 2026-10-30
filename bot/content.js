// ============================================================================
//  CONTENT  -  the text shown when someone picks an option from the
//  "Server Regulations" and "Banned Items" dropdowns on the Regulations panel.
//
//  Replace the examples with your real rules. Each dropdown option is one entry.
//  Keep each entry under about 3500 characters (Discord's limit is 4000 per message).
//  Max 25 entries per dropdown.
// ============================================================================

module.exports = {
  // "Server Regulations" dropdown
  regulations: {
    general: {
      label: 'General Regulations',
      description: 'Rules that apply to everyone',
      rules: [
        'Respect all players and staff at all times.',
        'No harassment, discrimination or hate speech of any kind.',
        'Follow all staff instructions immediately.',
        'No advertising other servers or communities.',
        'No exploiting, glitching or using third-party cheats.',
      ],
    },
    roleplay: {
      label: 'Roleplay Regulations',
      description: 'How to behave in character',
      rules: [
        'Stay in character at all times while in the game.',
        'No Fail RP: act realistically for every situation.',
        'No Random Deathmatch (RDM) or Vehicle Deathmatch (VDM).',
        'No Combat Logging: do not leave to avoid a scene.',
        'Value your life: do not act recklessly when threatened.',
      ],
    },
    vehicles: {
      label: 'Vehicle Regulations',
      description: 'Driving and vehicle rules',
      rules: [
        'Drive realistically and obey traffic laws.',
        'No reckless driving or purposely crashing into others.',
        'Emergency vehicles may only use lights and sirens on a call.',
      ],
    },
    discord: {
      label: 'Discord Regulations',
      description: 'Rules for our Discord server',
      rules: [
        'Keep chats on topic and use the correct channels.',
        'No spamming, mass pinging or excessive caps.',
        'No NSFW or graphic content.',
        'Do not ping staff inside tickets, they are already notified.',
      ],
    },
  },

  // "Banned Items" dropdown
banned: {
  vehicles: {
    label: 'Banned Vehicles',
    description: 'Vehicles you cannot use',
    items: [
      'Kovac Heladera 2023',
      'Strugatti Ettore 2020',
      'Falcon Heritage Track 2022',
      'Surrey 650S 2016',
      'Averon R8 2017',
      'Takeo Experience 2021',
      'Chevlon Corbeta 8/X08',
      'Pea Car 2025',
      'Other exotic vehicles',
    ],
  },
  weapons: {
    label: 'Banned Weapons',
    description: 'Weapons you cannot use',
    items: [
      'Remington MSR',
      'M249',
      'Remington 700P',
      'PSH-41',
      'Remington 870',
      'SWAT weapons',
    ],
  },
  other: {
    label: 'Other Banned Items',
    description: 'Roleplay scenarios you cannot use',
    items: [
      'Animal Abuse Roleplay',
      'Animal Roleplay',
      'Bomb Roleplay',
      'Terrorism Roleplay',
      'Torture Roleplay',
      'Drug Roleplay',
      'NSFW Roleplay',
      'Ice Roleplay',
      'Suicide Roleplay',
      'Furry Roleplay',
      'Femboy Roleplay',
    ],
  },
},

  // "More Information" dropdown on the Information panel.
  // Each entry: label/description (shown in the menu), title, quote (grey quote lines),
  // body (main text, **bold** works), image (a file in /assets, optional).
  infoTopics: {
    borders: {
      label: 'Borders',
      description: 'Where the borders are and how sessions work',
      emoji: '🛂',
      title: 'BORDERS:',
      quote: ['RED: BORDER OPERATION CENTER', 'BLACK: BORDERS'],
      body:
        '**We have 3 main borders and 1 Operations Center. For each border RP session we will decide ' +
        'which border to use, and that border will be used during that session.**',
      image: 'border_map.png',
    },
    join: {
      label: 'How to Join',
      description: 'How to get into our in-game server',
      emoji: '🎮',
      title: 'HOW TO JOIN',
      quote: [],
      body:
        '1. Launch our ER:LC game using the **ER:LC Game** button on the Information panel.\n' +
        '2. When a session is live, join our private server with the code shown on the **Session Info** panel.\n' +
        '3. Make sure you have read the **Rules** before you join.',
      image: '',
    },
chainOfCommand: {
      label: 'Chain of Command',
      description: 'Staff ranks and responsibilities',
      emoji: '📋',
      title: 'STAFF CHAIN OF COMMAND',
      quote: [
        'OWNER → LEADERSHIP → EXECUTIVE TEAM',
        'INTERNAL AFFAIRS → MANAGEMENT → SUPERVISORY',
        'ADMINISTRATORS → MODERATORS',
      ],
      body:
        '**Owner:** Has final responsibility for the community and makes final decisions.\n' +
        '**Leadership:** Sets staff direction and oversees senior staff.\n' +
        '**Executive Team:** Coordinates departments and carries out leadership decisions.\n' +
        '**Internal Affairs Team:** Reviews staff conduct concerns fairly and confidentially.\n' +
        '**Management Team:** Oversees daily staff operations and significant issues.\n' +
        '**Supervisory Team:** Guides Administrators and Moderators and escalates serious concerns.\n' +
        '**Administrator Team:** Handles complex cases and supports Moderators.\n' +
        '**Moderator Team:** Enforces rules, responds to reports, and escalates serious cases.\n\n' +
        '**Specialist roles:** Community Manager, Server Developer, and Discord Developer are outside the chain of command. If someone also holds a staff rank, they follow the chain for that rank.',
      image: '',
    },
  },
};
