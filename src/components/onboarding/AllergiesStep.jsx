import React from 'react';
import { Ban } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';

export default function AllergiesStep({ value, onChange }) {
  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-semibold text-gray-900">Аллергии и ограничения</h2>
        <p className="text-gray-500 mt-2">Укажите продукты, которые вам нельзя или которые вы не любите (необязательно)</p>
      </div>
      
      <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
        <div className="flex items-center gap-2 text-gray-600 mb-3">
          <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center">
            <Ban className="w-4 h-4 text-red-600" />
          </div>
          <span className="text-sm font-medium">Аллергии и нежелательные продукты</span>
        </div>
        <Textarea
          placeholder="Например: лактоза, орехи, морепродукты, кинза..."
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          className="min-h-32 border-gray-200 focus:border-emerald-500 focus:ring-emerald-500 resize-none"
        />
      </div>
      
      <div className="bg-amber-50 rounded-xl p-4">
        <p className="text-sm text-amber-700">
          💡 Мы будем учитывать это при составлении рекомендаций и анализе вашего рациона
        </p>
      </div>
    </div>
  );
}
