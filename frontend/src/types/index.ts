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
  max_energy: number;
  nerve: number;
  max_nerve: number;
  life: number;
  max_life: number;
  happiness: number;
  status: string;
}

export interface AuthResponse {
  token: string;
  user: User;
  message: string;
}
