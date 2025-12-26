import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AnalysisUpload } from '@/api/entities';
import { UploadFile } from '@/api/integrations';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, FileText, ArrowLeft, Image, File, Loader2, Pill, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { toast } from 'sonner';
import { useTelegramAuth } from '@/components/auth/useTelegramAuth';

export default function Analysis() {
  const { telegramId, loading: authLoading, error: authError } = useTelegramAuth();
  const [isUploading, setIsUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [analysisName, setAnalysisName] = useState('');
  const fileInputRef = useRef(null);
  const queryClient = useQueryClient();

  const { data: analyses = [], isLoading } = useQuery({
    queryKey: ['analyses', telegramId],
    queryFn: async () => {
      if (!telegramId) return [];
      return AnalysisUpload.filter({
        user_telegram_id: telegramId
      }, '-created_date');
    },
    enabled: !!telegramId
  });

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!selectedFile) return;
      
      const result = await UploadFile({ file: selectedFile });
      
      const analysis = await AnalysisUpload.create({
        user_telegram_id: telegramId,
        file_url: result.file_url,
        file_type: selectedFile.type.includes('pdf') ? 'pdf' : 'image',
        analysis_name: analysisName || 'Анализ ' + format(new Date(), 'd.MM.yyyy')
      });
      
      // Отправляем вебхуки на n8n для OCR обработки
      await sendAnalysisWebhooks({
        analysis_id: analysis.id,
        telegram_id: telegramId,
        file_url: result.file_url,
        file_type: analysis.file_type,
        analysis_name: analysis.analysis_name,
        created_date: analysis.created_date
      });
      
      return analysis;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['analyses']);
      setSelectedFile(null);
      setAnalysisName('');
      toast.success('Анализ загружен! Расшифровка будет отправлена в чат', { icon: '📊' });
    }
  });

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      toast.error('Выберите файл');
      return;
    }
    
    setIsUploading(true);
    try {
      await uploadMutation.mutateAsync();
    } finally {
      setIsUploading(false);
    }
  };

  // Отправка вебхуков на n8n для AI анализа медицинских файлов
  const sendAnalysisWebhooks = async (data) => {
    const webhookUrl = import.meta.env.VITE_N8N_ANALYSIS_WEBHOOK_URL;
    const webhookTestUrl = import.meta.env.VITE_N8N_ANALYSIS_WEBHOOK_TEST_URL;
    
    const payload = {
      analysis_id: data.analysis_id,
      telegram_id: data.telegram_id,
      file_url: data.file_url,
      file_type: data.file_type,
      analysis_name: data.analysis_name,
      created_date: data.created_date,
      timestamp: new Date().toISOString()
    };
    
    // Отправляем на основной webhook
    if (webhookUrl) {
      try {
        await fetch(webhookUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload)
        });
        console.log('Analysis OCR webhook sent to production:', webhookUrl);
      } catch (error) {
        console.error('Error sending production webhook:', error);
      }
    }
    
    // Отправляем на тестовый webhook
    if (webhookTestUrl) {
      try {
        await fetch(webhookTestUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload)
        });
        console.log('Analysis OCR webhook sent to test:', webhookTestUrl);
      } catch (error) {
        console.error('Error sending test webhook:', error);
      }
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-pulse text-gray-400">Загрузка...</div>
      </div>
    );
  }

  if (authError) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-red-500 mb-2">Ошибка авторизации</p>
          <p className="text-gray-600 text-sm">{authError}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      <div className="max-w-md mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Link 
            to={createPageUrl('Dashboard')}
            className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Мои анализы</h1>
            <p className="text-sm text-gray-500">Загрузите для расшифровки</p>
          </div>
        </div>

        {/* Upload area */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 mb-6"
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".pdf,image/*"
            className="hidden"
          />

          {selectedFile ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-4 bg-rose-50 rounded-xl">
                {selectedFile.type.includes('pdf') ? (
                  <File className="w-10 h-10 text-rose-500" />
                ) : (
                  <Image className="w-10 h-10 text-rose-500" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 truncate">{selectedFile.name}</p>
                  <p className="text-sm text-gray-500">
                    {(selectedFile.size / 1024).toFixed(1)} KB
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedFile(null)}
                  className="text-gray-400"
                >
                  ✕
                </Button>
              </div>

              <Input
                placeholder="Название анализа (необязательно)"
                value={analysisName}
                onChange={(e) => setAnalysisName(e.target.value)}
              />

              <Button
                onClick={handleUpload}
                disabled={isUploading}
                className="w-full h-12 bg-rose-500 hover:bg-rose-600 rounded-xl"
              >
                {isUploading ? (
                  <span className="flex items-center">
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Загрузка...
                  </span>
                ) : (
                  <>
                    <Upload className="w-5 h-5 mr-2" />
                    Загрузить анализ
                  </>
                )}
              </Button>
            </div>
          ) : (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full py-12 border-2 border-dashed border-gray-300 rounded-2xl flex flex-col items-center justify-center gap-3 hover:border-rose-400 hover:bg-rose-50 transition-all"
            >
              <div className="w-16 h-16 bg-rose-100 rounded-2xl flex items-center justify-center">
                <Upload className="w-8 h-8 text-rose-500" />
              </div>
              <div className="text-center">
                <p className="font-medium text-gray-900">Загрузить файл</p>
                <p className="text-sm text-gray-500">PDF или изображение</p>
              </div>
            </button>
          )}
        </motion.div>

        {/* Info card */}
        <div className="bg-blue-50 rounded-xl p-4 mb-6 flex gap-3">
          <AlertCircle className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-700">
            <p className="font-medium mb-1">Как это работает?</p>
            <p>Загрузите результаты анализов, и бот пришлёт вам расшифровку с рекомендациями по БАДам в чат Telegram.</p>
          </div>
        </div>

        {/* History */}
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-3">История загрузок</h2>
          
          {isLoading ? (
            <div className="text-center py-8 text-gray-400">Загрузка...</div>
          ) : analyses.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-2xl">
              <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">Нет загруженных анализов</p>
            </div>
          ) : (
            <div className="space-y-3">
              {analyses.map((analysis) => (
                <motion.div
                  key={analysis.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="bg-white rounded-xl p-4 shadow-sm border border-gray-100"
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      analysis.file_type === 'pdf' ? 'bg-red-100' : 'bg-blue-100'
                    }`}>
                      {analysis.file_type === 'pdf' ? (
                        <File className="w-5 h-5 text-red-500" />
                      ) : (
                        <Image className="w-5 h-5 text-blue-500" />
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">{analysis.analysis_name}</p>
                      <p className="text-sm text-gray-500">
                        {format(new Date(analysis.created_date), "d MMMM yyyy, HH:mm", { locale: ru })}
                      </p>
                    </div>
                  </div>

                  {analysis.supplements_recommendation && (
                    <div className="mt-3 p-3 bg-green-50 rounded-lg">
                      <div className="flex items-center gap-2 text-green-700 mb-1">
                        <Pill className="w-4 h-4" />
                        <span className="text-sm font-medium">Рекомендации по БАДам</span>
                      </div>
                      <p className="text-sm text-green-600">{analysis.supplements_recommendation}</p>
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}