import React, { useState } from 'react';
import { Video, Play, Trash2, ExternalLink, AlertCircle, Check } from 'lucide-react';

interface VideoEmbedPlayerProps {
  initialUrl?: string;
  caption?: string;
  onSave: (url: string, caption?: string) => void;
  onDelete?: () => void;
}

export const VideoEmbedPlayer: React.FC<VideoEmbedPlayerProps> = ({
  initialUrl = '',
  caption: initialCaption = '',
  onSave,
  onDelete
}) => {
  const [urlInput, setUrlInput] = useState(initialUrl);
  const [captionInput, setCaptionInput] = useState(initialCaption);
  const [isEditing, setIsEditing] = useState(!initialUrl);
  const [videoUrl, setVideoUrl] = useState(initialUrl);

  const getEmbedUrl = (rawUrl: string): { type: 'youtube' | 'vimeo' | 'direct' | 'unsupported'; embedUrl: string } => {
    if (!rawUrl) return { type: 'unsupported', embedUrl: '' };
    const clean = rawUrl.trim();

    // YouTube Matchers
    const ytMatch = clean.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/i);
    if (ytMatch && ytMatch[1]) {
      return { type: 'youtube', embedUrl: `https://www.youtube-nocookie.com/embed/${ytMatch[1]}` };
    }

    // Vimeo Matchers
    const vimeoMatch = clean.match(/vimeo\.com\/(?:video\/)?(\d+)/i);
    if (vimeoMatch && vimeoMatch[1]) {
      return { type: 'vimeo', embedUrl: `https://player.vimeo.com/video/${vimeoMatch[1]}` };
    }

    // Direct MP4 / WebM / OGG
    if (/\.(mp4|webm|ogg|mov)(\?.*)?$/i.test(clean) || clean.startsWith('data:video/')) {
      return { type: 'direct', embedUrl: clean };
    }

    return { type: 'direct', embedUrl: clean };
  };

  const handleApply = (e: React.FormEvent) => {
    e.preventDefault();
    if (!urlInput.trim()) return;
    setVideoUrl(urlInput.trim());
    setIsEditing(false);
    onSave(urlInput.trim(), captionInput.trim());
  };

  const parsed = getEmbedUrl(videoUrl);

  return (
    <div className="bg-gray-50 dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700/80 rounded-2xl p-4 my-3 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-red-100 dark:bg-red-950/60 text-red-600 dark:text-red-400">
            <Video className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-gray-900 dark:text-gray-100 uppercase tracking-wider">Vídeo de Estudo</h4>
            <p className="text-[11px] text-gray-500 dark:text-gray-400">Suporta YouTube, Vimeo, Loom ou link direto MP4</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {videoUrl && !isEditing && (
            <button
              onClick={() => setIsEditing(true)}
              className="px-2.5 py-1 text-xs font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              Editar Link
            </button>
          )}
          {onDelete && (
            <button
              onClick={onDelete}
              className="p-1.5 text-gray-400 hover:text-rose-500 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
              title="Remover vídeo"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {isEditing ? (
        <form onSubmit={handleApply} className="bg-white dark:bg-gray-900 p-4 rounded-xl border border-gray-200 dark:border-gray-700 space-y-3">
          <div>
            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
              URL do Vídeo (YouTube, Vimeo, MP4)
            </label>
            <input
              type="url"
              placeholder="https://www.youtube.com/watch?v=..."
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              className="w-full px-3.5 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500 font-mono"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
              Legenda / Descrição (Opcional)
            </label>
            <input
              type="text"
              placeholder="Ex: Fisiopatologia da Estenose Aórtica - Ninja Nerd"
              value={captionInput}
              onChange={(e) => setCaptionInput(e.target.value)}
              className="w-full px-3.5 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            {videoUrl && (
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                Cancelar
              </button>
            )}
            <button
              type="submit"
              className="px-4 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 cursor-pointer"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Incorporar Vídeo</span>
            </button>
          </div>
        </form>
      ) : (
        <div className="space-y-2">
          <div className="relative aspect-video rounded-xl overflow-hidden bg-black border border-gray-800 shadow-md">
            {parsed.type === 'youtube' || parsed.type === 'vimeo' ? (
              <iframe
                src={parsed.embedUrl}
                title="Video Player"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="w-full h-full border-0"
              />
            ) : (
              <video
                src={parsed.embedUrl}
                controls
                className="w-full h-full object-contain"
              >
                Seu navegador não suporta este formato de vídeo.
              </video>
            )}
          </div>

          {captionInput && (
            <p className="text-xs text-gray-600 dark:text-gray-300 italic px-1 text-center">
              {captionInput}
            </p>
          )}
        </div>
      )}
    </div>
  );
};
