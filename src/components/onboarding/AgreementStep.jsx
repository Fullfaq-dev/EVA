import React, { useState, useEffect } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { LEGAL_DOCUMENTS } from '@/utils/legalTexts';

export default function AgreementStep({ value, onChange }) {
  const [documents, setDocuments] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDocuments = async () => {
      const docs = {};
      try {
        for (const [key, config] of Object.entries(LEGAL_DOCUMENTS)) {
          const response = await fetch(config.path);
          const text = await response.text();
          docs[key] = { ...config, content: text };
        }
        setDocuments(docs);
      } catch (error) {
        console.error('Error loading legal documents:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchDocuments();
  }, []);

  if (loading) {
    return <div className="text-center p-4">Загрузка документов...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-semibold text-gray-900">Юридическая информация</h2>
        <p className="text-gray-500 mt-2">Пожалуйста, ознакомьтесь и примите условия использования</p>
      </div>

      <div className="space-y-4">
        {Object.entries(documents).map(([key, section]) => (
          <div key={key} className="border rounded-lg p-4 bg-white">
            <h3 className="font-medium mb-2">{section.title}</h3>
            <ScrollArea className="h-32 w-full rounded-md border p-2 text-sm text-gray-600">
              <div dangerouslySetInnerHTML={{ __html: section.content }} />
            </ScrollArea>
          </div>
        ))}
      </div>

      <div className="flex items-center space-x-2 pt-4">
        <Checkbox 
          id="terms" 
          checked={value}
          onCheckedChange={onChange}
        />
        <Label 
          htmlFor="terms" 
          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
        >
          Я согласен с Пользовательским соглашением, Политикой конфиденциальности и даю согласие на обработку персональных данных
        </Label>
      </div>
    </div>
  );
}
