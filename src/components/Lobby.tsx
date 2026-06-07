import React, { useState, useEffect } from 'react';
import { socket } from '../lib/socket';

interface LobbyProps {
  onJoinSuccess: (roomId: string, isHost: boolean) => void;
  onBack: () => void;
}

export function Lobby({ onJoinSuccess, onBack }: LobbyProps) {
  const [mode, setMode] = useState<'SELECT' | 'CREATE' | 'JOIN'>('SELECT');
  const [roomName, setRoomName] = useState('');
  const [roomId, setRoomId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const handleCreate = () => {
    setError('');
    setIsProcessing(true);
    socket.emit('create_room', { name: roomName || '我的房間', password }, (response: any) => {
      setIsProcessing(false);
      if (response.success) {
        onJoinSuccess(response.roomId, true);
      } else {
        setError(response.error);
      }
    });
  };

  const handleJoin = () => {
    setError('');
    setIsProcessing(true);
    socket.emit('join_room', { roomId: roomId.toUpperCase(), password }, (response: any) => {
      setIsProcessing(false);
      if (response.success) {
        onJoinSuccess(roomId.toUpperCase(), false);
      } else {
        setError(response.error);
      }
    });
  };

  return (
    <div className="max-w-md mx-auto w-full">
      <div className="bg-slate-800 border border-slate-700 p-8 rounded-3xl">
        <h2 className="text-2xl font-black text-white text-center mb-8 uppercase tracking-widest">
          {mode === 'SELECT' ? '遠端對戰設定' : mode === 'CREATE' ? '創建房間' : '加入房間'}
        </h2>

        {error && (
          <div className="bg-red-500/20 border border-red-500/50 text-red-400 p-3 rounded-lg text-sm font-bold mb-6 text-center">
            {error}
          </div>
        )}

        {mode === 'SELECT' && (
          <div className="flex flex-col gap-4">
            <button 
              onClick={() => setMode('CREATE')}
              className="w-full py-4 bg-orange-600 hover:bg-orange-500 text-white font-black rounded-2xl transition-colors uppercase tracking-widest"
            >
              創建新房間 (當房主)
            </button>
            <button 
              onClick={() => setMode('JOIN')}
              className="w-full py-4 bg-slate-700 hover:bg-slate-600 text-white font-black rounded-2xl transition-colors uppercase tracking-widest"
            >
              加入房間 (當挑戰者)
            </button>
          </div>
        )}

        {mode === 'CREATE' && (
          <div className="flex flex-col gap-4">
            <div>
              <label className="block text-slate-400 text-xs font-bold mb-2 uppercase tracking-widest">房間名稱 (選填)</label>
              <input 
                type="text" 
                value={roomName}
                onChange={(e) => setRoomName(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-orange-500"
                placeholder="我的房間"
              />
            </div>
            <div>
              <label className="block text-slate-400 text-xs font-bold mb-2 uppercase tracking-widest">房間密碼 (選填)</label>
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-orange-500"
                placeholder="設定密碼"
              />
            </div>
            <button 
              onClick={handleCreate}
              disabled={isProcessing}
              className="w-full mt-4 py-4 bg-orange-600 hover:bg-orange-500 text-white font-black rounded-2xl transition-colors uppercase tracking-widest disabled:opacity-50"
            >
              {isProcessing ? '處理中...' : '建立房間'}
            </button>
          </div>
        )}

        {mode === 'JOIN' && (
          <div className="flex flex-col gap-4">
            <div>
              <label className="block text-slate-400 text-xs font-bold mb-2 uppercase tracking-widest">房間 ID (必填)</label>
              <input 
                type="text" 
                value={roomId}
                onChange={(e) => setRoomId(e.target.value.toUpperCase())}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-orange-500 uppercase"
                placeholder="輸入 6 碼 ID"
              />
            </div>
            <div>
              <label className="block text-slate-400 text-xs font-bold mb-2 uppercase tracking-widest">房間密碼 (若有設定)</label>
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-orange-500"
                placeholder="輸入密碼"
              />
            </div>
            <button 
              onClick={handleJoin}
              disabled={isProcessing || !roomId.trim()}
              className="w-full mt-4 py-4 bg-orange-600 hover:bg-orange-500 text-white font-black rounded-2xl transition-colors uppercase tracking-widest disabled:opacity-50"
            >
              {isProcessing ? '處理中...' : '加入房間'}
            </button>
          </div>
        )}

        <button 
          onClick={() => mode === 'SELECT' ? onBack() : setMode('SELECT')}
          className="w-full mt-4 py-3 text-slate-400 font-bold hover:text-white transition-colors"
        >
          返回
        </button>
      </div>
    </div>
  );
}
