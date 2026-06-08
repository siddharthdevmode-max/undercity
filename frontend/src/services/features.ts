export interface Feature {
  id:          string;
  icon:        string;
  name:        string;
  description: string;
  detail:      string;
  tag?:        string;
}

// ── Order: LIVE first, then by category ──
// Row 1 (LIVE): Crimes, Jail, Hospital
// Row 2 (Combat): Gym, Attack, Headhunt
// Row 3 (Money): Jobs, Bank, Stocks, Exchange, Back Alley, Trade
// Row 4 (Social): Gangs, Gang War, Districts, Forum, Newspaper, Calendar
// Row 5 (World): Missions, Events, Flying, Properties, Casino, Education

export const FEATURES: Feature[] = [

  // ── LIVE ─────────────────────────────────────────────────
  {
    id:          'crimes',
    icon:        'crime',
    name:        'CRIMES',
    description: 'Pull off heists for cash & XP',
    detail:      '25 crimes across 5 tiers — from pickpocketing to bank heists. Master each crime to unlock critical specials and higher payouts.',
    tag:         'LIVE',
  },
  {
    id:          'jail',
    icon:        'jail',
    name:        'JAIL',
    description: 'Bust out or serve your time',
    detail:      'Get caught committing crimes and you go to jail. Wait it out or have allies bust you free. Federal jail is worse.',
    tag:         'LIVE',
  },
  {
    id:          'hospital',
    icon:        'hospital',
    name:        'HOSPITAL',
    description: 'Recover from attacks & injuries',
    detail:      'Take too much damage and you get hospitalized. Life regenerates over time — or pay to leave early.',
    tag:         'LIVE',
  },

  // ── COMBAT ───────────────────────────────────────────────
  {
    id:          'gym',
    icon:        'gym',
    name:        'GYM',
    description: 'Build strength, speed & dexterity',
    detail:      'Train six combat stats. Higher stats mean better outcomes in fights, crimes, and survival. Every rep counts.',
    tag:         'SOON',
  },
  {
    id:          'attack',
    icon:        'attack',
    name:        'ATTACK',
    description: 'Hit rivals, take their cash',
    detail:      'Mug players, steal their money, and send them to hospital. Win fights based on your stats vs theirs. PvP at its rawest.',
    tag:         'SOON',
  },
  {
    id:          'headhunt',
    icon:        'bounty',
    name:        'HEADHUNT',
    description: 'Hunt targets for blood money',
    detail:      'Place bounties on enemies or accept contracts to eliminate targets. Track players across the city for massive payouts.',
    tag:         'SOON',
  },

  // ── ECONOMY ──────────────────────────────────────────────
  {
    id:          'jobs',
    icon:        'job',
    name:        'JOBS',
    description: 'Earn steady legitimate income',
    detail:      'Work at businesses across the city. Stable income, no risk of jail. A foundation while you build your empire.',
    tag:         'SOON',
  },
  {
    id:          'bank',
    icon:        'bank',
    name:        'BANK',
    description: 'Protect & grow your fortune',
    detail:      'Store cash safely, take loans, and invest. Money left on hand can be stolen — the bank keeps it safe.',
    tag:         'SOON',
  },
  {
    id:          'stocks',
    icon:        'stocks',
    name:        'STOCKS',
    description: 'Play the underground market',
    detail:      'Trade shares in black market companies. Prices shift based on player activity. Buy low, sell high, or get wrecked.',
    tag:         'SOON',
  },
  {
    id:          'exchange',
    icon:        'market',
    name:        'EXCHANGE',
    description: 'Open market — anything for a price',
    detail:      "The city's central marketplace. List items, place buy orders, and trade directly with other players in real time.",
    tag:         'SOON',
  },
  {
    id:          'back-alley',
    icon:        'black-market',
    name:        'BACK ALLEY',
    description: 'Trade contraband in the shadows',
    detail:      'Off-the-books player shops. Buy and sell stolen goods, illegal weapons, and rare items outside official markets.',
    tag:         'SOON',
  },
  {
    id:          'trade',
    icon:        'trade',
    name:        'TRADE',
    description: 'Direct player-to-player exchanges',
    detail:      'Secure one-on-one trades with other players. No middleman, no fees. Shake hands and seal the deal.',
    tag:         'SOON',
  },

  // ── UNDERWORLD ────────────────────────────────────────────
  {
    id:          'gangs',
    icon:        'gang',
    name:        'GANGS',
    description: 'Build loyalty, rule territory',
    detail:      'Create or join a gang. Pool resources, share profits, and wage war on rivals. The strongest gangs run the city.',
    tag:         'SOON',
  },
  {
    id:          'gang-war',
    icon:        'gang-wars',
    name:        'GANG WAR',
    description: 'Wage war for respect & turf',
    detail:      'Full gang-vs-gang warfare. Coordinate attacks, defend territory, and crush rivals until they surrender or disband.',
    tag:         'SOON',
  },
  {
    id:          'districts',
    icon:        'territory',
    name:        'DISTRICTS',
    description: 'Control city blocks, crush rivals',
    detail:      'Capture and hold districts to earn passive income and buffs. Lose them and your enemies profit. Territory is everything.',
    tag:         'SOON',
  },
  {
    id:          'forum',
    icon:        'forum',
    name:        'FORUM',
    description: 'Intel, deals & street talk',
    detail:      "The city's underground message board. Trade tips, negotiate deals, post propaganda, or expose your enemies.",
    tag:         'SOON',
  },
  {
    id:          'newspaper',
    icon:        'newspaper',
    name:        'NEWSPAPER',
    description: 'Underground news & hit reports',
    detail:      'Player-written news from across the city. Report attacks, expose scandals, and run smear campaigns against rivals.',
    tag:         'SOON',
  },
  {
    id:          'calendar',
    icon:        'calendar',
    name:        'CALENDAR',
    description: 'Track ops, cooldowns & events',
    detail:      'Never miss a cooldown, event, or faction operation. Your personal criminal schedule.',
    tag:         'SOON',
  },

  // ── WORLD ─────────────────────────────────────────────────
  {
    id:          'missions',
    icon:        'missions',
    name:        'MISSIONS',
    description: 'Take contracts, build reputation',
    detail:      'Daily and weekly contracts from city factions. Complete them for cash, XP, and rare items unavailable anywhere else.',
    tag:         'SOON',
  },
  {
    id:          'events',
    icon:        'events',
    name:        'EVENTS',
    description: 'City-wide chaos & competitions',
    detail:      'Limited-time events shake up the city. Compete in tournaments, survive sieges, and earn exclusive rewards.',
    tag:         'SOON',
  },
  {
    id:          'flying',
    icon:        'travel',
    name:        'FLYING',
    description: 'Move between cities for profit',
    detail:      'Travel to other cities to access exclusive crime tiers, cheaper markets, or to escape enemies on your trail.',
    tag:         'SOON',
  },
  {
    id:          'properties',
    icon:        'properties',
    name:        'PROPERTIES',
    description: 'Own the city block by block',
    detail:      'Buy houses, warehouses, and businesses. Properties generate passive income and unlock advanced game systems.',
    tag:         'SOON',
  },
  {
    id:          'casino',
    icon:        'casino',
    name:        'CASINO',
    description: 'High risk, high reward gambling',
    detail:      'Poker, blackjack, dice, and slots. Risk real in-game cash against the house or other players. Fortune favors the bold.',
    tag:         'SOON',
  },
  {
    id:          'education',
    icon:        'education',
    name:        'EDUCATION',
    description: 'Learn skills the streets respect',
    detail:      'Take courses to permanently boost your stats and unlock advanced game mechanics. Knowledge is power.',
    tag:         'SOON',
  },
];
