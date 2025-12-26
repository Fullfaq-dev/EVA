import React from 'react';
import { MessageSquare } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';

export default function ProblemsStep({ value, onChange }) {
  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-semibold text-gray-900">Проблемы и жалобы</h2>
        <p className="text-gray-500 mt-2">Опишите, что вас беспокоит (необязательно)</p>
      </div>
      
      <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
        <div className="flex items-center gap-2 text-gray-600 mb-3">
          <div className="w-8 h-8 rounded-full bg-violet-100 flex items-center justify-center">
            <MessageSquare className="w-4 h-4 text-violet-600" />
          </div>
          <span className="text-sm font-medium">Ваши комментарии</span>
        </div>
        <Textarea
          placeholder="Например: частая усталость, проблемы со сном, вздутие после еды..."
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          className="min-h-32 border-gray-200 focus:border-emerald-500 focus:ring-emerald-500 resize-none"
        />
      </div>
      
      <div className="bg-emerald-50 rounded-xl p-4">
        <p className="text-sm text-emerald-700">
          💡 Эта информация поможет нам дать более персонализированные рекомендации
        </p>
      </div>
    </div>
  );
}