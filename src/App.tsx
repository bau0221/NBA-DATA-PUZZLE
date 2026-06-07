import React, { useState, useEffect, useRef } from 'react';
import { Player, Puzzle } from './types';
import { generatePuzzle, calculateTotal, calculateScore } from './utils/gameLogic';
import { PuzzleInfo } from './components/PuzzleInfo';
import { PlayerSelector } from './components/PlayerSelector';
import { ResultCard } from './components/ResultCard';
import { Lobby } from './components/Lobby';
import { socket } from './lib/socket';
import { Trophy, ShieldAlert, Zap, Repeat, Play, User, Bot, Users, Share2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

type GameState = 'WELCOME' | 'LOBBY' | 'WAITING_ROOM' | 'P1_TURN' | 'WAITING_FOR_OPPONENT' | 'ROUND_RESULT' | 'FINAL_RESULT';
type Opponent = 'SOLO' | 'FRIEND_ONLINE';

const MAX_ROUNDS = 3;

export default function App() {
  const [gameState, setGameState] = useState<GameState>('WELCOME');
  const [opponent, setOpponent] = useState<Opponent>('SOLO');
  const [roundNum, setRoundNum] = useState(1);
  const [scores, setScores] = useState({ p1: 0, p2: 0 });
  
  const [currentPuzzle, setCurrentPuzzle] = useState<Puzzle | null>(null);
  const [p1Selection, setP1Selection] = useState<Player[]>([]);
  const [p2Selection, setP2Selection] = useState<Player[]>([]);
  const [isHardMode, setIsHardMode] = useState(false);
  const [isActiveMode, setIsActiveMode] = useState(false);

  // Multiplayer states
  const [roomId, setRoomId] = useState<string | null>(null);
  const [isHost, setIsHost] = useState(false);
  const [opponentReady, setOpponentReady] = useState(false);
  const [opponentSelection, setOpponentSelection] = useState<Player[]>([]);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [timeoutDuration, setTimeoutDuration] = useState<number>(10);

  const hasJoinedRoom = useRef(false);

  useEffect(() => {
    if (opponent === 'FRIEND_ONLINE' && gameState === 'P1_TURN' && opponentReady) {
      setTimeLeft(timeoutDuration);
    } else {
      setTimeLeft(null);
    }
  }, [opponent, gameState, opponentReady, timeoutDuration]);

  useEffect(() => {
    if (timeLeft === null) return;
    
    if (timeLeft === 0) {
      handleP1Confirm([]);
      return;
    }

    const timer = setTimeout(() => {
      setTimeLeft(timeLeft - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [timeLeft]);

  useEffect(() => {
    const handleConnect = () => {
      if (opponent === 'FRIEND_ONLINE' && roomId) {
        socket.emit('rejoin_room', { roomId, isHost });
      }
    };

    const handleDisconnect = () => {
      console.log('與伺服器的連線暫時中斷，正在嘗試重新連線...');
    };

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    
    socket.on('player_joined', (data) => {
      if (isHost && data.playerCount === 2) {
        // start game
        const puzzle = generatePuzzle(isHardMode, isActiveMode);
        setCurrentPuzzle(puzzle);
        socket.emit('game_event', { type: 'PUZZLE_SYNC', roomId, puzzle, timeoutDuration });
        setGameState('P1_TURN');
      }
    });

    socket.on('game_event', (data) => {
      if (data.type === 'PUZZLE_SYNC') {
        setCurrentPuzzle(data.puzzle);
        if (data.timeoutDuration) setTimeoutDuration(data.timeoutDuration);
        setGameState('P1_TURN');
      } else if (data.type === 'PLAYER_READY') {
        setOpponentReady(true);
        setOpponentSelection(data.selection);
      } else if (data.type === 'NEXT_ROUND') {
        setCurrentPuzzle(data.puzzle);
        if (data.timeoutDuration) setTimeoutDuration(data.timeoutDuration);
        setP1Selection([]);
        setOpponentSelection([]);
        setOpponentReady(false);
        setRoundNum(data.roundNum);
        setGameState('P1_TURN');
      } else if (data.type === 'PLAY_AGAIN') {
        resetGame();
        setOpponentReady(false);
        setOpponentSelection([]);
        
        if (isHost) {
          const puzzle = generatePuzzle(isHardMode, isActiveMode);
          setCurrentPuzzle(puzzle);
          socket.emit('game_event', { type: 'PUZZLE_SYNC', roomId, puzzle, timeoutDuration });
          setGameState('P1_TURN');
        }
      }
    });

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('player_joined');
      socket.off('game_event');
    };
  }, [isHost, roomId, gameState, opponent]);

  // Handle local player confirming their selection
  // It could be P1 or P2 depending on who we are in the remote sense
  // Wait, I actually need to make sure both players resolve correctly.


  const startGame = (opp: Opponent) => {
    setOpponent(opp);
    setScores({ p1: 0, p2: 0 });
    setRoundNum(1);
    
    if (opp === 'SOLO') {
      startNewRound();
    } else {
      setGameState('LOBBY');
    }
  };

  const startNewRound = () => {
    setCurrentPuzzle(generatePuzzle(isHardMode, isActiveMode));
    setP1Selection([]);
    setP2Selection([]);
    setOpponentSelection([]);
    setOpponentReady(false);
    setGameState('P1_TURN');
  };

  const handleP1Confirm = (players: Player[]) => {
    // If we are Host or SOLO, we are conceptually P1. If Guest, P2.
    if (opponent === 'SOLO') {
      setP1Selection(players);
      handleRoundEnd(players, []);
    } else {
      if (isHost) {
        setP1Selection(players);
      } else {
        setP2Selection(players);
      }

      socket.emit('game_event', { type: 'PLAYER_READY', roomId, selection: players });
      
      if (opponentReady) {
        // We know opponent's selection, and we know our own selection.
        // We need to pass them to handleRoundEnd(p1, p2)
        if (isHost) {
           handleRoundEnd(players, opponentSelection);
        } else {
           handleRoundEnd(opponentSelection, players);
        }
      } else {
        setGameState('WAITING_FOR_OPPONENT');
      }
    }
  };

  useEffect(() => {
    if (gameState === 'WAITING_FOR_OPPONENT' && opponentReady) {
       if (isHost) {
         handleRoundEnd(p1Selection, opponentSelection);
       } else {
         handleRoundEnd(opponentSelection, p2Selection);
       }
    }
  }, [opponentReady, gameState]);

  const handleRoundEnd = (p1List: Player[], p2List: Player[]) => {
    const p1Total = calculateTotal(p1List, currentPuzzle!.statCategory, currentPuzzle!.mode);
    const p1RoundScore = calculateScore(p1Total, currentPuzzle!.targetValue);

    let p2RoundScore = 0;
    if (opponent === 'FRIEND_ONLINE') {
      const p2Total = calculateTotal(p2List, currentPuzzle!.statCategory, currentPuzzle!.mode);
      p2RoundScore = calculateScore(p2Total, currentPuzzle!.targetValue);
      // Ensure opponent selection is saved for display
      if (isHost) {
         setP2Selection(p2List);
      } else {
         setP1Selection(p1List);
      }
    }

    setScores(prev => ({
      p1: prev.p1 + p1RoundScore,
      p2: prev.p2 + p2RoundScore
    }));
    
    setGameState('ROUND_RESULT');
  };

  const handleNextRound = () => {
    if (roundNum >= MAX_ROUNDS) {
      setGameState('FINAL_RESULT');
    } else {
      if (opponent === 'SOLO') {
        setRoundNum(prev => prev + 1);
        startNewRound();
      } else if (isHost) {
        const nextRound = roundNum + 1;
        const puzzle = generatePuzzle(isHardMode, isActiveMode);
        setRoundNum(nextRound);
        setCurrentPuzzle(puzzle);
        setP1Selection([]);
        setOpponentSelection([]);
        setOpponentReady(false);
        setGameState('P1_TURN');
        socket.emit('game_event', { type: 'NEXT_ROUND', roomId, roundNum: nextRound, puzzle, timeoutDuration });
      } else {
        setGameState('WAITING_FOR_OPPONENT');
      }
    }
  };

  const resetGame = () => {
    setScores({ p1: 0, p2: 0 });
    setRoundNum(1);
    setP1Selection([]);
    setOpponentSelection([]);
  }

  const returnHome = () => {
    setGameState('WELCOME');
    if (roomId) {
       // Optional: disconnect or leave room
       // socket.emit('leave_room', {roomId});
       setRoomId(null);
       setIsHost(false);
    }
  };

  const handleJoinLobby = (id: string, host: boolean) => {
     setRoomId(id);
     setIsHost(host);

     if (host) {
       setGameState('WAITING_ROOM');
     } else {
       // we just joined, other player (host) will be notified and start game
       setGameState('WAITING_ROOM');
     }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white font-sans selection:bg-orange-500/30">
      <header className="bg-slate-900 border-b border-slate-700 sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4 cursor-pointer" onClick={returnHome}>
            <div className="w-10 h-10 bg-orange-500 rounded-full flex items-center justify-center font-bold text-xl text-white">
              🏀
            </div>
            <h1 className="text-2xl font-black tracking-tighter">NBA DATA <span className="text-orange-500">PUZZLE</span></h1>
          </div>
          {gameState !== 'WELCOME' && (
            <div className="flex items-center gap-6 font-bold text-sm uppercase tracking-widest">
              <div className="hidden sm:block text-slate-400">
                Round {Math.min(roundNum, MAX_ROUNDS)} / {MAX_ROUNDS}
              </div>
              <div className="flex items-center gap-4 bg-slate-800 border border-slate-700 px-4 py-2 rounded-full text-xs">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span className="text-orange-500">{opponent === 'SOLO' ? '得分' : '你'}: {opponent === 'SOLO' || isHost ? scores.p1.toFixed(1) : scores.p2.toFixed(1)}</span>
                {opponent === 'FRIEND_ONLINE' && (
                  <>
                    <span className="text-slate-600">|</span>
                    <span className="text-emerald-400">
                      對手: {isHost ? scores.p2.toFixed(1) : scores.p1.toFixed(1)}
                    </span>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8 pb-32">
        <AnimatePresence mode="wait">
          
          {gameState === 'WELCOME' && (
            <motion.div 
              key="welcome"
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
              className="max-w-2xl mx-auto mt-12 space-y-8"
            >
              <div className="text-center space-y-4">
                <h2 className="text-4xl md:text-5xl font-black tracking-tighter text-white">
                  找出完美的<br/><span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-orange-600">數據拼圖</span>
                </h2>
                <p className="text-lg text-slate-400 max-w-lg mx-auto leading-relaxed">
                  系統將會丟出一個數據目標，你必須從歷史球星中選出指定人數，讓他們的數據總和最接近目標值！
                </p>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-8 pt-6 border-t border-slate-800/50">
                  <button 
                    onClick={() => setIsHardMode(!isHardMode)}
                    className={`flex items-center gap-4 p-4 rounded-2xl border-2 transition-all ${
                      isHardMode ? 'bg-orange-500/10 border-orange-500 shadow-[0_0_15px_rgba(249,115,22,0.2)]' : 'bg-slate-800 border-slate-700 hover:border-slate-500'
                    }`}
                  >
                    <div className={`w-6 h-6 flex-none rounded border-2 flex items-center justify-center transition-colors ${
                      isHardMode ? 'bg-orange-500 border-orange-500' : 'border-slate-500'
                    }`}>
                      {isHardMode && <div className="text-white text-xs font-bold">✔</div>}
                    </div>
                    <div className="text-left">
                      <div className="font-bold uppercase tracking-wider text-slate-200">困難模式</div>
                      <div className="text-xs text-slate-400 mt-1">選角限制指定位置發揮</div>
                    </div>
                  </button>

                  <button 
                    onClick={() => setIsActiveMode(!isActiveMode)}
                    className={`flex items-center gap-4 p-4 rounded-2xl border-2 transition-all ${
                      isActiveMode ? 'bg-cyan-500/10 border-cyan-500 shadow-[0_0_15px_rgba(6,182,212,0.2)]' : 'bg-slate-800 border-slate-700 hover:border-slate-500'
                    }`}
                  >
                    <div className={`w-6 h-6 flex-none rounded border-2 flex items-center justify-center transition-colors ${
                      isActiveMode ? 'bg-cyan-500 border-cyan-500' : 'border-slate-500'
                    }`}>
                      {isActiveMode && <div className="text-white text-xs font-bold">✔</div>}
                    </div>
                    <div className="text-left">
                      <div className="font-bold uppercase tracking-wider text-slate-200">現役球員</div>
                      <div className="text-xs text-slate-400 mt-1">僅限2025-26本季現役陣容</div>
                    </div>
                  </button>
                </div>

                <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-2xl border-2 bg-slate-800/50 border-slate-700/50">
                   <div className="text-left">
                     <div className="font-bold uppercase tracking-wider text-slate-200">好友對戰秒數限制</div>
                     <div className="text-xs text-slate-400 mt-1">對手完成後，你剩餘的思考時間</div>
                   </div>
                   <div className="flex items-center gap-3">
                     <input
                       type="number"
                       value={timeoutDuration}
                       onChange={(e) => setTimeoutDuration(Number(e.target.value))}
                       min={1}
                       className="bg-slate-900 border border-slate-700 rounded-xl px-4 py-2 w-24 text-center text-white focus:outline-none focus:border-orange-500 font-bold"
                     />
                     <span className="font-bold text-slate-400">秒</span>
                   </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-12">
                <button
                  onClick={() => startGame('SOLO')}
                  className="group flex flex-col items-center justify-center p-8 bg-slate-800 border border-slate-700 rounded-3xl hover:border-orange-500 hover:orange-glow transition-all"
                >
                  <div className="bg-slate-900 border border-slate-700 text-orange-500 p-4 rounded-full mb-4 group-hover:scale-110 transition-transform">
                    <User size={32} />
                  </div>
                  <h3 className="text-xl font-black uppercase tracking-tight mb-2">單人挑戰</h3>
                  <p className="text-sm text-slate-400 text-center font-bold">測試你對球員數據的掌握度，挑戰最高準確率！</p>
                </button>

                <button
                  onClick={() => startGame('FRIEND_ONLINE')}
                  className="group flex flex-col items-center justify-center p-8 bg-slate-800 border border-slate-700 rounded-3xl hover:border-emerald-500 hover:shadow-[0_0_20px_rgba(16,185,129,0.3)] transition-all"
                >
                  <div className="bg-slate-900 border border-slate-700 text-emerald-500 p-4 rounded-full mb-4 group-hover:scale-110 transition-transform">
                    <Users size={32} />
                  </div>
                  <h3 className="text-xl font-black uppercase tracking-tight mb-2">好友對戰</h3>
                  <p className="text-sm text-slate-400 text-center font-bold">創建房間與遠端好友對決！看看誰比較懂球。</p>
                </button>
              </div>
            </motion.div>
          )}

          {gameState === 'P1_TURN' && currentPuzzle && (
            <motion.div 
              key={`turn-${gameState}`}
              initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-black tracking-tighter uppercase flex items-center gap-3">
                  <span className={`w-8 h-8 flex items-center justify-center text-sm ${!isHost && opponent === 'FRIEND_ONLINE' ? 'bg-emerald-500' : 'bg-orange-500'} text-white rounded-md`}>
                    {!isHost && opponent === 'FRIEND_ONLINE' ? '2P' : '1P'}
                  </span> 你的回合
                </h2>
                {timeLeft !== null && (
                  <div className="flex flex-col items-end">
                    <span className="text-red-500 font-black animate-pulse uppercase tracking-widest text-sm">對手已完成！倒數 {timeLeft} 秒</span>
                    <span className="text-xl font-bold tracking-widest text-red-500 mt-1">逾時將以 0 分計算</span>
                  </div>
                )}
              </div>

              <PuzzleInfo puzzle={currentPuzzle} />
              
              <div className="mt-8">
                <PlayerSelector 
                  maxPlayers={currentPuzzle.numPlayers} 
                  hardModeCondition={currentPuzzle.hardModeCondition}
                  isActiveMode={currentPuzzle.isActiveMode}
                  onConfirm={handleP1Confirm} 
                />
              </div>
            </motion.div>
          )}

          {gameState === 'LOBBY' && (
            <motion.div key="lobby" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <Lobby 
                onJoinSuccess={handleJoinLobby} 
                onBack={() => setGameState('WELCOME')} 
              />
            </motion.div>
          )}

          {gameState === 'WAITING_ROOM' && (
            <motion.div key="waiting" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-center py-20">
              <h2 className="text-3xl font-black tracking-widest uppercase mb-4 text-white">等待對手</h2>
              <p className="text-slate-400 mb-8">房間 ID: <strong className="text-white text-xl ml-2 tracking-widest">{roomId}</strong></p>
              
              {isHost && (
                <div className="mb-12 flex flex-col items-center">
                   <p className="text-sm font-bold text-slate-400 mb-3">請將下方房間 ID 告訴對手：</p>
                   <div className="bg-slate-900 border border-orange-500/50 rounded-2xl px-8 py-4 mb-4 mt-2 relative group w-full max-w-sm flex justify-center">
                     <span className="text-4xl font-black text-orange-400 tracking-[0.25em] mr-[-0.25em]">{roomId}</span>
                   </div>
                   
                   <p className="text-sm font-bold text-slate-300 max-w-md text-center bg-orange-600/20 border border-orange-600/50 p-4 rounded-xl mt-4">
                     ⚠️ 網址連結無法直接分享！請務必讓對手點擊右上角的 Share「Shared App URL」進入同一個網站，然後在首頁點擊「連線對戰」，手動輸入上方的 6 碼房間 ID 加入。
                   </p>
                </div>
              )}

              <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
              {isHost && <p className="mt-8 text-sm text-slate-500 font-bold">當有對手加入時遊戲將自動開始...</p>}
              {!isHost && <p className="mt-8 text-sm text-slate-500 font-bold">等待房主開始遊戲...</p>}
            </motion.div>
          )}

          {gameState === 'WAITING_FOR_OPPONENT' && (
            <motion.div key="waiting_opponent" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.05 }} className="text-center bg-slate-800 p-12 rounded-3xl border border-slate-700 max-w-lg mx-auto">
              <h2 className="text-3xl font-black tracking-widest uppercase mb-4 text-white">你已選擇完畢</h2>
              <p className="text-slate-400 font-bold mb-8">正在等待對手完成選擇...</p>
              <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
            </motion.div>
          )}

          {gameState === 'ROUND_RESULT' && currentPuzzle && (
            <motion.div 
              key="result"
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
              className="space-y-8"
            >
              <div className="text-center">
                <h2 className="text-3xl font-black mb-2 uppercase tracking-tight">回合結算</h2>
                <p className="text-slate-400 font-bold">看誰最接近目標數值！</p>
              </div>

              <PuzzleInfo puzzle={currentPuzzle} />

              <div className={`grid grid-cols-1 gap-6 mt-8 ${opponent === 'FRIEND_ONLINE' ? 'md:grid-cols-2' : 'max-w-xl mx-auto'}`}>
                <ResultCard 
                  label={opponent === 'SOLO' ? `回合 ${roundNum}` : "你的選擇"}
                  players={opponent === 'SOLO' || isHost ? p1Selection : p2Selection}
                  puzzle={currentPuzzle}
                  total={calculateTotal(opponent === 'SOLO' || isHost ? p1Selection : p2Selection, currentPuzzle.statCategory, currentPuzzle.mode)}
                  score={calculateScore(calculateTotal(opponent === 'SOLO' || isHost ? p1Selection : p2Selection, currentPuzzle.statCategory, currentPuzzle.mode), currentPuzzle.targetValue)}
                  isWinner={opponent === 'SOLO' || calculateScore(calculateTotal(opponent === 'SOLO' || isHost ? p1Selection : p2Selection, currentPuzzle.statCategory, currentPuzzle.mode), currentPuzzle.targetValue) > calculateScore(calculateTotal(isHost ? p2Selection : p1Selection, currentPuzzle.statCategory, currentPuzzle.mode), currentPuzzle.targetValue)}
                  isTie={opponent !== 'SOLO' && calculateScore(calculateTotal(opponent === 'SOLO' || isHost ? p1Selection : p2Selection, currentPuzzle.statCategory, currentPuzzle.mode), currentPuzzle.targetValue) === calculateScore(calculateTotal(isHost ? p2Selection : p1Selection, currentPuzzle.statCategory, currentPuzzle.mode), currentPuzzle.targetValue)}
                />
                
                {opponent === 'FRIEND_ONLINE' && (
                  <ResultCard 
                    label="對手的選擇"
                    players={isHost ? p2Selection : p1Selection}
                    puzzle={currentPuzzle}
                    total={calculateTotal(isHost ? p2Selection : p1Selection, currentPuzzle.statCategory, currentPuzzle.mode)}
                    score={calculateScore(calculateTotal(isHost ? p2Selection : p1Selection, currentPuzzle.statCategory, currentPuzzle.mode), currentPuzzle.targetValue)}
                    isWinner={calculateScore(calculateTotal(isHost ? p2Selection : p1Selection, currentPuzzle.statCategory, currentPuzzle.mode), currentPuzzle.targetValue) > calculateScore(calculateTotal(isHost ? p1Selection : p2Selection, currentPuzzle.statCategory, currentPuzzle.mode), currentPuzzle.targetValue)}
                    isTie={calculateScore(calculateTotal(isHost ? p1Selection : p2Selection, currentPuzzle.statCategory, currentPuzzle.mode), currentPuzzle.targetValue) === calculateScore(calculateTotal(isHost ? p2Selection : p1Selection, currentPuzzle.statCategory, currentPuzzle.mode), currentPuzzle.targetValue)}
                  />
                )}
              </div>

              <div className="flex justify-center mt-8 pb-12">
                <button 
                  onClick={handleNextRound}
                  className="bg-orange-500 text-white px-10 py-4 rounded-2xl font-black text-xl hover:bg-orange-600 orange-glow transition-all flex items-center gap-2 uppercase tracking-widest"
                >
                  {opponent === 'FRIEND_ONLINE' && !isHost ? '等待房主進行下一步' : (roundNum >= MAX_ROUNDS ? '查看最終結果' : '進入下一回合')}
                  {!(opponent === 'FRIEND_ONLINE' && !isHost) && <Play size={20} className="fill-current" />}
                </button>
              </div>
            </motion.div>
          )}

          {gameState === 'FINAL_RESULT' && (
            <motion.div 
              key="final"
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
              className="max-w-2xl mx-auto mt-12 text-center"
            >
              <div className="bg-slate-800 rounded-3xl p-10 border border-slate-700 nba-gradient relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-orange-500 via-yellow-400 to-orange-500"></div>
                
                <Trophy size={80} className="mx-auto text-yellow-500 mb-6 drop-shadow-[0_0_15px_rgba(234,179,8,0.5)]" />
                <h2 className="text-4xl font-black tracking-tight mb-8 uppercase">遊戲結束！</h2>
                
                <div className="flex items-center justify-center gap-12 mb-12">
                  <div className="text-center">
                    <p className="text-slate-400 font-bold uppercase tracking-widest mb-2 border-b-2 border-orange-500 pb-1 inline-block">
                      {opponent === 'SOLO' ? '總分' : '你'}
                    </p>
                    <div className="text-6xl font-black text-white stat-font">{opponent === 'SOLO' || isHost ? scores.p1.toFixed(1) : scores.p2.toFixed(1)}</div>
                  </div>
                  
                  {opponent === 'FRIEND_ONLINE' && (
                    <>
                      <div className="text-4xl font-black text-slate-700">VS</div>
                      <div className="text-center">
                        <p className="text-slate-400 font-bold uppercase tracking-widest mb-2 border-b-2 border-emerald-500 pb-1 inline-block">對手</p>
                        <div className="text-6xl font-black text-white stat-font">{isHost ? scores.p2.toFixed(1) : scores.p1.toFixed(1)}</div>
                      </div>
                    </>
                  )}
                </div>

                <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 mb-8 text-xl font-black uppercase text-orange-400 tracking-wider">
                  {opponent === 'SOLO' 
                    ? `你的平均準確率是 ${(scores.p1 / MAX_ROUNDS).toFixed(1)} 分！` 
                    : (isHost ? scores.p1 : scores.p2) > (isHost ? scores.p2 : scores.p1) ? '恭喜！你贏了！ 🎉' : (isHost ? scores.p2 : scores.p1) > (isHost ? scores.p1 : scores.p2) ? '真可惜，對手獲勝！ 🏆' : '雙方平手！ 🤝'
                  }
                </div>

                <div className="flex gap-4">
                  {opponent === 'FRIEND_ONLINE' && isHost ? (
                    <button 
                      onClick={() => socket.emit('game_event', { type: 'PLAY_AGAIN', roomId })}
                      className="w-full bg-orange-600 text-white py-4 rounded-2xl font-black text-xl hover:bg-orange-500 transition-all flex items-center justify-center gap-2 uppercase tracking-widest border border-orange-500"
                    >
                      <Repeat size={20} />
                      再來一局
                    </button>
                  ) : opponent === 'FRIEND_ONLINE' && !isHost ? (
                    <button 
                      disabled
                      className="w-full bg-slate-800 text-slate-500 py-4 rounded-2xl font-black text-xl flex items-center justify-center gap-2 uppercase tracking-widest border border-slate-700 cursor-not-allowed"
                    >
                      等待房主重新開始...
                    </button>
                  ) : null}
                  
                  <button 
                    onClick={returnHome}
                    className={`${opponent === 'SOLO' ? 'w-full' : 'w-1/2 flex-none px-4'} bg-slate-700 text-white py-4 rounded-2xl font-black text-xl hover:bg-slate-600 transition-all flex items-center justify-center gap-2 uppercase tracking-widest border border-slate-600 hover:border-slate-500`}
                  >
                    {opponent === 'SOLO' ? <><Repeat size={20} /> 再玩一次</> : '離開房間'}
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

