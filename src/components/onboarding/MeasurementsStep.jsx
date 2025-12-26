import React from 'react';
import { Ruler, Weight, Calendar } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function MeasurementsStep({ height, weight, age, onChange }) {
  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-semibold text-gray-900">Ваши параметры</h2>
        <p className="text-gray-500 mt-2">Для точного расчёта нормы питания</p>
      </div>
      
      <div className="space-y-5">
        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
          <Label className="flex items-center gap-2 text-gray-600 mb-3">
            <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center">
              <Ruler className="w-4 h-4 text-emerald-600" />
            </div>
            Рост (см)
          </Label>
          <Input
            type="number"
            placeholder="170"
            value={height || ''}
            onChange={(e) => onChange('height', Number(e.target.value))}
            className="h-12 text-lg border-gray-200 focus:border-emerald-500 focus:ring-emerald-500"
          />
        </div>
        
        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
          <Label className="flex items-center gap-2 text-gray-600 mb-3">
            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
              <Weight className="w-4 h-4 text-blue-600" />
            </div>
            Вес (кг)
          </Label>
          <Input
            type="number"
            placeholder="70"
            value={weight || ''}
            onChange={(e) => onChange('weight', Number(e.target.value))}
            className="h-12 text-lg border-gray-200 focus:border-emerald-500 focus:ring-emerald-500"
          />
        </div>
        
        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
          <Label className="flex items-center gap-2 text-gray-600 mb-3">
            <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center">
              <Calendar className="w-4 h-4 text-purple-600" />
            </div>
            Возраст
          </Label>
          <Input
            type="number"
            placeholder="30"
            value={age || ''}
            onChange={(e) => onChange('age', Number(e.target.value))}
            className="h-12 text-lg border-gray-200 focus:border-emerald-500 focus:ring-emerald-500"
          />
        </div>
      </div>
    </div>
  );
}