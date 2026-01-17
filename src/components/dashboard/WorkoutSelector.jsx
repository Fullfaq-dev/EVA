import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Footprints, Zap, Heart, Flame } from 'lucide-react';

export const WORKOUT_TYPES = [
  {
    id: 'walk',
    label: 'Прогулка',
    icon: Footprints,
    calories: 100,
    points: 5,
    color: 'bg-blue-500',
    description: 'Спокойная ходьба'
  },
  {
    id: 'warmup',
    label: 'Зарядка',
    icon: Zap,
    calories: 150,
    points: 10,
    color: 'bg-emerald-500',
    description: 'Утренняя разминка'
  },
  {
    id: 'light',
    label: 'Легкая тренировка',
    icon: Heart,
    calories: 250,
    points: 20,
    color: 'bg-purple-500',
    description: 'Йога, пилатес, растяжка'
  },
  {
    id: 'heavy',
    label: 'Тяжелая тренировка',
    icon: Flame,
    calories: 500,
    points: 40,
    color: 'bg-rose-500',
    description: 'Зал, бокс, бег и т.п.'
  }
];

export default function WorkoutSelector({ isOpen, onClose, onSelect }) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px] rounded-3xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">Какая была тренировка?</DialogTitle>
          <DialogDescription>
            Выберите тип активности, чтобы мы могли рассчитать расход калорий и начислить баллы.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 py-4">
          {WORKOUT_TYPES.map((type) => {
            const Icon = type.icon;
            return (
              <Button
                key={type.id}
                variant="outline"
                className="h-auto py-4 px-4 flex items-center justify-start gap-4 rounded-2xl hover:bg-gray-50 border-gray-100"
                onClick={() => {
                  onSelect(type);
                  onClose();
                }}
              >
                <div className={`w-12 h-12 ${type.color} rounded-xl flex items-center justify-center shrink-0`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
                <div className="text-left">
                  <p className="font-bold text-gray-900">{type.label}</p>
                  <p className="text-xs text-gray-500">{type.description}</p>
                  <div className="flex gap-2 mt-1">
                    <span className="text-[10px] font-medium bg-orange-50 text-orange-600 px-1.5 py-0.5 rounded">
                      ~{type.calories} ккал
                    </span>
                    <span className="text-[10px] font-medium bg-purple-50 text-purple-600 px-1.5 py-0.5 rounded">
                      +{type.points} баллов
                    </span>
                  </div>
                </div>
              </Button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
