import React, { useState, useRef, useEffect } from 'react';
import { Mic, Square, Play, Pause, Trash2, Volume2, Download, AlertCircle } from 'lucide-react';

interface AudioVoiceRecorderProps {
  initialAudioUrl?: string;
  onSaveAudio: (audioUrl: string, durationSeconds?: number) => void;
  onDeleteAudio?: () => void;
  title?: string;
}

export const AudioVoiceRecorder: React.FC<AudioVoiceRecorderProps> = ({
  initialAudioUrl,
  onSaveAudio,
  onDeleteAudio,
  title = 'Gravação de Áudio / Voz'
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(initialAudioUrl || null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<number | null>(null);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (initialAudioUrl) {
      setAudioUrl(initialAudioUrl);
    }
  }, [initialAudioUrl]);

  useEffect(() => {
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  const formatSeconds = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const secs = Math.floor(sec % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const startRecording = async () => {
    setErrorMessage(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = () => {
          const base64data = reader.result as string;
          setAudioUrl(base64data);
          onSaveAudio(base64data, recordingTime);
        };

        // Stop all mic tracks
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start(250);
      setIsRecording(true);
      setIsPaused(false);
      setRecordingTime(0);

      timerIntervalRef.current = window.setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } catch (err: any) {
      console.error("Erro ao acessar microfone:", err);
      setErrorMessage("Permissão de microfone não concedida ou dispositivo não encontrado.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    setIsRecording(false);
    setIsPaused(false);
  };

  const togglePlayAudio = () => {
    if (!audioElementRef.current) return;
    if (isPlaying) {
      audioElementRef.current.pause();
      setIsPlaying(false);
    } else {
      audioElementRef.current.play();
      setIsPlaying(true);
    }
  };

  const handleDelete = () => {
    if (confirm("Remover esta gravação de áudio?")) {
      if (audioElementRef.current) {
        audioElementRef.current.pause();
      }
      setAudioUrl(null);
      setIsPlaying(false);
      setRecordingTime(0);
      if (onDeleteAudio) onDeleteAudio();
    }
  };

  return (
    <div className="bg-gray-50 dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700/80 rounded-2xl p-4 my-3 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-violet-100 dark:bg-violet-950/60 text-violet-600 dark:text-violet-400">
            <Volume2 className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-gray-900 dark:text-gray-100 uppercase tracking-wider">{title}</h4>
            <p className="text-[11px] text-gray-500 dark:text-gray-400">Grave anotações por voz ou explicações rápidas</p>
          </div>
        </div>

        {audioUrl && !isRecording && (
          <button
            onClick={handleDelete}
            className="p-1.5 text-gray-400 hover:text-rose-500 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
            title="Remover áudio"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>

      {errorMessage && (
        <div className="flex items-center gap-2 p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-xl text-xs text-rose-700 dark:text-rose-300">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Se estiver gravando */}
      {isRecording && (
        <div className="flex items-center justify-between bg-white dark:bg-gray-900 p-3.5 rounded-xl border border-rose-300 dark:border-rose-800 animate-pulse">
          <div className="flex items-center gap-3">
            <span className="w-3 h-3 rounded-full bg-rose-600 animate-ping" />
            <span className="text-xs font-bold text-rose-600 dark:text-rose-400">Gravando áudio...</span>
            <span className="font-mono text-sm font-bold text-gray-900 dark:text-white">
              {formatSeconds(recordingTime)}
            </span>
          </div>

          <button
            onClick={stopRecording}
            className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
          >
            <Square className="w-3.5 h-3.5" />
            <span>Finalizar Gravação</span>
          </button>
        </div>
      )}

      {/* Se já houver áudio gravado */}
      {audioUrl && !isRecording && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-gray-900 p-3.5 rounded-xl border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <button
              onClick={togglePlayAudio}
              className="p-2.5 rounded-full bg-violet-600 hover:bg-violet-500 text-white shadow-xs transition-transform active:scale-95 cursor-pointer"
            >
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
            </button>
            <div>
              <div className="text-xs font-semibold text-gray-900 dark:text-white">Áudio da Nota</div>
              <div className="text-[11px] font-mono text-gray-500 dark:text-gray-400">
                {formatSeconds(currentTime)} / {formatSeconds(duration || recordingTime)}
              </div>
            </div>
          </div>

          <audio
            ref={audioElementRef}
            src={audioUrl}
            onTimeUpdate={() => {
              if (audioElementRef.current) {
                setCurrentTime(audioElementRef.current.currentTime);
              }
            }}
            onLoadedMetadata={() => {
              if (audioElementRef.current) {
                setDuration(audioElementRef.current.duration);
              }
            }}
            onEnded={() => {
              setIsPlaying(false);
              setCurrentTime(0);
            }}
            className="hidden"
          />

          <div className="flex items-center gap-2">
            <button
              onClick={startRecording}
              className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-750 text-gray-700 dark:text-gray-300 rounded-xl text-xs font-semibold transition-colors flex items-center gap-1"
            >
              <Mic className="w-3.5 h-3.5" />
              <span>Regravar</span>
            </button>
            <a
              href={audioUrl}
              download={`audio-nota-${Date.now()}.webm`}
              className="p-2 text-gray-500 hover:text-gray-900 dark:hover:text-white rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              title="Baixar áudio"
            >
              <Download className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      )}

      {/* Se não houver áudio e não estiver gravando */}
      {!audioUrl && !isRecording && (
        <div className="flex items-center justify-between bg-white dark:bg-gray-900 p-3 rounded-xl border border-gray-200 dark:border-gray-700">
          <span className="text-xs text-gray-500 dark:text-gray-400">Nenhum áudio gravado nesta nota</span>
          <button
            onClick={startRecording}
            className="px-3.5 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
          >
            <Mic className="w-3.5 h-3.5" />
            <span>Gravar Voz</span>
          </button>
        </div>
      )}
    </div>
  );
};
