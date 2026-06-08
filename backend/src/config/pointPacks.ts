// ============================================================
// POINT PACKS CONFIG — UNDERCITY
// Stripe removed (Indian solo dev limitation).
// Lemon Squeezy integration coming in Phase 3 (Sept 2026).
// This file kept for import compatibility — just exports packs.
// ============================================================

export interface PointPack {
  id:          string;
  name:        string;
  points:      number;
  priceUsd:    number;
  description: string;
  popular?:    boolean;
}

export const POINT_PACKS: PointPack[] = [
  {
    id:          "pack_starter",
    name:        "Starter Pack",
    points:      500,
    priceUsd:    4.99,
    description: "500 points to get you started",
  },
  {
    id:          "pack_hustler",
    name:        "Hustler Pack",
    points:      1200,
    priceUsd:    9.99,
    description: "1,200 points — best value for new players",
    popular:     true,
  },
  {
    id:          "pack_gangster",
    name:        "Gangster Pack",
    points:      2800,
    priceUsd:    19.99,
    description: "2,800 points for serious players",
  },
  {
    id:          "pack_kingpin",
    name:        "Kingpin Pack",
    points:      6000,
    priceUsd:    39.99,
    description: "6,000 points — maximum value",
  },
];
