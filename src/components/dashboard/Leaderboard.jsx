import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { UserProfile } from '@/api/entities';
import { motion } from 'framer-motion';
import { Trophy, Medal, Crown } from 'lucide-react';
import { useTelegramAuth } from '@/components/auth/useTelegramAuth';

export default function Leaderboard() {
  const { telegramId } = useTelegramAuth();

  const { data: leaders = [], isLoading } = useQuery({
    queryKey: ['leaderboard'],
    queryFn: async () => {
      // Fetch top 50 users sorted by total_points descending
      const users = await UserProfile.filter({}, '-total_points', 50);
      return users;
    },
    refetchInterval: 30000 // Refresh every 30 seconds for "real-time" feel
  });

  const formatName = (name) => {
    if (!name) return 'Аноним';
    // Take first 5 characters, mask the rest with *
    const visiblePart = name.slice(0, 5);
    const maskedPart = name.length > 5 ? '*'.repeat(name.length - 5) : '';
    return `${visiblePart}${maskedPart}`;
  };

  const getRankIcon = (index) => {
    switch (index) {
      case 0:
        return <Crown className="w-5 h-5 text-yellow-500 fill-yellow-500" />;
      case 1:
        return <Medal className="w-5 h-5 text-gray-400 fill-gray-400" />;
      case 2:
        return <Medal className="w-5 h-5 text-amber-600 fill-amber-600" />;
      default:
        return <span className="text-sm font-bold text-gray-500 w-5 text-center">{index + 1}</span>;
    }
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 animate-pulse">
        <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex items-center justify-between py-3 border-b border-gray-50 last:border-0">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-gray-200 rounded-full"></div>
              <div className="w-24 h-4 bg-gray-200 rounded"></div>
            </div>
            <div className="w-12 h-4 bg-gray-200 rounded"></div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100"
    >
      <div className="flex items-center gap-2 mb-4">
        <Trophy className="w-5 h-5 text-amber-500" />
        <h3 className="font-semibold text-gray-900">Лидерборд</h3>
      </div>

      <div className="space-y-1">
        {leaders.map((user, index) => {
          const isCurrentUser = user.telegram_id === telegramId;
          
          return (
            <div 
              key={user.id}
              className={`flex items-center justify-between py-3 px-3 rounded-xl transition-colors ${
                isCurrentUser ? 'bg-emerald-50 border border-emerald-100' : 'hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="flex-shrink-0 w-6 flex justify-center">
                  {getRankIcon(index)}
                </div>
                
                <div className="flex flex-col">
                  <span className={`text-sm font-medium ${isCurrentUser ? 'text-emerald-900' : 'text-gray-900'}`}>
                    {formatName(user.full_name)}
                    {isCurrentUser && <span className="ml-2 text-xs text-emerald-600 font-normal">(Вы)</span>}
                  </span>
                </div>
              </div>
              
              <div className="flex items-center gap-1">
                <span className={`font-bold ${isCurrentUser ? 'text-emerald-600' : 'text-gray-900'}`}>
                  {user.total_points || 0}
                </span>
                <span className="text-xs text-gray-400">б.</span>
              </div>
            </div>
          );
        })}

        {leaders.length === 0 && (
          <div className="text-center py-8 text-gray-400">
            Пока нет лидеров
          </div>
        )}
      </div>
    </motion.div>
  );
}
