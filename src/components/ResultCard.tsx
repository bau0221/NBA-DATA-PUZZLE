import React from 'react';
import { Player, Puzzle, StatCategory } from '../types';
import { getPlayerStat } from '../utils/gameLogic';

interface PlayerListProps {
  label: string;
  players: Player[];
  puzzle: Puzzle;
  total: number;
  score: number;
  isWinner: boolean;
  isTie: boolean;
}

export function ResultCard({ label, players, puzzle, total, score, isWinner, isTie }: PlayerListProps) {
  const getUnit = (category: StatCategory) => {
    switch (category) {
      case 'PTS': return '分';
      case 'REB': return '個';
      case 'AST': return '次';
      case 'STL': return '次';
      case 'BLK': return '次';
      case 'FG_PCT': return '%';
      case 'FG3_PCT': return '%';
    }
  };

  const diff = total - puzzle.targetValue;
  const isOver = diff > 0;
  const isPercent = puzzle.statCategory === 'FG_PCT' || puzzle.statCategory === 'FG3_PCT';

  return (
    <div className={`p-8 rounded-3xl border transition-all ${
      isWinner ? 'border-orange-500 bg-slate-800 nba-gradient orange-glow' : isTie ? 'border-blue-500 bg-slate-800 nba-gradient' : 'border-slate-700 bg-slate-900 opacity-80'
    }`}>
      <div className="flex justify-between items-end mb-6 border-b border-slate-700 pb-4">
        <div>
          <h3 className="text-xl font-black uppercase tracking-tight text-white mb-2">{label}</h3>
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400">
            Selected {isPercent ? 'Average' : 'Sum'}: <span className="text-white text-lg stat-font block mt-1">{total.toLocaleString()} <span className="text-[10px]">{getUnit(puzzle.statCategory)}</span></span>
          </p>
          <div className="mt-2 text-xs font-bold">
            <span className={`px-2 py-1 rounded inline-block ${isOver ? 'bg-red-500/20 text-red-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
              Distance: {isOver ? '+' : ''}{diff.toFixed(1)}
            </span>
          </div>
        </div>
        <div className="text-right flex flex-col items-end justify-end h-full">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Accuracy Rating</p>
          <div className={`text-5xl font-black stat-font ${isWinner ? 'text-orange-500' : isTie ? 'text-blue-400' : 'text-slate-500'}`}>
            {score}
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {players.length === 0 ? (
          <div className="px-4 py-8 bg-slate-900/50 rounded-xl border border-red-500/30 text-center">
            <span className="text-red-500 font-bold uppercase tracking-widest text-sm animate-pulse">逾時未交卷</span>
          </div>
        ) : (
          players.map(p => {
            const val = getPlayerStat(p, puzzle.statCategory, puzzle.mode);
            return (
              <div key={p.id} className="flex justify-between items-center px-4 py-3 bg-slate-900/50 rounded-xl border border-slate-700">
                <span className="text-sm font-black uppercase text-white tracking-tight">{p.player_name}</span>
                <span className="font-black text-orange-400 stat-font">{val.toLocaleString()}</span>
              </div>
            )
          })
        )}
      </div>
    </div>
  );
}
