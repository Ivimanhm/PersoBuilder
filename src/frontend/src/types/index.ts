export type Role = "top" | "jungle" | "mid" | "adc" | "support";
export type GenerationMode = "roles" | "random";
export type TeamCount = 1 | 2;

export interface Champion {
  id: number;
  name: string;
  roles: Role[];
  image: string;
}

export interface TeamMember {
  champion: Champion;
  role?: Role;
}

export interface GeneratedTeams {
  blue: TeamMember[];
  red: TeamMember[];
}
