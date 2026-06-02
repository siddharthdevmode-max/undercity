export interface User {
  id: number;
  username: string;
  email: string;
  level: number;
  money: number;
  experience: number;
  points: number;
  strength: number;
  defense: number;
  speed: number;
  dexterity: number;
  energy: number;
  maxEnergy: number;
  nerve: number;
  maxNerve: number;
  life: number;
  maxLife: number;
  happiness: number;
  status: string;
}

export interface AuthResponse {
  token: string;
  user: User;
  message: string;
}
