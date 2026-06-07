export type StatCategory = 'PTS' | 'REB' | 'AST' | 'STL' | 'BLK' | 'FG_PCT' | 'FG3_PCT';
export type GameMode = 'career_total' | 'career_average' | 'peak_season';

export interface PlayerStats {
  career_total: number;
  career_average: number;
  peak_season: number;
}

export interface Player {
  id: string;
  player_name: string;
  position?: string;
  data: {
    PTS: PlayerStats;
    REB: PlayerStats;
    AST: PlayerStats;
    STL: PlayerStats;
    BLK: PlayerStats;
    FG_PCT: PlayerStats;
    FG3_PCT: PlayerStats;
  };
  image_url?: string;
}

export interface Puzzle {
  mode: GameMode;
  statCategory: StatCategory;
  numPlayers: number;
  targetValue: number;
  hardModeCondition?: string; // e.g. 'Guard', 'Forward', 'Center'
  isActiveMode?: boolean;
}

export interface PlayerSelection {
  playerId: string;
}

export interface RoundResult {
  p1Selection: Player[];
  p2Selection: Player[];
  p1Total: number;
  p2Total: number;
  p1Score: number;
  p2Score: number;
  target: number;
}
