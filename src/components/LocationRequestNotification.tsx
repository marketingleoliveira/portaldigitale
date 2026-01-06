import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { MapPin, X, Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface GeoLocationData {
  ip: string;
  latitude: number;
  longitude: number;
  city: string;
  region: string;
  country: string;
}

const fetchGeoLocation = async (): Promise<GeoLocationData | null> => {
  try {
    const { data, error } = await supabase.functions.invoke('get-geolocation');
    
    if (error) {
      console.error('Error from edge function:', error);
      return null;
    }
    
    if (data && data.ip && data.latitude) {
      return {
        ip: data.ip,
        latitude: data.latitude,
        longitude: data.longitude,
        city: data.city || 'Unknown',
        region: data.region || 'Unknown',
        country: data.country || 'Unknown',
      };
    }
    
    return null;
  } catch (error) {
    console.error('Error fetching geolocation:', error);
    return null;
  }
};

export const LocationRequestNotification: React.FC = () => {
  const { user } = useAuth();
  const [showNotification, setShowNotification] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAccept = useCallback(async () => {
    if (!user?.id) return;
    
    setIsSubmitting(true);
    
    try {
      const geoData = await fetchGeoLocation();
      if (!geoData) {
        toast.error('Não foi possível obter sua localização');
        return;
      }

      const { error: upsertError } = await supabase
        .from('user_locations')
        .upsert({
          user_id: user.id,
          ip_address: geoData.ip,
          latitude: geoData.latitude,
          longitude: geoData.longitude,
          city: geoData.city,
          region: geoData.region,
          country: geoData.country,
          last_updated: new Date().toISOString(),
        }, {
          onConflict: 'user_id',
        });

      if (upsertError) {
        console.error('Error updating location:', upsertError);
        toast.error('Erro ao compartilhar localização');
      } else {
        // Also add to history
        await supabase
          .from('user_location_history')
          .insert({
            user_id: user.id,
            ip_address: geoData.ip,
            latitude: geoData.latitude,
            longitude: geoData.longitude,
            city: geoData.city,
            region: geoData.region,
            country: geoData.country,
          });

        toast.success('Localização compartilhada com sucesso!', {
          description: `${geoData.city}, ${geoData.region}`,
        });
        setShowNotification(false);
      }
    } finally {
      setIsSubmitting(false);
    }
  }, [user?.id]);

  const handleDismiss = () => {
    setShowNotification(false);
    toast.info('Solicitação de localização ignorada');
  };

  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel('location-request-notification')
      .on('broadcast', { event: 'request-location-update' }, (payload) => {
        const userIds = payload.payload?.user_ids || [];
        if (userIds.includes(user.id)) {
          console.log('Received location request notification');
          setShowNotification(true);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  if (!showNotification) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-card border border-border rounded-xl shadow-2xl max-w-md w-full mx-4 overflow-hidden animate-in zoom-in-95 duration-300">
        {/* Header */}
        <div className="bg-primary/10 px-6 py-4 flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
            <MapPin className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-foreground">Solicitação de Localização</h3>
            <p className="text-sm text-muted-foreground">A administração solicitou sua localização</p>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-4">
          <p className="text-muted-foreground">
            A equipe de gestão está solicitando que você compartilhe sua localização atual. 
            Isso ajuda no acompanhamento das atividades da equipe.
          </p>
        </div>

        {/* Actions */}
        <div className="px-6 py-4 bg-muted/30 flex gap-3 justify-end">
          <Button
            variant="outline"
            onClick={handleDismiss}
            disabled={isSubmitting}
            className="gap-2"
          >
            <X className="w-4 h-4" />
            Ignorar
          </Button>
          <Button
            onClick={handleAccept}
            disabled={isSubmitting}
            className="gap-2"
          >
            {isSubmitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Check className="w-4 h-4" />
            )}
            Compartilhar Localização
          </Button>
        </div>
      </div>
    </div>
  );
};
