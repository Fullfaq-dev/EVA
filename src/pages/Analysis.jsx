import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AnalysisUpload } from '@/api/entities';
import { UploadFile } from '@/api/integrations';
import { extractTextFromPDF } from '@/utils/pdfParser';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Upload, 
  FileText, 
  ArrowLeft, 
  Image, 
  File, 
  Loader2, 
  Pill, 
  AlertCircle, 
  ChevronRight, 
  Search, 
  Activity, 
  ClipboardList, 
  Stethoscope 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { toast } from 'sonner';
import { useTelegramAuth } from '@/components/auth/useTelegramAuth';
import { LoadingOverlay } from '@/components/ui/LoadingOverlay';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export default function Analysis() {
  const { telegramId, loading: authLoading, error: authError } = useTelegramAuth();
  const [isUploading, setIsUploading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [analysisName, setAnalysisName] = useState('');
  const [selectedAnalysis, setSelectedAnalysis] = useState(null);
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
      if (selectedFiles.length === 0) return;
      
      const isPdf = selectedFiles[0].type.includes('pdf');
      let fileUrls = [];
      let extractedTexts = [];

      if (isPdf) {
        // Для PDF извлекаем текст на клиенте
        const text = await extractTextFromPDF(selectedFiles[0]);
        extractedTexts.push(text);
        fileUrls.push('text://extracted');
      } else {
        // Для изображений загружаем все файлы
        for (const file of selectedFiles) {
          const result = await UploadFile({ file });
          fileUrls.push(result.file_url);
        }
      }
      
      const analysis = await AnalysisUpload.create({
        user_telegram_id: telegramId,
        file_url: fileUrls[0], // Основной файл
        file_type: isPdf ? 'pdf' : 'image',
        analysis_name: analysisName || 'Анализ ' + format(new Date(), 'd.MM.yyyy')
      });
      
      // Отправляем вебхуки на n8n для обработки
      await sendAnalysisWebhooks({
        analysis_id: analysis.id,
        telegram_id: telegramId,
        file_url: fileUrls[0],
        file_urls: fileUrls, // Передаем все URL для мультизагрузки
        file_type: analysis.file_type,
        analysis_name: analysis.analysis_name,
        created_date: analysis.created_date,
        extracted_text: isPdf ? extractedTexts[0] : null,
        extracted_texts: extractedTexts
      });
      
      return analysis;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['analyses']);
      setIsUploading(false);
      setIsSuccess(true);
    }
  });

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files);
    if (files.length > 0) {
      const isPdf = files[0].type.includes('pdf');
      
      if (isPdf) {
        // Если PDF, берем только первый
        setSelectedFiles([files[0]]);
        if (files.length > 1) {
          toast.info('PDF можно загружать только по одному');
        }
      } else {
        // Если изображения, берем до 4 штук
        const images = files.filter(f => f.type.includes('image')).slice(0, 4);
        setSelectedFiles(images);
        if (files.length > 4) {
          toast.warning('Максимум 4 изображения за раз');
        }
      }
    }
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0) {
      toast.error('Выберите файл');
      return;
    }

    setIsUploading(true);
    try {
      await uploadMutation.mutateAsync();
    } catch (error) {
      setIsUploading(false);
      toast.error(error.message || 'Ошибка при загрузке');
    }
  };

  const handleUploadComplete = () => {
    setIsSuccess(false);
    setSelectedFiles([]);
    setAnalysisName('');
    toast.success('Анализ отправлен на обработку!', { icon: '📊' });
  };

  // Отправка вебхуков на n8n для AI анализа медицинских файлов
  const sendAnalysisWebhooks = async (data) => {
    const webhookUrl = import.meta.env.VITE_N8N_ANALYSIS_WEBHOOK_URL;
    const webhookTestUrl = import.meta.env.VITE_N8N_ANALYSIS_WEBHOOK_TEST_URL;
    
    const payload = {
      analysis_id: data.analysis_id,
      telegram_id: data.telegram_id,
      file_url: data.file_url,
      file_urls: data.file_urls || [data.file_url],
      file_type: data.file_type,
      analysis_name: data.analysis_name,
      created_date: data.created_date,
      extracted_text: data.extracted_text,
      extracted_texts: data.extracted_texts || [],
      timestamp: new Date().toISOString()
    };

    // Use only environment variables if they exist, otherwise fallback to production URL
    // This prevents duplicate sends if VITE_N8N_ANALYSIS_WEBHOOK_URL is the same as the hardcoded one
    const urls = [];
    if (webhookUrl) urls.push(webhookUrl);
    if (webhookTestUrl) urls.push(webhookTestUrl);
    
    // If no env var for production, use the hardcoded one
    const productionWebhookUrl = "https://lavaproject.zeabur.app/webhook/analysis";
    if (!urls.includes(productionWebhookUrl)) {
      urls.push(productionWebhookUrl);
    }
    
    // Send to each URL sequentially
    for (const url of urls) {
      try {
        await fetch(url, {
          method: 'POST',
          mode: 'no-cors', // Try to bypass CORS for simple webhooks
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload)
        });
        console.log(`Analysis OCR webhook sent to: ${url}`);
      } catch (error) {
        console.error(`Error sending webhook to ${url}:`, error);
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

  // Detail View Component
  if (selectedAnalysis) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-md mx-auto px-4 py-6">
          <button 
            onClick={() => setSelectedAnalysis(null)}
            className="flex items-center gap-2 text-gray-600 mb-6 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Назад к списку</span>
          </button>

          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 mb-6">
            <div className="flex items-center gap-4 mb-6">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                selectedAnalysis.file_type === 'pdf' ? 'bg-red-100' : 'bg-blue-100'
              }`}>
                {selectedAnalysis.file_type === 'pdf' ? (
                  <File className="w-6 h-6 text-red-500" />
                ) : (
                  <Image className="w-6 h-6 text-blue-500" />
                )}
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">{selectedAnalysis.analysis_name}</h1>
                <p className="text-sm text-gray-500">
                  {format(new Date(selectedAnalysis.created_date), "d MMMM yyyy", { locale: ru })}
                </p>
              </div>
            </div>

            <Accordion type="single" collapsible className="w-full space-y-3">
              {/* Key Findings */}
              <AccordionItem value="findings" className="border rounded-xl px-4 border-gray-100 bg-gray-50/50">
                <AccordionTrigger className="hover:no-underline py-4">
                  <div className="flex items-center gap-3">
                    <Search className="w-5 h-5 text-blue-500" />
                    <span className="font-semibold">Основные выводы</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="text-gray-600 leading-relaxed pb-4">
                  {selectedAnalysis.key_findings || "Анализ еще обрабатывается или данных нет."}
                </AccordionContent>
              </AccordionItem>

              {/* Deficiencies */}
              <AccordionItem value="deficiencies" className="border rounded-xl px-4 border-gray-100 bg-gray-50/50">
                <AccordionTrigger className="hover:no-underline py-4">
                  <div className="flex items-center gap-3">
                    <Activity className="w-5 h-5 text-amber-500" />
                    <span className="font-semibold">Дефициты</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="text-gray-600 leading-relaxed pb-4">
                  {selectedAnalysis.deficiencies || "Дефицитов не обнаружено или анализ еще обрабатывается."}
                </AccordionContent>
              </AccordionItem>

              {/* Supplements */}
              <AccordionItem value="supplements" className="border rounded-xl px-4 border-gray-100 bg-gray-50/50">
                <AccordionTrigger className="hover:no-underline py-4">
                  <div className="flex items-center gap-3">
                    <Pill className="w-5 h-5 text-emerald-500" />
                    <span className="font-semibold">Рекомендации по БАДам</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="text-gray-600 leading-relaxed pb-4">
                  {selectedAnalysis.supplements_recommendation || "Рекомендаций пока нет."}
                </AccordionContent>
              </AccordionItem>

              {/* Follow-up Tests */}
              <AccordionItem value="followup" className="border rounded-xl px-4 border-gray-100 bg-gray-50/50">
                <AccordionTrigger className="hover:no-underline py-4">
                  <div className="flex items-center gap-3">
                    <Stethoscope className="w-5 h-5 text-rose-500" />
                    <span className="font-semibold">Что досдать / К кому пойти</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="text-gray-600 leading-relaxed pb-4">
                  {selectedAnalysis.follow_up_tests || "Дополнительных рекомендаций нет."}
                </AccordionContent>
              </AccordionItem>
            </Accordion>

            <div className="mt-8 pt-6 border-t border-gray-100">
              {selectedAnalysis.file_url && selectedAnalysis.file_url !== 'text://extracted' ? (
                <a 
                  href={selectedAnalysis.file_url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full py-3 bg-gray-100 hover:bg-gray-200 rounded-xl text-gray-700 font-medium transition-colors"
                >
                  <ClipboardList className="w-5 h-5" />
                  Открыть оригинал файла
                </a>
              ) : (
                <div className="text-center text-sm text-gray-400 italic">
                  Оригинал файла не был сохранен (только текст)
                </div>
              )}
            </div>
          </div>
        </div>
        
        <LoadingOverlay
          isLoading={isUploading}
          isSuccess={isSuccess}
          onComplete={handleUploadComplete}
          message="Загружаем и анализируем..."
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      <div className="max-w-md mx-auto px-4 py-6 pb-24">
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

        {/* History / List of Analyses */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Ваши результаты</h2>
            {analyses.length > 0 && (
              <span className="text-xs font-medium px-2 py-1 bg-gray-100 text-gray-500 rounded-full">
                {analyses.length} {analyses.length === 1 ? 'файл' : analyses.length < 5 ? 'файла' : 'файлов'}
              </span>
            )}
          </div>
          
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-20 bg-gray-100 rounded-2xl animate-pulse" />
              ))}
            </div>
          ) : analyses.length === 0 ? (
            <div className="text-center py-10 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
              <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center mx-auto mb-3 shadow-sm">
                <FileText className="w-6 h-6 text-gray-300" />
              </div>
              <p className="text-gray-500 text-sm">У вас пока нет загруженных анализов</p>
            </div>
          ) : (
            <div className="space-y-3">
              {analyses.map((analysis) => (
                <motion.div
                  key={analysis.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  onClick={() => setSelectedAnalysis(analysis)}
                  className="group bg-white rounded-2xl p-4 shadow-sm border border-gray-100 active:scale-[0.98] transition-all cursor-pointer hover:border-rose-200 hover:shadow-md"
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-colors ${
                      analysis.file_type === 'pdf'
                        ? 'bg-red-50 text-red-500 group-hover:bg-red-100'
                        : 'bg-blue-50 text-blue-500 group-hover:bg-blue-100'
                    }`}>
                      {analysis.file_type === 'pdf' ? (
                        <File className="w-6 h-6" />
                      ) : (
                        <Image className="w-6 h-6" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-gray-900 truncate">{analysis.analysis_name}</p>
                        {new Date(analysis.created_date) > new Date(Date.now() - 24 * 60 * 60 * 1000) && (
                          <span className="w-2 h-2 bg-rose-500 rounded-full" />
                        )}
                      </div>
                      <p className="text-xs text-gray-500 flex items-center gap-1">
                        <Activity className="w-3 h-3" />
                        {format(new Date(analysis.created_date), "d MMMM yyyy", { locale: ru })}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <div className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center group-hover:bg-rose-50 group-hover:text-rose-500 transition-colors">
                        <ChevronRight className="w-5 h-5" />
                      </div>
                      <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">Открыть</span>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>

        {/* Upload area */}
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Загрузить новый</h2>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100"
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".pdf,image/*"
              multiple
              className="hidden"
            />
  
            {selectedFiles.length > 0 ? (
              <div className="space-y-4">
                <div className="space-y-2">
                  {selectedFiles.map((file, index) => (
                    <div key={index} className="flex items-center gap-3 p-3 bg-rose-50 rounded-xl border border-rose-100">
                      {file.type.includes('pdf') ? (
                        <File className="w-8 h-8 text-rose-500" />
                      ) : (
                        <Image className="w-8 h-8 text-rose-500" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 truncate text-sm">{file.name}</p>
                        <p className="text-[10px] text-gray-500">
                          {(file.size / 1024).toFixed(1)} KB
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedFiles(prev => prev.filter((_, i) => i !== index))}
                        className="text-gray-400 h-8 w-8 p-0"
                      >
                        ✕
                      </Button>
                    </div>
                  ))}
                </div>
  
                <Input
                  placeholder="Название анализа (например, Общий анализ крови)"
                  value={analysisName}
                  onChange={(e) => setAnalysisName(e.target.value)}
                  className="h-12 rounded-xl border-gray-200 focus:border-rose-300 focus:ring-rose-100"
                />

                <Button
                  onClick={handleUpload}
                  disabled={isUploading}
                  className="w-full h-12 bg-rose-500 hover:bg-rose-600 rounded-xl shadow-lg shadow-rose-200 transition-all active:scale-[0.98]"
                >
                  {isUploading ? (
                    <span className="flex items-center">
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      Обработка...
                    </span>
                  ) : (
                    <>
                      <Upload className="w-5 h-5 mr-2" />
                      Начать расшифровку
                    </>
                  )}
                </Button>
              </div>
            ) : (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full py-8 border-2 border-dashed border-gray-200 rounded-2xl flex flex-col items-center justify-center gap-3 hover:border-rose-300 hover:bg-rose-50/50 transition-all group"
              >
                <div className="w-14 h-14 bg-rose-50 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Upload className="w-7 h-7 text-rose-500" />
                </div>
                <div className="text-center px-4">
                  <p className="font-semibold text-gray-900">Нажмите, чтобы выбрать файлы</p>
                  <p className="text-xs text-gray-500 mt-1">
                    PDF (1 шт) или фото (до 4 шт)
                  </p>
                </div>
              </button>
            )}
          </motion.div>
        </div>

        {/* Info card */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl p-5 flex gap-4 border border-blue-100/50">
          <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm flex-shrink-0">
            <AlertCircle className="w-6 h-6 text-blue-500" />
          </div>
          <div className="text-sm text-blue-800">
            <p className="font-bold mb-1">Умная расшифровка</p>
            <p className="leading-relaxed opacity-80">ИИ проанализирует ваши показатели, сравнит их с нормами и подготовит понятный отчет с рекомендациями.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
