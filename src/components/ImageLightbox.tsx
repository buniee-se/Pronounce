import React, { useEffect } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { SavedImage } from '../types/journal';

interface ImageLightboxProps {
  images: SavedImage[];
  activeIndex: number;
  onClose: () => void;
  onNavigate: (nextIndex: number) => void;
}

export const ImageLightbox: React.FC<ImageLightboxProps> = ({
  images,
  activeIndex,
  onClose,
  onNavigate,
}) => {
  const current = images[activeIndex];

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight' && images.length > 1) {
        onNavigate((activeIndex + 1) % images.length);
      }
      if (e.key === 'ArrowLeft' && images.length > 1) {
        onNavigate((activeIndex - 1 + images.length) % images.length);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [activeIndex, images.length, onClose, onNavigate]);

  if (!current) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Photo preview"
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#141311]/85 p-4 backdrop-blur-xs"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative flex max-h-[90vh] w-full max-w-4xl flex-col items-center"
      >
        {/* Top bar */}
        <div className="mb-3 flex w-full items-center justify-between text-xs text-[#E5E0D6]">
          <span className="font-mono tabular-nums">
            {activeIndex + 1} / {images.length}
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close photo preview"
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 text-white transition-colors hover:bg-white/20"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Image frame */}
        <div className="relative flex w-full items-center justify-center">
          {images.length > 1 && (
            <button
              type="button"
              onClick={() => onNavigate((activeIndex - 1 + images.length) % images.length)}
              aria-label="Previous photo"
              className="absolute left-2 z-10 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[#141311]/70 text-white transition-colors hover:bg-[#141311]/90"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
          )}

          <img
            src={current.dataUrl}
            alt={current.caption || 'Study snapshot'}
            className="max-h-[76vh] max-w-full rounded-2xl border border-white/10 object-contain shadow-2xl"
          />

          {images.length > 1 && (
            <button
              type="button"
              onClick={() => onNavigate((activeIndex + 1) % images.length)}
              aria-label="Next photo"
              className="absolute right-2 z-10 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[#141311]/70 text-white transition-colors hover:bg-[#141311]/90"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          )}
        </div>

        {current.caption && (
          <p className="mt-3 max-w-xl text-center text-sm text-[#EFECE6]">
            {current.caption}
          </p>
        )}
      </div>
    </div>
  );
};
