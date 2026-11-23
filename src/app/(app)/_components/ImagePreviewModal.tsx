"use client";

import { useState, useEffect, useCallback } from "react";
import {
  X,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  FileImage,
} from "lucide-react";

export type PreviewImage = {
  id: string;
  url: string;
  filename?: string | null;
  uploadedAt?: string | null;
};

export default function ImagePreviewModal({
  images,
  initialIndex = 0,
  onClose,
}: {
  images: PreviewImage[];
  initialIndex?: number;
  onClose: () => void;
}) {
  const [currentIndex, setCurrentIndex] = useState(
    Math.max(0, Math.min(initialIndex, images.length - 1))
  );
  const [scale, setScale] = useState(1);
  const [fitMode, setFitMode] = useState<"contain" | "original">("contain");

  const currentImage = images[currentIndex];
  const hasMultiple = images.length > 1;

  // Reset zoom on slide change
  useEffect(() => {
    setScale(1);
    setFitMode("contain");
  }, [currentIndex]);

  const handleNext = useCallback(() => {
    setCurrentIndex((prev) => (prev < images.length - 1 ? prev + 1 : 0));
  }, [images.length]);

  const handlePrev = useCallback(() => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : images.length - 1));
  }, [images.length]);

  const handleZoomIn = () => setScale((s) => Math.min(3, s + 0.25));
  const handleZoomOut = () => setScale((s) => Math.max(0.5, s - 0.25));
  const handleResetZoom = () => setScale(1);

  // Keyboard navigation & escape listener
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "ArrowRight") {
        if (hasMultiple) handleNext();
      } else if (e.key === "ArrowLeft") {
        if (hasMultiple) handlePrev();
      } else if (e.key === "+" || e.key === "=") {
        handleZoomIn();
      } else if (e.key === "-") {
        handleZoomOut();
      } else if (e.key === "0") {
        handleResetZoom();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleNext, handlePrev, hasMultiple, onClose]);

  if (!currentImage) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-between bg-black/95 text-white backdrop-blur-md select-none animate-in fade-in duration-200"
      onClick={onClose}
    >
      {/* Top Bar: Title, Counter & Controls */}
      <div
        className="flex w-full items-center justify-between px-4 py-3 bg-gradient-to-b from-black/80 to-transparent z-10"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <FileImage size={18} className="text-blue-400 shrink-0" />
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-white truncate max-w-xs sm:max-w-md">
              {currentImage.filename || "Image Preview"}
            </h3>
            {hasMultiple && (
              <span className="text-xs text-slate-400">
                Image {currentIndex + 1} of {images.length}
              </span>
            )}
          </div>
        </div>

        {/* Zoom & Action Controls */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Zoom Out */}
          <button
            type="button"
            onClick={handleZoomOut}
            disabled={scale <= 0.5}
            className="rounded-lg p-2 text-slate-300 hover:bg-white/10 hover:text-white disabled:opacity-30 transition"
            title="Zoom out (-)"
          >
            <ZoomOut size={16} />
          </button>

          {/* Zoom % label */}
          <button
            type="button"
            onClick={handleResetZoom}
            className="px-2 py-1 text-xs font-mono font-medium rounded-lg bg-white/10 hover:bg-white/20 text-slate-200 transition"
            title="Reset Zoom (0)"
          >
            {Math.round(scale * 100)}%
          </button>

          {/* Zoom In */}
          <button
            type="button"
            onClick={handleZoomIn}
            disabled={scale >= 3}
            className="rounded-lg p-2 text-slate-300 hover:bg-white/10 hover:text-white disabled:opacity-30 transition"
            title="Zoom in (+)"
          >
            <ZoomIn size={16} />
          </button>

          {/* Close Button */}
          <button
            type="button"
            onClick={onClose}
            className="ml-2 rounded-xl bg-white/10 p-2 text-slate-300 hover:bg-red-500 hover:text-white transition"
            title="Close (Esc)"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Main Image Stage */}
      <div
        className="relative flex flex-1 w-full items-center justify-center overflow-hidden p-4"
        onClick={(e) => {
          // If clicking outside the image element itself, close
          if (e.target === e.currentTarget) onClose();
        }}
      >
        {/* Previous Navigation Button */}
        {hasMultiple && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handlePrev();
            }}
            className="absolute left-4 z-20 rounded-full bg-black/60 p-2.5 text-white/80 hover:bg-black/90 hover:text-white backdrop-blur-xs transition active:scale-95 shadow-lg"
            title="Previous (Left arrow)"
          >
            <ChevronLeft size={24} />
          </button>
        )}

        {/* The Preview Image */}
        <div
          className="flex items-center justify-center transition-transform duration-150 ease-out"
          style={{ transform: `scale(${scale})` }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={currentImage.url}
            alt={currentImage.filename || "Attached Image"}
            draggable={false}
            onContextMenu={(e) => e.preventDefault()}
            className="max-h-[82vh] max-w-[88vw] rounded-lg object-contain shadow-2xl transition-all select-none"
          />
        </div>

        {/* Next Navigation Button */}
        {hasMultiple && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleNext();
            }}
            className="absolute right-4 z-20 rounded-full bg-black/60 p-2.5 text-white/80 hover:bg-black/90 hover:text-white backdrop-blur-xs transition active:scale-95 shadow-lg"
            title="Next (Right arrow)"
          >
            <ChevronRight size={24} />
          </button>
        )}
      </div>

      {/* Bottom Thumbnail Strip (if multiple images) */}
      {hasMultiple && (
        <div
          className="flex items-center justify-center gap-2 overflow-x-auto px-4 py-3 bg-gradient-to-t from-black/80 to-transparent w-full z-10"
          onClick={(e) => e.stopPropagation()}
        >
          {images.map((img, idx) => (
            <button
              key={img.id || idx}
              type="button"
              onClick={() => setCurrentIndex(idx)}
              className={`relative h-12 w-12 shrink-0 overflow-hidden rounded-lg border-2 transition ${
                currentIndex === idx
                  ? "border-blue-500 scale-105 shadow-md shadow-blue-500/30"
                  : "border-transparent opacity-50 hover:opacity-100"
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={img.url}
                alt={img.filename || `Thumb ${idx + 1}`}
                draggable={false}
                onContextMenu={(e) => e.preventDefault()}
                className="h-full w-full object-cover select-none"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
