export interface NewsItem {
  id:    string;
  icon:  string;   // SVG icon name
  title: string;
  date:  string;
}

export interface RoadmapItem {
  id:      string;
  status:  'done' | 'in-progress' | 'planned';
  version: string;
  title:   string;
}

export const NEWS_ITEMS: NewsItem[] = [
  { id: 'n1', icon: 'news-crime',  title: 'Crime system live — 5 tiers, 100 levels per crime', date: 'Season 1' },
  { id: 'n2', icon: 'news-shield', title: 'UAC 2.0 anti-cheat deployed — 4-pillar detection',  date: 'Season 1' },
  { id: 'n3', icon: 'lock',        title: 'GDPR compliance complete — full legal framework',    date: 'Season 1' },
  { id: 'n4', icon: 'gang-wars',   title: 'Gang wars system — entering development',            date: 'Coming'   },
  { id: 'n5', icon: 'gym',         title: 'Gym & stat training — entering development',         date: 'Coming'   },
];

export const ROADMAP_ITEMS: RoadmapItem[] = [
  { id: 'r1', status: 'done',        version: 'v0.1', title: 'Auth + onboarding system'   },
  { id: 'r2', status: 'done',        version: 'v0.2', title: 'Landing + legal framework'  },
  { id: 'r3', status: 'done',        version: 'v0.3', title: 'Crime engine + UAC 2.0'     },
  { id: 'r4', status: 'in-progress', version: 'v0.4', title: 'Gym + jobs + item market'   },
  { id: 'r5', status: 'planned',     version: 'v0.5', title: 'Gangs + territory + PvP'    },
  { id: 'r6', status: 'planned',     version: 'v1.0', title: 'Public launch'              },
];
