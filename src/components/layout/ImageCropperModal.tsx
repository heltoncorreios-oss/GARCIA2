import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Crop,
  RotateCw,
  ZoomIn,
  ZoomOut,
  Move,
  Check,
  X,
  RefreshCw,
  Maximize2,
  Minimize2,
  Palette
} from 'lucide-react';

interface ImageCropperModalProps {
  isOpen: boolean;
  imageSrc: string | null;
  onClose: () => void;
  onCropComplete: (croppedImageBase64: string) => void;
}

export const ImageCropperModal: React.FC<ImageCropperModalProps> = ({
  isOpen,
  imageSrc,
  onClose,
  onCropComplete
}) => {
  const [scale, setScale] = useState<number>(1);
  const [offsetX, setOffsetX] = useState<number>(0);
  const [offsetY, setOffsetY] = useState<number>(0);
  const [rotation, setRotation] = useState<number>(0); // 0, 90, 180, 270
  const [bgColor, setBgColor] = useState<'transparent' | 'white' | 'dark' | 'black'>('transparent');
  const [aspectRatio, setAspectRatio] = useState<'1:1' | '2:1' | '3:1' | '4:3'>('2:1');
  
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [imageObj, setImageObj] = useState<HTMLImageElement | null>(null);

  // Load image object when imageSrc changes
  useEffect(() => {
    if (!imageSrc) return;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = imageSrc;
    img.onload = () => {
      setImageObj(img);
      // Auto initial scale to fit nicely
      setScale(1);
      setOffsetX(0);
      setOffsetY(0);
      setRotation(0);
    };
  }, [imageSrc]);

  // Output Canvas dimensions
  const getOutputDimensions = useCallback(() => {
    switch (aspectRatio) {
      case '1:1':
        return { width: 400, height: 400 };
      case '2:1':
        return { width: 500, height: 250 };
      case '3:1':
        return { width: 600, height: 200 };
      case '4:3':
        return { width: 480, height: 360 };
      default:
        return { width: 500, height: 250 };
    }
  }, [aspectRatio]);

  // Render canvas
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !imageObj) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { width, height } = getOutputDimensions();
    canvas.width = width;
    canvas.height = height;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Background fill
    if (bgColor === 'white') {
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, width, height);
    } else if (bgColor === 'dark') {
      ctx.fillStyle = '#18181C';
      ctx.fillRect(0, 0, width, height);
    } else if (bgColor === 'black') {
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, width, height);
    }

    ctx.save();
    // Translate origin to canvas center
    ctx.translate(width / 2 + offsetX, height / 2 + offsetY);
    // Rotate
    ctx.rotate((rotation * Math.PI) / 180);

    // Calculate base auto-fit factor
    const fitScale = Math.min(width / imageObj.width, height / imageObj.height);
    const finalScale = fitScale * scale;

    ctx.scale(finalScale, finalScale);

    // Draw centered
    ctx.drawImage(
      imageObj,
      -imageObj.width / 2,
      -imageObj.height / 2
    );

    ctx.restore();
  }, [imageObj, scale, offsetX, offsetY, rotation, bgColor, getOutputDimensions]);

  useEffect(() => {
    if (isOpen && imageObj) {
      draw();
    }
  }, [isOpen, imageObj, draw]);

  if (!isOpen || !imageSrc) return null;

  // Mouse pan event handlers
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - offsetX, y: e.clientY - offsetY });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    setOffsetX(e.clientX - dragStart.x);
    setOffsetY(e.clientY - dragStart.y);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleReset = () => {
    setScale(1);
    setOffsetX(0);
    setOffsetY(0);
    setRotation(0);
  };

  const handleApply = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const base64 = canvas.toDataURL('image/png');
    onCropComplete(base64);
    onClose();
  };

  const { width: previewW, height: previewH } = getOutputDimensions();

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-white border border border-black rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-4 border-b border border-black flex items-center justify-between bg-[#101014]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-orange-500/10 text-orange-700 font-bold border border-orange-500/20 flex items-center justify-center">
              <Crop className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-zinc-950 font-bold">
                Redimensionar & Ajustar Logotipo
              </h3>
              <p className="text-[11px] text-zinc-900 font-semibold">
                Ajuste o zoom, posição, rotação e fundo para um enquadramento perfeito
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-zinc-900 font-semibold hover:text-zinc-950 font-bold hover:bg-white/5 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body Content */}
        <div className="p-5 space-y-5 overflow-y-auto flex-1">
          {/* Interactive Canvas Preview Area */}
          <div className="flex flex-col items-center justify-center">
            <div className="text-[11px] font-semibold text-zinc-900 font-semibold mb-2 flex items-center gap-1">
              <Move className="w-3.5 h-3.5 text-orange-700 font-bold" />
              <span>Clique e arraste a imagem abaixo para reposicionar:</span>
            </div>

            <div
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              className={`relative border-2 border-dashed border-orange-500/40 rounded-xl overflow-hidden cursor-grab active:cursor-grabbing bg-[#0a0a0d] shadow-inner flex items-center justify-center transition-all ${
                bgColor === 'transparent' ? 'checkerboard-bg' : ''
              }`}
              style={{
                width: '100%',
                maxWidth: '460px',
                aspectRatio: `${previewW} / ${previewH}`
              }}
            >
              <canvas
                ref={canvasRef}
                className="w-full h-full object-contain pointer-events-none"
              />
            </div>

            <div className="text-[10px] text-zinc-800 font-medium mt-1.5">
              Dimensão de Saída: <span className="text-zinc-950 font-bold font-mono">{previewW}x{previewH}px</span>
            </div>
          </div>

          {/* Controls Grid */}
          <div className="bg-white border border border-black rounded-2xl p-4 space-y-4">
            {/* Scale / Zoom Slider */}
            <div>
              <div className="flex items-center justify-between text-xs font-semibold text-zinc-950 font-bold mb-1.5">
                <span className="flex items-center gap-1.5">
                  <ZoomIn className="w-3.5 h-3.5 text-orange-700 font-bold" />
                  <span>Tamanho / Zoom:</span>
                </span>
                <span className="text-orange-700 font-bold font-mono font-bold">
                  {Math.round(scale * 100)}%
                </span>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setScale((prev) => Math.max(0.2, prev - 0.1))}
                  className="p-1.5 bg-white/5 hover:bg-white/10 text-zinc-950 font-bold rounded-lg text-xs"
                  title="Diminuir"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <input
                  type="range"
                  min="0.2"
                  max="3.5"
                  step="0.05"
                  value={scale}
                  onChange={(e) => setScale(parseFloat(e.target.value))}
                  className="flex-1 accent-orange-500 h-1.5 bg-zinc-800 rounded-lg cursor-pointer"
                />
                <button
                  type="button"
                  onClick={() => setScale((prev) => Math.min(3.5, prev + 0.1))}
                  className="p-1.5 bg-white/5 hover:bg-white/10 text-zinc-950 font-bold rounded-lg text-xs"
                  title="Aumentar"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Quick Actions & Rotation */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              {/* Aspect Ratio Options */}
              <div>
                <label className="block text-[11px] font-semibold text-zinc-900 font-semibold mb-1.5">
                  Formato da Imagem:
                </label>
                <div className="grid grid-cols-4 gap-1.5">
                  {(['2:1', '1:1', '3:1', '4:3'] as const).map((ratio) => (
                    <button
                      key={ratio}
                      type="button"
                      onClick={() => setAspectRatio(ratio)}
                      className={`px-2 py-1.5 text-xs font-bold rounded-lg border transition-all ${
                        aspectRatio === ratio
                          ? 'bg-orange-500/20 border-orange-500/50 text-orange-700 font-bold'
                          : 'bg-white/5 border border-black text-zinc-900 font-semibold hover:text-white'
                      }`}
                    >
                      {ratio}
                    </button>
                  ))}
                </div>
              </div>

              {/* Background Color */}
              <div>
                <label className="block text-[11px] font-semibold text-zinc-900 font-semibold mb-1.5 flex items-center gap-1">
                  <Palette className="w-3 h-3 text-orange-700 font-bold" />
                  <span>Fundo da Imagem:</span>
                </label>
                <div className="grid grid-cols-4 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setBgColor('transparent')}
                    className={`px-1.5 py-1.5 text-[10px] font-bold rounded-lg border transition-all ${
                      bgColor === 'transparent'
                        ? 'bg-orange-500/20 border-orange-500/50 text-orange-700 font-bold'
                        : 'bg-white/5 border border-black text-zinc-900 font-semibold'
                    }`}
                  >
                    Transp.
                  </button>
                  <button
                    type="button"
                    onClick={() => setBgColor('white')}
                    className={`px-1.5 py-1.5 text-[10px] font-bold rounded-lg border transition-all ${
                      bgColor === 'white'
                        ? 'bg-white text-black border-white'
                        : 'bg-white/10 border border-black text-zinc-950 font-bold'
                    }`}
                  >
                    Branco
                  </button>
                  <button
                    type="button"
                    onClick={() => setBgColor('dark')}
                    className={`px-1.5 py-1.5 text-[10px] font-bold rounded-lg border transition-all ${
                      bgColor === 'dark'
                        ? 'bg-zinc-800 border-orange-500 text-orange-700 font-bold'
                        : 'bg-white/5 border border-black text-zinc-900 font-semibold'
                    }`}
                  >
                    Escuro
                  </button>
                  <button
                    type="button"
                    onClick={() => setBgColor('black')}
                    className={`px-1.5 py-1.5 text-[10px] font-bold rounded-lg border transition-all ${
                      bgColor === 'black'
                        ? 'bg-black border-orange-500 text-orange-700 font-bold'
                        : 'bg-white/5 border border-black text-zinc-900 font-semibold'
                    }`}
                  >
                    Preto
                  </button>
                </div>
              </div>
            </div>

            {/* Rotation and Reset */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border border-black">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setRotation((prev) => (prev + 90) % 360)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 text-zinc-950 font-bold text-xs font-semibold rounded-lg border border border-black transition-colors"
                >
                  <RotateCw className="w-3.5 h-3.5 text-orange-700 font-bold" />
                  <span>Girar 90°</span>
                </button>

                <button
                  type="button"
                  onClick={handleReset}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 text-zinc-900 font-semibold hover:text-white text-xs font-semibold rounded-lg transition-colors"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Resetar Ajustes</span>
                </button>
              </div>

              <div className="text-[11px] text-zinc-800 font-medium italic">
                * Dica: use o mouse para centralizar o logotipo
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border border-black bg-[#101014] flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-zinc-900 font-semibold hover:text-white rounded-xl transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleApply}
            className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-bold text-white bg-orange-600 hover:bg-orange-500 rounded-xl shadow-md transition-colors cursor-pointer"
          >
            <Check className="w-4 h-4" />
            <span>Aplicar Redimensionamento</span>
          </button>
        </div>
      </div>
    </div>
  );
};
