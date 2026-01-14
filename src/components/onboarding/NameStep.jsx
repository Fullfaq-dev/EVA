import React from 'react';
import { Input } from '@/components/ui/input';
import { User } from 'lucide-react';

export default function NameStep({ value, onChange }) {
  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-semibold text-gray-900">Как вас зовут?</h2>
        <p className="text-gray-500 mt-2">Представьтесь, чтобы мы знали, как к вам обращаться</p>
      </div>
      
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <User className="h-5 w-5 text-gray-400" />
        </div>
        <Input
          type="text"
          placeholder="Ваше имя"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="pl-10 h-12 rounded-xl border-gray-200 focus:border-emerald-500 focus:ring-emerald-500"
          autoFocus
        />
      </div>
    </div>
  );
}
