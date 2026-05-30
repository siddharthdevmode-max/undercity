export interface NewsItem {
  id: string;
  icon: string;
  title: string;
  date: string;
}

export interface RoadmapItem {
  id: string;
  status: 'done' | 'in-progress' | 'planned';
  version: string;
  title: string;
}

export const NEWS_ITEMS: NewsItem[] = [
  { id: 'n1', icon: '🚧', title: 'First public launch — coming soon', date: 'TBA' },
  { id: 'n2', icon: '🚧', title: 'Closed beta in progress', date: 'TBA' },
  { id: 'n3', icon: '🚧', title: 'Faction war system in development', date: 'TBA' },
  { id: 'n4', icon: '🚧', title: 'Black market & bazaar mechanics being polished', date: 'TBA' },
  { id: 'n5', icon: '🚧', title: 'Bounties & territory wars in design phase', date: 'TBA' },
];

export const ROADMAP_ITEMS: RoadmapItem[] = [
  { id: 'r1', status: 'done',        version: 'v0.1', title: 'Authentication system' },
  { id: 'r2', status: 'done',        version: 'v0.2', title: 'Landing page complete' },
  { id: 'r3', status: 'in-progress', version: 'v0.3', title: 'Gym + first crimes' },
  { id: 'r4', status: 'planned',     version: 'v0.4', title: 'Faction system' },
  { id: 'r5', status: 'planned',     version: 'v0.5', title: 'Public launch' },
];
