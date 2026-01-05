import { useRef, useState } from 'react';
import html2canvas from 'html2canvas';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Download, Award, Trophy, Star, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import logoImage from '@/assets/logo-digitale-full.png';

interface CertificateProps {
  isOpen: boolean;
  onClose: () => void;
  sellerName: string;
  goalTitle: string;
  goalValue: string;
  achievedDate: Date;
  periodType: string;
}

const periodLabels: Record<string, string> = {
  daily: 'Diária',
  weekly: 'Semanal',
  monthly: 'Mensal',
  yearly: 'Anual',
};

export default function MeritCertificate({
  isOpen,
  onClose,
  sellerName,
  goalTitle,
  goalValue,
  achievedDate,
  periodType,
}: CertificateProps) {
  const certificateRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    if (!certificateRef.current) return;

    setDownloading(true);
    try {
      const canvas = await html2canvas(certificateRef.current, {
        scale: 2,
        backgroundColor: null,
        useCORS: true,
        logging: false,
      });

      const link = document.createElement('a');
      link.download = `certificado-${sellerName.replace(/\s+/g, '-').toLowerCase()}-${format(achievedDate, 'yyyy-MM-dd')}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (error) {
      console.error('Error generating certificate:', error);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[95vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Award className="w-5 h-5 text-yellow-500" />
            Certificado de Honra ao Mérito
          </DialogTitle>
        </DialogHeader>

        <div className="flex justify-center p-4">
          <div
            ref={certificateRef}
            className="relative w-[800px] h-[600px] bg-gradient-to-br from-slate-50 via-white to-slate-100 rounded-lg shadow-2xl overflow-hidden"
            style={{ fontFamily: 'Georgia, serif' }}
          >
            <div className="absolute inset-0">
              <div className="absolute top-0 left-0 w-32 h-32 bg-gradient-to-br from-primary/20 to-transparent" />
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-primary/20 to-transparent" />
              <div className="absolute bottom-0 left-0 w-32 h-32 bg-gradient-to-tr from-primary/20 to-transparent" />
              <div className="absolute bottom-0 right-0 w-32 h-32 bg-gradient-to-tl from-primary/20 to-transparent" />
              <div className="absolute inset-4 border-4 border-double border-yellow-500/60 rounded-lg" />
              <div className="absolute inset-8 border-2 border-yellow-600/40 rounded-lg" />
              <Star className="absolute top-16 left-16 w-6 h-6 text-yellow-500/40" />
              <Star className="absolute top-16 right-16 w-6 h-6 text-yellow-500/40" />
              <Star className="absolute bottom-16 left-16 w-6 h-6 text-yellow-500/40" />
              <Star className="absolute bottom-16 right-16 w-6 h-6 text-yellow-500/40" />
            </div>

            <div className="relative z-10 flex flex-col items-center justify-between h-full py-12 px-16 text-center">
              <div className="flex items-center justify-center">
                <img src={logoImage} alt="Digitale Têxtil" className="h-16 object-contain" />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-center gap-3">
                  <div className="h-px w-16 bg-gradient-to-r from-transparent via-yellow-500 to-transparent" />
                  <Trophy className="w-10 h-10 text-yellow-500" />
                  <div className="h-px w-16 bg-gradient-to-r from-transparent via-yellow-500 to-transparent" />
                </div>
                <h1 className="text-3xl font-bold tracking-wider text-slate-800 uppercase">
                  Certificado de Honra ao Mérito
                </h1>
                <p className="text-slate-500 text-sm tracking-widest uppercase">
                  Reconhecimento por Excelência em Vendas
                </p>
              </div>

              <div className="space-y-4 max-w-2xl">
                <p className="text-lg text-slate-600 leading-relaxed">Certificamos com orgulho que</p>
                <h2 className="text-4xl font-bold text-primary tracking-wide">{sellerName}</h2>
                <p className="text-lg text-slate-600 leading-relaxed">
                  concluiu com êxito a meta{' '}
                  <span className="font-semibold text-slate-800">{periodLabels[periodType]}</span>:
                </p>
                <div className="py-4 px-8 bg-gradient-to-r from-yellow-50 via-yellow-100/80 to-yellow-50 rounded-lg border border-yellow-200 shadow-inner">
                  <h3 className="text-2xl font-bold text-slate-800">{goalTitle}</h3>
                  <p className="text-lg font-semibold text-yellow-700 mt-1">Meta atingida: {goalValue}</p>
                </div>
              </div>

              <div className="flex items-center justify-between w-full mt-8">
                <div className="text-left">
                  <p className="text-sm text-slate-500">Data de conquista:</p>
                  <p className="text-lg font-semibold text-slate-700">
                    {format(achievedDate, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                  </p>
                </div>

                <div className="flex flex-col items-center">
                  <Award className="w-12 h-12 text-yellow-500 mb-2" />
                  <div className="h-px w-32 bg-slate-400" />
                  <p className="text-sm text-slate-500 mt-1">Assinatura Digital</p>
                </div>

                <div className="text-right">
                  <p className="text-sm text-slate-500">Digitale Têxtil</p>
                  <p className="text-xs text-slate-400">Tecidos de Alta Tecnologia</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-center mt-4">
          <Button
            onClick={handleDownload}
            disabled={downloading}
            className="gap-2 bg-gradient-to-r from-yellow-500 to-amber-500 hover:from-yellow-600 hover:to-amber-600 text-white shadow-lg"
            size="lg"
          >
            {downloading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />}
            {downloading ? 'Gerando...' : 'Baixar Certificado'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
