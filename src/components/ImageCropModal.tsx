'use client';

import React, { useState, useRef, useCallback } from 'react';
import { X, Check, RotateCw, ZoomIn, ZoomOut, Crop } from 'lucide-react';

interface ImageCropModalProps {
  imageSrc: string;
  initialAspectRatio?: AspectRatioType;
  title?: string;
  onCropComplete: (croppedDataUrl: string) => void | Promise<void>;
  onCancel: () => void;
}

type AspectRatioType = '1:1' | '4:3' | '16:9' | 'free';

export default function ImageCropModal({
  imageSrc,
  initialAspectRatio = '1:1',
  title = 'ตัดขอบ & ปรับตำแหน่งรูป',
  onCropComplete,
  onCancel,
}: ImageCropModalProps) {
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [aspectRatio, setAspectRatio] = useState<AspectRatioType>(initialAspectRatio);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [imageReady, setImageReady] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const savingRef = useRef(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  // Determine crop box size based on aspect ratio
  const getCropBoxDimensions = useCallback(() => {
    const maxWidth = 280;
    switch (aspectRatio) {
      case '1:1':
        return { width: maxWidth, height: maxWidth };
      case '4:3':
        return { width: maxWidth, height: Math.round(maxWidth * (3 / 4)) };
      case '16:9':
        return { width: maxWidth, height: Math.round(maxWidth * (9 / 16)) };
      case 'free':
        return { width: maxWidth, height: maxWidth };
      default:
        return { width: maxWidth, height: maxWidth };
    }
  }, [aspectRatio]);

  const cropBox = getCropBoxDimensions();

  // Mouse & Touch Dragging handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPan({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      setIsDragging(true);
      setDragStart({
        x: e.touches[0].clientX - pan.x,
        y: e.touches[0].clientY - pan.y,
      });
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging || e.touches.length !== 1) return;
    setPan({
      x: e.touches[0].clientX - dragStart.x,
      y: e.touches[0].clientY - dragStart.y,
    });
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
  };

  const handleRotate = () => {
    setRotation((prev) => (prev + 90) % 360);
  };

  // Perform crop on HTML5 Canvas
  const handleApplyCrop = async () => {
    const img = imgRef.current;
    if (!img || !imageReady || !img.naturalWidth || savingRef.current) return;
    savingRef.current = true;
    setIsSaving(true);
    setError(null);
    try {

      // Create offscreen canvas for rendering the cropped output
      const outputCanvas = document.createElement('canvas');
      const OUTPUT_SIZE = 500; // Standard high-quality size
      outputCanvas.width = OUTPUT_SIZE;
      outputCanvas.height = Math.round(OUTPUT_SIZE * (cropBox.height / cropBox.width));

      const ctx = outputCanvas.getContext('2d');
      if (!ctx) throw new Error('ไม่สามารถประมวลผลรูปภาพได้ กรุณาลองใหม่');

      // Natural image dimensions
      const naturalWidth = img.naturalWidth;
      const naturalHeight = img.naturalHeight;

      // The scale of the image in the preview viewport
      // Current displayed size
      const renderedWidth = cropBox.width * zoom;
      const renderedHeight = naturalHeight * (cropBox.width / naturalWidth) * zoom;

      // Canvas center
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, outputCanvas.width, outputCanvas.height);

      ctx.save();
      // Move to center of output canvas
      ctx.translate(outputCanvas.width / 2, outputCanvas.height / 2);

      // Scale factor from preview box to output canvas
      const scaleFactor = outputCanvas.width / cropBox.width;
      ctx.translate(pan.x * scaleFactor, pan.y * scaleFactor);
      ctx.rotate((rotation * Math.PI) / 180);

      // Draw rotated and scaled image
      const drawWidth = renderedWidth * scaleFactor;
      const drawHeight = renderedHeight * scaleFactor;
      const drawX = -drawWidth / 2;
      const drawY = -drawHeight / 2;

      ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight);
      ctx.restore();

      // Export as clean compressed JPEG
      const croppedDataUrl = outputCanvas.toDataURL('image/jpeg', 0.82);
      await onCropComplete(croppedDataUrl);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'บันทึกรูปภาพไม่สำเร็จ กรุณาลองใหม่');
    } finally {
      savingRef.current = false;
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/85 backdrop-blur-md flex items-center justify-center p-3 animate-in fade-in">
      <fieldset disabled={isSaving} aria-busy={isSaving} className="bg-slate-900 text-white rounded-3xl w-full min-w-0 max-w-sm overflow-hidden shadow-2xl border border-slate-700 flex flex-col">
        
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Crop className="w-5 h-5 text-amber-500" />
            <div>
              <h3 className="font-bold text-sm leading-tight">{title}</h3>
              <p className="text-[10px] text-gray-400">ลากเพื่อย้าย • เลื่อนเพื่อซูม</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-gray-300 flex items-center justify-center transition active:scale-95"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Aspect Ratio Selector */}
        <div className="flex justify-center gap-1.5 p-2 bg-slate-950/60 border-b border-slate-800/80">
          {(['1:1', '4:3', '16:9'] as AspectRatioType[]).map((ratio) => (
            <button
              key={ratio}
              type="button"
              onClick={() => {
                setAspectRatio(ratio);
                setPan({ x: 0, y: 0 });
              }}
              className={`px-3 py-1 rounded-xl text-xs font-bold transition ${
                aspectRatio === ratio
                  ? 'bg-amber-500 text-white shadow-xs'
                  : 'bg-slate-800 text-gray-400 hover:text-white'
              }`}
            >
              {ratio === '1:1' ? '1:1 จัตุรัส' : ratio === '4:3' ? '4:3 แนวนอน' : '16:9 ไวด์'}
            </button>
          ))}
        </div>

        {/* Viewport Area */}
        <div
          ref={containerRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onMouseLeave={handleMouseUp}
          onTouchCancel={handleTouchEnd}
          style={{ touchAction: 'none', pointerEvents: isSaving ? 'none' : undefined }}
          className="relative w-full h-80 bg-slate-950 flex items-center justify-center overflow-hidden cursor-grab active:cursor-grabbing select-none"
        >
          {/* Background image manipulated by zoom, rotate, pan */}
          <img
            ref={imgRef}
            src={imageSrc}
            alt="Source"
            onLoad={() => { setImageReady(true); setError(null); }}
            onError={() => { setImageReady(false); setError('เปิดรูปภาพนี้ไม่ได้ กรุณาเลือกรูป JPG, PNG หรือ WebP ใหม่'); }}
            draggable={false}
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) rotate(${rotation}deg) scale(${zoom})`,
              transformOrigin: 'center center',
              maxWidth: 'none',
              maxHeight: 'none',
              flexShrink: 0,
              width: cropBox.width,
              height: 'auto',
              transition: isDragging ? 'none' : 'transform 0.1s ease-out',
            }}
            className="pointer-events-none"
          />

          {/* Dark Overlay around crop box */}
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            <div
              style={{
                width: cropBox.width,
                height: cropBox.height,
                boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.65)',
              }}
              className="border-2 border-amber-400 rounded-2xl relative shadow-lg"
            >
              {/* Rule-of-thirds grid */}
              <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 pointer-events-none opacity-25">
                <div className="border-r border-b border-white"></div>
                <div className="border-r border-b border-white"></div>
                <div className="border-b border-white"></div>
                <div className="border-r border-b border-white"></div>
                <div className="border-r border-b border-white"></div>
                <div className="border-b border-white"></div>
                <div className="border-r border-white"></div>
                <div className="border-r border-white"></div>
                <div></div>
              </div>

              {/* Corner indicators */}
              <div className="absolute -top-1 -left-1 w-3 h-3 border-t-2 border-l-2 border-amber-400"></div>
              <div className="absolute -top-1 -right-1 w-3 h-3 border-t-2 border-r-2 border-amber-400"></div>
              <div className="absolute -bottom-1 -left-1 w-3 h-3 border-b-2 border-l-2 border-amber-400"></div>
              <div className="absolute -bottom-1 -right-1 w-3 h-3 border-b-2 border-r-2 border-amber-400"></div>

              <div className="absolute bottom-2 left-0 right-0 text-center pointer-events-none">
                <span className="text-[10px] bg-black/60 px-2 py-0.5 rounded-full text-white/80 font-medium">
                  ลากจัดตำแหน่งในกรอบ
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Controls Toolbar: Zoom, Rotate */}
        <div className="p-3.5 bg-slate-950 border-t border-slate-800 space-y-3">
          {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
          {isSaving && <p role="status" className="text-sm text-amber-300">กำลังบันทึกรูปภาพ…</p>}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setZoom((z) => Math.max(0.6, z - 0.2))}
              className="p-1.5 text-gray-400 hover:text-white rounded-lg bg-slate-800"
              title="ซูมออก"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <input
              type="range"
              min="0.6"
              max="3"
              step="0.05"
              value={zoom}
              onChange={(e) => setZoom(parseFloat(e.target.value))}
              className="flex-1 accent-amber-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
            />
            <button
              type="button"
              onClick={() => setZoom((z) => Math.min(3, z + 0.2))}
              className="p-1.5 text-gray-400 hover:text-white rounded-lg bg-slate-800"
              title="ซูมเข้า"
            >
              <ZoomIn className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={handleRotate}
              className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-gray-300 font-bold flex items-center gap-1 active:scale-95 transition"
              title="หมุนรูปภาพ 90 องศา"
            >
              <RotateCw className="w-3.5 h-3.5 text-amber-400" />
              <span>หมุน</span>
            </button>
          </div>

          {/* Action buttons */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 py-2.5 rounded-xl border border-slate-700 text-gray-300 font-bold text-xs hover:bg-slate-800 transition"
            >
              ยกเลิก
            </button>
            <button
              type="button"
              onClick={handleApplyCrop}
              disabled={!imageReady || isSaving}
              className="flex-2 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 text-white font-black text-xs rounded-xl shadow-lg flex items-center justify-center gap-1.5 active:scale-95 transition"
            >
              <Check className="w-4 h-4" />
              <span>{isSaving ? 'กำลังบันทึก…' : 'ตัดขอบ & ใช้รูปนี้'}</span>
            </button>
          </div>
        </div>

      </fieldset>
    </div>
  );
}
