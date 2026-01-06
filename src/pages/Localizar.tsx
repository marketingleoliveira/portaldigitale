import React, { useEffect, useState } from 'react';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { MapPin, Clock, Globe, Loader2, RefreshCw, Wifi, WifiOff, Map, List } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import LocationMap from '@/components/LocationMap';

interface UserLocation {
  id: string;
  user_id: string;
  ip_address: string | null;
  latitude: number | null;
  longitude: number | null;
  city: string | null;
  region: string | null;
  country: string | null;
  last_updated: string;
  profile?: {
    full_name: string;
    email: string;
    avatar_url: string | null;
  };
}

const Localizar: React.FC = () => {
  const [locations, setLocations] = useState<UserLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchLocations = async () => {
    try {
      // First get all vendedores
      const { data: vendedores, error: vendedoresError } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'vendedor');

      if (vendedoresError) throw vendedoresError;

      const vendedorIds = vendedores?.map(v => v.user_id) || [];

      if (vendedorIds.length === 0) {
        setLocations([]);
        setLoading(false);
        return;
      }

      // Get locations for vendedores only
      const { data: locationsData, error: locationsError } = await supabase
        .from('user_locations')
        .select('*')
        .in('user_id', vendedorIds);

      if (locationsError) throw locationsError;

      // Get profiles for these users
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, full_name, email, avatar_url')
        .in('id', vendedorIds);

      if (profilesError) throw profilesError;

      // Combine locations with profiles
      const locationsWithProfiles = (locationsData || []).map(loc => ({
        ...loc,
        profile: profiles?.find(p => p.id === loc.user_id),
      }));

      // Add vendedores without location data
      const vendedoresWithoutLocation = vendedorIds
        .filter(id => !locationsData?.find(loc => loc.user_id === id))
        .map(id => ({
          id: id,
          user_id: id,
          ip_address: null,
          latitude: null,
          longitude: null,
          city: null,
          region: null,
          country: null,
          last_updated: '',
          profile: profiles?.find(p => p.id === id),
        }));

      setLocations([...locationsWithProfiles, ...vendedoresWithoutLocation]);
    } catch (error) {
      console.error('Error fetching locations:', error);
      toast({
        title: 'Erro ao carregar localizações',
        description: 'Não foi possível carregar as localizações dos usuários.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLocations();

    // Subscribe to realtime updates
    const channel = supabase
      .channel('user-locations-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_locations',
        },
        () => {
          fetchLocations();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const isOnline = (lastUpdated: string) => {
    if (!lastUpdated) return false;
    const diff = Date.now() - new Date(lastUpdated).getTime();
    return diff < 10 * 60 * 1000; // Less than 10 minutes
  };

  const openGoogleMaps = (lat: number | null, lon: number | null) => {
    if (lat && lon) {
      window.open(`https://www.google.com/maps?q=${lat},${lon}`, '_blank');
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold">Localizar Vendedores</h1>
            <p className="text-muted-foreground">
              Acompanhe a geolocalização em tempo real dos vendedores
            </p>
          </div>
          <Button onClick={fetchLocations} variant="outline" disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : locations.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <MapPin className="w-12 h-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">Nenhum vendedor encontrado</p>
            </CardContent>
          </Card>
        ) : (
          <Tabs defaultValue="map" className="w-full">
            <TabsList className="mb-4">
              <TabsTrigger value="map" className="flex items-center gap-2">
                <Map className="w-4 h-4" />
                Mapa
              </TabsTrigger>
              <TabsTrigger value="list" className="flex items-center gap-2">
                <List className="w-4 h-4" />
                Lista
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="map">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Mapa de Localizações</CardTitle>
                  <CardDescription>
                    {locations.filter(l => l.latitude != null).length} vendedores com localização disponível
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <LocationMap locations={locations} />
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="list">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {locations.map((location) => (
              <Card key={location.user_id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      {location.profile?.avatar_url ? (
                        <img
                          src={location.profile.avatar_url}
                          alt={location.profile.full_name}
                          className="w-10 h-10 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <span className="text-primary font-medium">
                            {location.profile?.full_name?.charAt(0) || '?'}
                          </span>
                        </div>
                      )}
                      <div>
                        <CardTitle className="text-base">
                          {location.profile?.full_name || 'Usuário desconhecido'}
                        </CardTitle>
                        <CardDescription className="text-xs">
                          {location.profile?.email}
                        </CardDescription>
                      </div>
                    </div>
                    <Badge 
                      variant={isOnline(location.last_updated) ? 'default' : 'secondary'}
                      className={isOnline(location.last_updated) ? 'bg-green-500' : ''}
                    >
                      {isOnline(location.last_updated) ? (
                        <><Wifi className="w-3 h-3 mr-1" /> Online</>
                      ) : (
                        <><WifiOff className="w-3 h-3 mr-1" /> Offline</>
                      )}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {location.city ? (
                    <>
                      <div className="flex items-center gap-2 text-sm">
                        <MapPin className="w-4 h-4 text-muted-foreground" />
                        <span>
                          {location.city}, {location.region}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Globe className="w-4 h-4 text-muted-foreground" />
                        <span>{location.country}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Clock className="w-4 h-4" />
                        <span>
                          Atualizado {formatDistanceToNow(new Date(location.last_updated), { 
                            addSuffix: true, 
                            locale: ptBR 
                          })}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        IP: {location.ip_address}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full mt-2"
                        onClick={() => openGoogleMaps(location.latitude, location.longitude)}
                      >
                        <MapPin className="w-4 h-4 mr-2" />
                        Ver no Google Maps
                      </Button>
                    </>
                  ) : (
                    <div className="text-center py-4 text-muted-foreground">
                      <MapPin className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">Localização não disponível</p>
                      <p className="text-xs">O usuário ainda não acessou o portal</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
            </TabsContent>
          </Tabs>
        )}
      </div>
    </DashboardLayout>
  );
};

export default Localizar;
