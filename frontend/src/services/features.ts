export interface Feature {
  id: string;
  icon: string;       // SVG icon name (no emoji)
  name: string;
  description: string;
}

export const FEATURES: Feature[] = [
  { id: 'gym',          icon: 'gym',          name: 'GYM',          description: 'Build strength, speed & dexterity'  },
  { id: 'crimes',       icon: 'crime',        name: 'CRIMES',       description: 'Pull off heists for cash & XP'      },
  { id: 'jobs',         icon: 'job',          name: 'JOBS',         description: 'Earn steady legitimate income'       },
  { id: 'attack',       icon: 'attack',       name: 'ATTACK',       description: 'Hit rivals, take their cash'         },
  { id: 'properties',   icon: 'properties',   name: 'PROPERTIES',   description: 'Own the city block by block'         },
  { id: 'factions',     icon: 'gang',         name: 'FACTIONS',     description: 'Build loyalty, rule territory'       },
  { id: 'casino',       icon: 'casino',       name: 'CASINO',       description: 'High risk, high reward gambling'     },
  { id: 'bank',         icon: 'bank',         name: 'BANK',         description: 'Protect & grow your fortune'         },
  { id: 'stocks',       icon: 'stocks',       name: 'STOCKS',       description: 'Play the underground market'         },
  { id: 'missions',     icon: 'missions',     name: 'MISSIONS',     description: 'Take contracts, build reputation'    },
  { id: 'hospital',     icon: 'hospital',     name: 'HOSPITAL',     description: 'Recover from attacks & injuries'     },
  { id: 'jail',         icon: 'jail',         name: 'JAIL',         description: 'Bust out or serve your time'        },
  { id: 'events',       icon: 'events',       name: 'EVENTS',       description: 'City-wide chaos & competitions'      },
  { id: 'bounties',     icon: 'bounty',       name: 'BOUNTIES',     description: 'Hunt targets for blood money'        },
  { id: 'flying',       icon: 'travel',       name: 'FLYING',       description: 'Move between cities for profit'      },
  { id: 'forum',        icon: 'forum',        name: 'FORUM',        description: 'Intel, deals & street talk'          },
  { id: 'calendar',     icon: 'calendar',     name: 'CALENDAR',     description: 'Track ops, cooldowns & events'       },
  { id: 'education',    icon: 'education',    name: 'EDUCATION',    description: 'Learn skills the streets respect'    },
  { id: 'black-market', icon: 'black-market', name: 'BLACK MARKET', description: 'Trade contraband in the shadows'    },
  { id: 'newspaper',    icon: 'newspaper',    name: 'NEWSPAPER',    description: 'Underground news & hit reports'      },
  { id: 'faction-war',  icon: 'gang-wars',    name: 'FACTION WAR',  description: 'Wage war for respect & turf'        },
  { id: 'territory',    icon: 'territory',    name: 'TERRITORY',    description: 'Control districts, crush rivals'     },
  { id: 'bazaar',       icon: 'market',       name: 'BAZAAR',       description: 'Open market — anything for a price' },
  { id: 'trade',        icon: 'trade',        name: 'TRADE',        description: 'Direct player-to-player exchanges'   },
];
