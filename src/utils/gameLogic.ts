import { GameMode, Player, Puzzle, StatCategory } from '../types';
import { PLAYERS } from '../data/players';
import { ACTIVE_PLAYERS } from '../data/activePlayers';

export const STAT_CATEGORIES: StatCategory[] = ['PTS', 'REB', 'AST', 'STL', 'BLK', 'FG_PCT', 'FG3_PCT'];
export const GAME_MODES: GameMode[] = ['career_total', 'career_average', 'peak_season'];

// Map category to friendly string
export function formatCategory(cat: StatCategory): string {
  switch (cat) {
    case 'PTS': return '得分 (PTS)';
    case 'REB': return '籃板 (REB)';
    case 'AST': return '助攻 (AST)';
    case 'STL': return '抄截 (STL)';
    case 'BLK': return '阻攻 (BLK)';
    case 'FG_PCT': return '投籃命中率 (FG%)';
    case 'FG3_PCT': return '三分命中率 (3P%)';
  }
}

// Map mode to friendly string considering Active Mode
export function formatMode(mode: GameMode, isActiveMode?: boolean): string {
  if (isActiveMode) {
    switch (mode) {
      case 'career_total': return '本季(2025-26)總計 (Season Totals)';
      case 'career_average': return '本季(2025-26)場均 (Season Average)';
      case 'peak_season': return '本季(2025-26)場均 (Season Average)';
    }
  }
  switch (mode) {
    case 'career_total': return '生涯總和 (Career Totals)';
    case 'career_average': return '生涯場均 (Career Average)';
    case 'peak_season': return '巔峰賽季 (Peak Season)';
  }
}

// Get a specific stat for a player
export function getPlayerStat(player: Player, category: StatCategory, mode: GameMode): number {
  return player.data[category][mode];
}

// Calculate the total for an array of players
export function calculateTotal(players: Player[], category: StatCategory, mode: GameMode): number {
  if (players.length === 0) return 0;
  
  const sum = players.reduce((s, p) => s + getPlayerStat(p, category, mode), 0);
  // If it's a percentage stat, return the average of the percentages
  if (category === 'FG_PCT' || category === 'FG3_PCT') {
    return sum / players.length;
  }
  return sum;
}

// Score formula: 100 - (|total - target| / target) * 100
export function calculateScore(total: number, target: number): number {
  if (target === 0) return 0;
  const errorPercent = (Math.abs(total - target) / target) * 100;
  return Math.max(0, Math.round((100 - errorPercent) * 10) / 10); // keep 1 decimal
}

// Shuffles an array (Fisher-Yates)
function shuffle<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Generate a random puzzle
export function generatePuzzle(isHardMode: boolean = false, isActiveMode: boolean = false): Puzzle {
  const statCategory = STAT_CATEGORIES[Math.floor(Math.random() * STAT_CATEGORIES.length)];
  
  // Percentages shouldn't use "career_total"
  let availableModes = [...GAME_MODES];
  if (isActiveMode) {
     availableModes = ['career_total', 'career_average'];
  }
  if (statCategory === 'FG_PCT' || statCategory === 'FG3_PCT') {
    availableModes = ['career_average'];
  }
  const mode = availableModes[Math.floor(Math.random() * availableModes.length)];

  const numPlayers = Math.floor(Math.random() * 3) + 3; // 3 to 5 players
  
  // Optional Hard Mode position restriction
  let hardModeCondition: string | undefined;
  if (isHardMode) {
      const positions = ['Guard', 'Forward', 'Center'];
      hardModeCondition = positions[Math.floor(Math.random() * positions.length)];
  }

  // Step 1: Pick a random group of players as the "base" target
  let basePool = isActiveMode ? ACTIVE_PLAYERS : PLAYERS;
  let pool = basePool;
  if (hardModeCondition) {
      pool = basePool.filter(p => p.position && p.position.includes(hardModeCondition!));
      if (pool.length < numPlayers) {
          pool = basePool;
          hardModeCondition = undefined; // clear condition if we don't have enough players
      }
  }
  const randomPlayers = shuffle(pool).slice(0, numPlayers);
  const baseTarget = calculateTotal(randomPlayers, statCategory, mode);

  // Step 2: Add fuzz factor (-15% to +15%) for more diverse numbers
  const fuzz = 1 + (Math.random() * 0.30 - 0.15);
  let targetValue = baseTarget * fuzz;

  // Round according to mode & category
  if (mode === 'career_total') {
    targetValue = Math.round(targetValue);
  } else {
    // Keep 1 decimal
    targetValue = Math.round(targetValue * 10) / 10;
  }

  return {
    mode,
    statCategory,
    numPlayers,
    targetValue,
    hardModeCondition,
    isActiveMode
  };
}

// AI: CPU randomly selects players and tries a few combos, picking a decent one
export function getCPUSelection(puzzle: Puzzle): Player[] {
  let bestSelection: Player[] = [];
  let bestScore = -1;
  const pool = puzzle.isActiveMode ? ACTIVE_PLAYERS : PLAYERS;

  // CPU simulates 20 random combos and picks the best one (so it's not perfect but decent)
  for (let i = 0; i < 20; i++) {
    let subPool = pool;
    if (puzzle.hardModeCondition) {
        subPool = pool.filter(p => p.position && p.position.includes(puzzle.hardModeCondition!));
        if (subPool.length < puzzle.numPlayers) subPool = pool;
    }
    const combo = shuffle(subPool).slice(0, puzzle.numPlayers);
    const total = calculateTotal(combo, puzzle.statCategory, puzzle.mode);
    const score = calculateScore(total, puzzle.targetValue);
    
    // Add artificial handicap based on mode/players to simulate human error occasionally
    const randomizedScore = score * (0.85 + Math.random() * 0.15); 
    
    if (randomizedScore > bestScore) {
      bestScore = randomizedScore;
      bestSelection = combo;
    }
  }

  return bestSelection;
}

