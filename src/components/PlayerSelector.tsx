import React, { useState, useMemo, useEffect } from 'react';
import { Search, X, Check, CheckCircle2, Loader2 } from 'lucide-react';
import { Player } from '../types';
import { PLAYERS } from '../data/players';
import { ACTIVE_PLAYERS } from '../data/activePlayers';
import axios from 'axios';

interface PlayerSelectorProps {
  maxPlayers: number;
  hardModeCondition?: string;
  isActiveMode?: boolean;
  onConfirm: (players: Player[]) => void;
}

export function PlayerSelector({ maxPlayers, hardModeCondition, isActiveMode, onConfirm }: PlayerSelectorProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPlayers, setSelectedPlayers] = useState<Player[]>([]);
  const [searchResults, setSearchResults] = useState<{name: string, id: string, url?: string}[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isFetchingPlayer, setIsFetchingPlayer] = useState<string | null>(null);

  // Default players fallback
  const defaultPlayers = useMemo(() => {
    return isActiveMode ? ACTIVE_PLAYERS : PLAYERS;
  }, [isActiveMode]);

  useEffect(() => {
    if (!searchTerm.trim()) {
      setSearchResults([]);
      return;
    }

    if (isActiveMode) {
      // Offline local search
      const matches = ACTIVE_PLAYERS.filter(p => p.player_name.toLowerCase().includes(searchTerm.toLowerCase())).slice(0, 20);
      setSearchResults(matches.map(p => ({
        name: p.player_name,
        id: p.id,
      })));
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await axios.get(`/api/search-player?name=${encodeURIComponent(searchTerm)}`);
        if (res.data.error) {
           console.error("Search API returned error:", res.data.error);
           setSearchResults([]);
        } else {
           setSearchResults(res.data);
        }
      } catch (err) {
        console.error("Search failed", err);
      } finally {
        setIsSearching(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [searchTerm, isActiveMode]);

  const togglePlayer = async (player: Player) => {
    if (selectedPlayers.find(p => p.id === player.id)) {
      setSelectedPlayers(selectedPlayers.filter(p => p.id !== player.id));
    } else {
      if (selectedPlayers.length < maxPlayers) {
        if (hardModeCondition && player.position && !player.position.includes(hardModeCondition)) {
           alert(`困難模式限制：必須選擇 ${hardModeCondition} 位置的球員！該球員位置為 ${player.position}`);
           return;
        }
        setSelectedPlayers([...selectedPlayers, player]);
      }
    }
  };

  const handleSelectSearchedPlayer = async (result: {name: string, id: string}) => {
    // Check if already selected
    if (selectedPlayers.find(p => p.id === result.id)) {
      setSelectedPlayers(selectedPlayers.filter(p => p.id !== result.id));
      return;
    }
    
    if (selectedPlayers.length >= maxPlayers) return;

    // Check if we already have this player in the static list
    const pool = isActiveMode ? ACTIVE_PLAYERS : PLAYERS;
    const existing = pool.find(p => p.id === result.id);
    if (existing) {
      if (hardModeCondition && existing.position && !existing.position.includes(hardModeCondition)) {
        alert(`困難模式限制：必須選擇 ${hardModeCondition} 位置的球員！`);
        return;
      }
      setSelectedPlayers([...selectedPlayers, existing]);
      return;
    }

    // Otherwise fetch stats
    setIsFetchingPlayer(result.id);
    try {
      const resp = await axios.get(`/api/player-stats?id=${result.id}`);
      if (resp.data.error) {
         alert(resp.data.error);
         return;
      }
      const playerData: Player = resp.data;
      if (hardModeCondition && playerData.position && !playerData.position.includes(hardModeCondition)) {
        alert(`困難模式限制：必須選擇 ${hardModeCondition} 位置的球員！該球員位置為 ${playerData.position}`);
        return;
      }
      setSelectedPlayers([...selectedPlayers, playerData]);
      // Optionally add them to local PLAYERS cache if needed, but keeping it in selectedPlayers is fine
    } catch (err: any) {
      alert(err.response?.data?.error || "Failed to load player stats");
      console.error(err);
    } finally {
      setIsFetchingPlayer(null);
    }
  };

  const displayList = searchResults;

  return (
    <div className="w-full flex flex-col gap-6">
      {/* Selected Slots */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
        {Array.from({ length: maxPlayers }).map((_, i) => {
          const p = selectedPlayers[i];
          return (
            <div 
              key={i} 
              className={`flex items-center justify-center p-4 border-2 rounded-2xl h-28 text-center transition-all ${
                p ? 'border-orange-500 bg-slate-900/80 orange-glow' : 'border-dashed border-slate-600 bg-slate-900/50 text-slate-500'
              }`}
            >
              {p ? (
                <div className="relative w-full h-full flex flex-col items-center justify-center gap-1">
                  <div className="text-sm font-black whitespace-normal leading-tight uppercase line-clamp-2 w-full text-white">{p.player_name}</div>
                  <button 
                    onClick={() => togglePlayer(p)}
                    className="absolute -top-6 -right-6 w-6 h-6 flex items-center justify-center bg-red-500 rounded-full text-xs text-white hover:bg-red-600"
                  >
                    ×
                  </button>
                </div>
              ) : (
                 <div className="flex flex-col items-center gap-2">
                   <div className="w-10 h-10 bg-slate-800 rounded-full flex items-center justify-center text-xl text-slate-500">+</div>
                   <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Slot {i + 1}</p>
                 </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Search & List */}
      <div className="flex flex-col gap-3 bg-slate-800 p-6 rounded-3xl border border-slate-700 mt-4">
        <div className="relative">
          <Search className="absolute left-3 top-3 text-slate-400" size={20} />
          <input 
            type="text"
            placeholder="搜尋 NBA 球員..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full bg-slate-900 pl-10 pr-4 py-3 border border-slate-700 rounded-xl focus:outline-none focus:border-orange-500 text-white placeholder-slate-500 transition-all font-medium"
          />
        </div>

        {searchTerm.trim() && (
          <div className="h-64 overflow-y-auto pr-2 grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 custom-scrollbar">
            {isSearching && (
              <div className="col-span-full flex justify-center py-8 text-slate-500">
                 <Loader2 className="animate-spin" size={24} />
                 <span className="ml-2 font-bold uppercase tracking-widest text-xs">Searching...</span>
              </div>
            )}
            {!isSearching && displayList.length === 0 && (
              <div className="col-span-full text-center py-8 text-slate-500 font-bold uppercase tracking-widest text-xs">找不到球員</div>
            )}
            {!isSearching && displayList.map(p => {
               // Handle both static Player objects and dynamic search results
              const pid = p.id;
              const playerName = 'player_name' in p ? p.player_name : p.name;
              const isSelected = selectedPlayers.find(sp => sp.id === pid);
              const isFetching = isFetchingPlayer === pid;

              return (
                <button
                  key={pid}
                  onClick={() => {
                     if ('player_name' in p) {
                       togglePlayer(p);
                     } else {
                       handleSelectSearchedPlayer(p as any);
                     }
                  }}
                  disabled={isFetching}
                  className={`player-card flex items-center justify-between p-4 rounded-xl border transition-all text-left overflow-hidden ${
                    isSelected 
                      ? 'border-orange-500 bg-slate-900 orange-glow opacity-50' 
                      : 'border-slate-700 bg-slate-900 hover:border-orange-500'
                  } ${isFetching ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <div className="flex flex-col">
                    <span className="text-xs font-black uppercase tracking-tight text-white">{playerName}</span>
                  </div>
                  {isFetching && <Loader2 className="animate-spin text-slate-400 flex-shrink-0" size={16} />}
                  {!isFetching && isSelected && <CheckCircle2 className="text-orange-500 flex-shrink-0" size={16} />}
                </button>
              )
            })}
          </div>
        )}
      </div>

      <button
        disabled={selectedPlayers.length !== maxPlayers}
        onClick={() => onConfirm(selectedPlayers)}
        className={`w-full py-6 rounded-2xl font-black text-xl uppercase tracking-widest transition-all mt-4 ${
          selectedPlayers.length === maxPlayers 
            ? 'bg-orange-500 hover:bg-orange-600 text-white orange-glow active:scale-[0.98]'
            : 'bg-slate-700 text-slate-500 cursor-not-allowed opacity-50'
        }`}
      >
        Lock In Selection
      </button>
    </div>
  );
}
