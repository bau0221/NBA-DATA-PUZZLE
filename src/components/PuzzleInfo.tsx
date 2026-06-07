import React from 'react';
import { Puzzle, StatCategory } from '../types';
import { formatCategory, formatMode } from '../utils/gameLogic';
import { Target, Users, BarChart2 } from 'lucide-react';

export function PuzzleInfo({ puzzle }: { puzzle: Puzzle }) {
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

  const getPositionText = (pos: string) => {
    switch (pos) {
      case 'Guard': return '後衛 (Guard)';
      case 'Forward': return '前鋒 (Forward)';
      case 'Center': return '中鋒 (Center)';
      default: return pos;
    }
  };

  const isPercent = puzzle.statCategory === 'FG_PCT' || puzzle.statCategory === 'FG3_PCT';

  return (
    <div className="bg-slate-800 rounded-3xl p-8 nba-gradient border border-slate-700 relative overflow-hidden">
      {/* Decorative Background Graphic */}
      <div className="absolute -right-10 -top-10 w-64 h-64 bg-orange-500 opacity-5 blur-[100px] rounded-full"></div>

      <div className="relative z-10">
        <h2 className="text-orange-500 font-bold tracking-wider text-sm mb-4 uppercase flex items-center gap-2">
          目前拼圖任務 
          {puzzle.hardModeCondition && <span className="bg-red-500 text-white px-2 py-0.5 rounded text-[10px]">HARD</span>}
        </h2>
        
        <div className="flex justify-between items-start flex-wrap gap-4">
          <div className="flex flex-col gap-2">
            <div className="px-4 py-1 bg-orange-500 text-white font-bold text-xs rounded-md uppercase tracking-widest inline-block float-left w-fit">
              {formatMode(puzzle.mode, puzzle.isActiveMode)} • {formatCategory(puzzle.statCategory)}
            </div>
            {puzzle.hardModeCondition && (
              <div className="px-4 py-1 bg-red-900 border border-red-500 text-red-200 font-bold text-xs rounded-md uppercase tracking-widest inline-block w-fit">
                限制位置: {getPositionText(puzzle.hardModeCondition)}
              </div>
            )}
          </div>
          <div className="text-right flex-grow">
            <p className="text-slate-400 text-xs font-bold uppercase mb-1">目標數值 (限定 {puzzle.numPlayers} 人)</p>
            <h2 className="text-5xl font-black text-white stat-font">
              {puzzle.targetValue.toLocaleString()} <span className="text-orange-500 text-3xl">{getUnit(puzzle.statCategory)}</span>
            </h2>
          </div>
        </div>

        <p className="text-slate-400 text-sm leading-relaxed border-t border-slate-700/50 pt-6 mt-6">
          請選擇 <span className="font-bold text-white">{puzzle.numPlayers} 名</span> {puzzle.hardModeCondition && <span className="text-red-400 font-bold">{getPositionText(puzzle.hardModeCondition)}</span>} 球員，讓他們的 
          <span className="text-orange-400 font-bold px-1">{formatCategory(puzzle.statCategory)}</span> 
          在 <span className="text-blue-400 font-bold px-1">{formatMode(puzzle.mode, puzzle.isActiveMode)}</span> 的{isPercent ? '平均值' : '加總'}，
          盡可能接近目標！
        </p>
      </div>
    </div>
  );
}
