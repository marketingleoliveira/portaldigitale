import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Award, Trophy, Calendar, Target, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import MeritCertificate from './MeritCertificate';

interface Certificate {
  id: string;
  goal_id: string;
  goal_title: string;
  goal_value: string;
  period_type: string;
  achieved_at: string;
}

const periodLabels: Record<string, string> = {
  daily: 'Diária',
  weekly: 'Semanal',
  monthly: 'Mensal',
  yearly: 'Anual',
};

export default function ProfileCertificates() {
  const { user } = useAuth();
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCertificate, setSelectedCertificate] = useState<Certificate | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    const fetchCertificates = async () => {
      if (!user?.id) return;

      try {
        const { data, error } = await supabase
          .from('achieved_certificates')
          .select('*')
          .eq('user_id', user.id)
          .order('achieved_at', { ascending: false });

        if (error) throw error;
        setCertificates(data || []);
      } catch (error) {
        console.error('Error fetching certificates:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchCertificates();
  }, [user?.id]);

  const handleViewCertificate = (cert: Certificate) => {
    setSelectedCertificate(cert);
    setDialogOpen(true);
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-yellow-500" />
            Meus Certificados
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-yellow-500" />
            Meus Certificados
            {certificates.length > 0 && (
              <span className="ml-2 px-2 py-0.5 text-xs font-medium bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 rounded-full">
                {certificates.length}
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {certificates.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Award className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>Você ainda não conquistou nenhum certificado.</p>
              <p className="text-sm mt-1">Bata suas metas para ganhar certificados de honra ao mérito!</p>
            </div>
          ) : (
            <div className="grid gap-3">
              {certificates.map((cert) => (
                <div
                  key={cert.id}
                  className="flex items-center justify-between p-4 bg-gradient-to-r from-yellow-500/10 via-amber-500/5 to-transparent rounded-lg border border-yellow-500/20 hover:border-yellow-500/40 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-yellow-500 to-amber-600 flex items-center justify-center shadow-lg">
                      <Award className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-sm">{cert.goal_title}</h4>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                        <span className="flex items-center gap-1">
                          <Target className="w-3 h-3" />
                          {cert.goal_value}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {format(new Date(cert.achieved_at), "dd 'de' MMM 'de' yyyy", { locale: ptBR })}
                        </span>
                        <span className="px-1.5 py-0.5 bg-primary/10 text-primary rounded text-[10px] font-medium">
                          {periodLabels[cert.period_type] || cert.period_type}
                        </span>
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleViewCertificate(cert)}
                    className="gap-1.5 text-xs bg-gradient-to-r from-yellow-500/10 to-amber-500/10 border-yellow-500/30 hover:border-yellow-500/50 text-yellow-700 dark:text-yellow-400"
                  >
                    <Award className="w-3.5 h-3.5" />
                    Ver
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {selectedCertificate && (
        <MeritCertificate
          isOpen={dialogOpen}
          onClose={() => {
            setDialogOpen(false);
            setSelectedCertificate(null);
          }}
          sellerName={user?.profile?.full_name || 'Vendedor'}
          goalTitle={selectedCertificate.goal_title}
          goalValue={selectedCertificate.goal_value}
          achievedDate={new Date(selectedCertificate.achieved_at)}
          periodType={selectedCertificate.period_type}
        />
      )}
    </>
  );
}
