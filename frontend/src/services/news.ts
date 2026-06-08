export interface NewsItem {
  id:    string;
  icon:  string;
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
  {
    id:    'n1',
    icon:  'news-crime',
    title: 'Crime system live — 25 crimes, 5 tiers, 100 levels each',
    date:  'Jun 2026',
  },
  {
    id:    'n2',
    icon:  'news-shield',
    title: 'UAC 2.0 anti-cheat deployed — fingerprint + behavior analysis',
    date:  'Jun 2026',
  },
  {
    id:    'n3',
    icon:  'lock',
    title: 'GDPR compliance complete — full global legal framework',
    date:  'Jun 2026',
  },
  {
    id:    'n4',
    icon:  'check-circle',
    title: 'Backend sealed — 122/122 tests passing, 0 lint errors',
    date:  'Jun 2026',
  },
  {
    id:    'n5',
    icon:  'construction',
    title: 'Gym + jobs entering development — Wave 2 begins',
    date:  'Coming',
  },
  {
    id:    'n6',
    icon:  'gang-wars',
    title: 'Gang wars system — architecture designed, dev starts Aug 2026',
    date:  'Coming',
  },
];

export const ROADMAP_ITEMS: RoadmapItem[] = [
  { id: 'r1', status: 'done',        version: 'v0.1', title: 'Auth, onboarding & legal framework'   },
  { id: 'r2', status: 'done',        version: 'v0.2', title: 'Crime engine + UAC 2.0 anti-cheat'    },
  { id: 'r3', status: 'done',        version: 'v0.3', title: 'Full stack integration + WebSockets'  },
  { id: 'r4', status: 'in-progress', version: 'v0.4', title: 'Gym, jobs, item market & properties'  },
  { id: 'r5', status: 'planned',     version: 'v0.5', title: 'Gangs, districts & PvP combat'        },
  { id: 'r6', status: 'planned',     version: 'v0.6', title: 'Casino, back alley & exchange'        },
  { id: 'r7', status: 'planned',     version: 'v0.7', title: 'Missions, events & newspaper'         },
  { id: 'r8', status: 'planned',     version: 'v1.0', title: 'Public launch — Dec 15, 2026'         },
];
