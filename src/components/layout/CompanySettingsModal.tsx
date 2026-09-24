import React, { useState, useRef, useEffect } from 'react';
import {
  Building2,
  Upload,
  Image as ImageIcon,
  Trash2,
  X,
  Check,
  Sparkles,
  Link,
  ShieldCheck,
  AlertCircle,
  Crop
} from 'lucide-react';
import { CompanyProfile } from '../../types';
import { ImageCropperModal } from './ImageCropperModal';

interface CompanySettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  companyProfile: CompanyProfile;
  onSaveProfile: (profile: CompanyProfile) => void;
}

export const CompanySettingsModal: React.FC<CompanySettingsModalProps> = ({
  isOpen,
  onClose,
  companyProfile,
  onSaveProfile
}) => {
  const [name, setName] = useState(companyProfile.name || 'Supermercado Central');
  const [subtitle, setSubtitle] = useState(
    companyProfile.subtitle || 'Gestão Financeira'
  );
  const [logoUrl, setLogoUrl] = useState<string | null>(companyProfile.logoUrl || null);
  const [cnpj, setCnpj] = useState(companyProfile.cnpj || '');
  const [badge, setBadge] = useState(companyProfile.badge || 'FINANCEIRO');
  const [urlInput, setUrlInput] = useState('');
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Cropper state
  const [isCropperOpen, setIsCropperOpen] = useState(false);
  const [cropperImage, setCropperImage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setName(companyProfile.name || 'Supermercado Central');
      setSubtitle(companyProfile.subtitle || 'Gestão Financeira');
      setLogoUrl(companyProfile.logoUrl || null);
      setCnpj(companyProfile.cnpj || '');
      setBadge(companyProfile.badge || 'FINANCEIRO');
      setErrorMsg(null);
    }
  }, [isOpen, companyProfile]);

  if (!isOpen) return null;

  const handleFileProcess = (file: File) => {
    setErrorMsg(null);
    const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/svg+xml', 'image/gif'];
    if (!validTypes.includes(file.type) && !file.name.match(/\.(png|jpe?g|webp|svg|gif)$/i)) {
      setErrorMsg('Formato inválido! Envie uma imagem nos formatos .PNG, .JPG, .JPEG, .WEBP ou .SVG.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setErrorMsg('A imagem é muito grande. Escolha uma imagem de até 5MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      setCropperImage(result);
      setIsCropperOpen(true);
    };
    reader.onerror = () => {
      setErrorMsg('Erro ao carregar o arquivo de imagem.');
    };
    reader.readAsDataURL(file);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileProcess(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileProcess(e.target.files[0]);
    }
  };

  const handleApplyUrl = () => {
    if (!urlInput.trim()) return;
    setCropperImage(urlInput.trim());
    setIsCropperOpen(true);
    setUrlInput('');
    setShowUrlInput(false);
  };

  const handleRemoveLogo = () => {
    setLogoUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSave = () => {
    if (!name.trim()) {
      setErrorMsg('O nome do estabelecimento é obrigatório.');
      return;
    }
    onSaveProfile({
      name: name.trim(),
      subtitle: subtitle.trim(),
      logoUrl: logoUrl || null,
      cnpj: cnpj.trim() || undefined,
      badge: badge.trim() || 'FINANCEIRO'
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white border border-zinc-200 rounded-2xl max-w-xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border-zinc-200 flex items-center justify-between bg-zinc-50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-orange-100 text-orange-600 border border-orange-200 flex items-center justify-center">
              <ImageIcon className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-zinc-950">
                Logotipo & Dados do Estabelecimento
              </h3>
              <p className="text-xs text-zinc-600">
                Personalize o logo da empresa (.png, .jpg, .jpeg) e os títulos do cabeçalho
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-zinc-500 hover:text-zinc-950 hover:bg-zinc-100 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body content */}
        <div className="p-6 space-y-6 overflow-y-auto">
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Logo Upload Slot */}
          <div className="space-y-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-zinc-950">
              Espaço para Logotipo do Estabelecimento (.png, .jpg, .jpeg)
            </label>

            <div
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              className={`relative border-2 border-dashed rounded-2xl p-4 transition-all flex flex-col sm:flex-row items-center gap-4 ${
                dragActive
                  ? 'border-orange-500 bg-orange-50'
                  : logoUrl
                  ? 'border-zinc-200 bg-slate-50/60'
                  : 'border-zinc-200 hover:border-zinc-300 bg-slate-50/60'
              }`}
            >
              {/* Logo Preview Box */}
              <div className="w-24 h-24 rounded-xl bg-white border border-zinc-200 flex items-center justify-center overflow-hidden shrink-0 relative group shadow-2xs">
                {logoUrl ? (
                  <img
                    src={logoUrl}
                    alt="Logo do Estabelecimento"
                    className="w-full h-full object-contain p-1.5"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center text-zinc-400">
                    <Building2 className="w-8 h-8 text-zinc-400 mb-1" />
                    <span className="text-[9px] uppercase font-bold text-zinc-500">Sem Logo</span>
                  </div>
                )}
              </div>

              {/* Upload controls */}
              <div className="flex-1 text-center sm:text-left space-y-2 w-full">
                <div>
                  <h4 className="text-xs font-bold text-zinc-950">
                    {logoUrl ? 'Logotipo Carregado' : 'Selecione ou arraste a imagem do logo'}
                  </h4>
                  <p className="text-[11px] text-zinc-600">
                    Suporta imagens em alta resolução: PNG com fundo transparente, JPG ou JPEG.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-1 justify-center sm:justify-start">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png, image/jpeg, image/jpg, image/webp, image/svg+xml"
                    onChange={handleFileChange}
                    className="hidden"
                    id="logo-file-input"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>{logoUrl ? 'Trocar Imagem' : 'Escolher Imagem (.png, .jpg)'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowUrlInput(!showUrlInput)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-zinc-800 text-xs font-semibold rounded-xl border border-zinc-200 transition-colors cursor-pointer"
                  >
                    <Link className="w-3.5 h-3.5" />
                    <span>URL da Web</span>
                  </button>

                  {logoUrl && (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setCropperImage(logoUrl);
                          setIsCropperOpen(true);
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-orange-50 hover:bg-orange-100 text-orange-800 text-xs font-bold rounded-xl border border-orange-200 transition-colors cursor-pointer"
                      >
                        <Crop className="w-3.5 h-3.5" />
                        <span>Redimensionar / Ajustar</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleRemoveLogo}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-800 text-xs font-semibold rounded-xl border border-rose-200 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Remover</span>
                      </button>
                    </>
                  )}
                </div>

                {showUrlInput && (
                  <div className="flex items-center gap-1.5 pt-2">
                    <input
                      type="text"
                      placeholder="https://exemplo.com/logo.png"
                      value={urlInput}
                      onChange={(e) => setUrlInput(e.target.value)}
                      className="flex-1 px-3 py-1.5 bg-slate-50 border border-zinc-200 rounded-lg text-xs text-zinc-950 placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-orange-500 font-medium"
                    />
                    <button
                      type="button"
                      onClick={handleApplyUrl}
                      className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-semibold rounded-lg cursor-pointer"
                    >
                      Aplicar
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Form Fields: Name, Subtitle, CNPJ, Badge */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-zinc-950 mb-1">
                Nome do Estabelecimento / Supermercado:
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Supermercado Central, Hipermercado Estrela..."
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-zinc-200 rounded-xl text-xs text-zinc-950 font-medium focus:outline-none focus:ring-1 focus:ring-orange-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-950 mb-1">
                Subtítulo / Módulo:
              </label>
              <input
                type="text"
                value={subtitle}
                onChange={(e) => setSubtitle(e.target.value)}
                placeholder="Ex: Gestão Financeira"
                className="w-full px-3 py-2 bg-slate-50 border border-zinc-200 rounded-xl text-xs text-zinc-950 font-medium focus:outline-none focus:ring-1 focus:ring-orange-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-950 mb-1">
                Etiqueta / Tag (Badge):
              </label>
              <input
                type="text"
                value={badge}
                onChange={(e) => setBadge(e.target.value.toUpperCase())}
                placeholder="Ex: FINANCEIRO, MATRIZ, LOJA 01..."
                className="w-full px-3 py-2 bg-slate-50 border border-zinc-200 rounded-xl text-xs text-zinc-950 uppercase font-mono font-medium focus:outline-none focus:ring-1 focus:ring-orange-500"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-zinc-950 mb-1">
                CNPJ do Estabelecimento (Opcional):
              </label>
              <input
                type="text"
                value={cnpj}
                onChange={(e) => setCnpj(e.target.value)}
                placeholder="00.000.000/0001-00"
                className="w-full px-3 py-2 bg-slate-50 border border-zinc-200 rounded-xl text-xs text-zinc-950 font-medium focus:outline-none focus:ring-1 focus:ring-orange-500"
              />
            </div>
          </div>

          {/* Live Header Preview Box */}
          <div className="space-y-1.5">
            <span className="text-[11px] font-bold text-zinc-700 uppercase tracking-wider block">
              Pré-visualização do Cabeçalho:
            </span>
            <div className="p-3 bg-slate-50/80 border border-zinc-200 rounded-xl flex items-center justify-between gap-3 shadow-2xs">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-orange-700 flex items-center justify-center text-white shadow-xs overflow-hidden shrink-0 border border-orange-400/40">
                  {logoUrl ? (
                    <img
                      src={logoUrl}
                      alt="Preview"
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <Building2 className="w-5 h-5" />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-zinc-950">{name || 'Supermercado'}</span>
                    {badge && (
                      <span className="px-1.5 py-0.5 text-[9px] font-bold bg-orange-100 text-orange-800 border border-orange-200 rounded">
                        {badge}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-zinc-600">
                    {subtitle || 'Gestão Financeira'}
                  </p>
                </div>
              </div>

              <span className="text-[10px] text-emerald-800 font-bold bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                Ativo
              </span>
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div className="p-4 border-t border-zinc-200 bg-zinc-50 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-zinc-600 hover:text-zinc-950 rounded-xl transition-colors cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-bold text-white bg-orange-600 hover:bg-orange-500 rounded-xl shadow-xs transition-colors cursor-pointer"
          >
            <Check className="w-4 h-4" />
            <span>Salvar Estabelecimento</span>
          </button>
        </div>
      </div>

      {/* Sub-modal for image cropping & resizing */}
      <ImageCropperModal
        isOpen={isCropperOpen}
        imageSrc={cropperImage}
        onClose={() => setIsCropperOpen(false)}
        onCropComplete={(croppedBase64) => {
          setLogoUrl(croppedBase64);
          setIsCropperOpen(false);
        }}
      />
    </div>
  );
};
