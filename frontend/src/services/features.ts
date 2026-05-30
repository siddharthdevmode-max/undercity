export interface Feature {
  id: string;
  icon: string;
  name: string;
  description: string;
}

export const FEATURES: Feature[] = [
  { id: 'gym',          icon: '🏋️', name: 'GYM',          description: 'Train your stats' },
  { id: 'crimes',       icon: '🔪', name: 'CRIMES',       description: 'Pull off heists' },
  { id: 'jobs',         icon: '💼', name: 'JOBS',         description: 'Earn legal money' },
  { id: 'attack',       icon: '🔫', name: 'ATTACK',       description: 'PvP combat' },
  { id: 'properties',   icon: '🏠', name: 'PROPERTIES',   description: 'Buy real estate' },
  { id: 'factions',     icon: '👥', name: 'FACTIONS',     description: 'Join a crew' },
  { id: 'casino',       icon: '🎰', name: 'CASINO',       description: 'Gamble & win' },
  { id: 'bank',         icon: '🏦', name: 'BANK',         description: 'Invest your cash' },
  { id: 'stocks',       icon: '📈', name: 'STOCKS',       description: 'Play the market' },
  { id: 'missions',     icon: '🎯', name: 'MISSIONS',     description: 'Complete contracts' },
  { id: 'hospital',     icon: '🏥', name: 'HOSPITAL',     description: 'Heal your wounds' },
  { id: 'jail',         icon: '⛓️', name: 'JAIL',         description: 'Break out or wait' },
  { id: 'events',       icon: '🎉', name: 'EVENTS',       description: 'Limited-time chaos' },
  { id: 'bounties',     icon: '🥊', name: 'BOUNTIES',     description: 'Hunt for cash' },
  { id: 'flying',       icon: '✈️', name: 'FLYING',       description: 'Travel the world' },
  { id: 'forum',        icon: '💬', name: 'FORUM',        description: 'Community talks' },
  { id: 'calendar',     icon: '📅', name: 'CALENDAR',     description: 'Daily events' },
  { id: 'education',    icon: '🎓', name: 'EDUCATION',    description: 'Learn new skills' },
  { id: 'black-market', icon: '🕶️', name: 'BLACK MARKET', description: 'Trade in the shadows' },
  { id: 'newspaper',    icon: '📰', name: 'NEWSPAPER',    description: 'In-game news' },
  { id: 'faction-war',  icon: '⚔️', name: 'FACTION WAR',  description: 'Crew vs crew' },
  { id: 'territory',    icon: '🗺️', name: 'TERRITORY',    description: 'Control the map' },
  { id: 'bazaar',       icon: '🛒', name: 'BAZAAR',       description: 'Open market trade' },
  { id: 'trade',        icon: '🤝', name: 'TRADE',        description: 'Player exchanges' },
];
