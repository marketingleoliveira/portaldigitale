import React, { useEffect, useState, useRef } from 'react';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { MapPin, Clock, Globe, Loader2, RefreshCw, Wifi, WifiOff, Map, List, History, Users, Radio, CheckCircle2, XCircle, HelpCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import LocationMap from '@/components/LocationMap';
import LocationHistory from '@/components/LocationHistory';
import { useOnlineUsers } from '@/hooks/useOnlineUsers';

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
    location_sharing_enabled: boolean | null;
  };
}

const Localizar: React.FC = () => {
  const [locations, setLocations] = useState<UserLocation[]>([]);
  const [vendedorIds, setVendedorIds] = useState<string[]>([]);
  const [profiles, setProfiles] = useState<{ id: string; full_name: string; avatar_url: string | null; location_sharing_enabled: boolean | null }[]>([]);
  const [loading, setLoading] = useState(true);
  const [requestingLocation, setRequestingLocation] = useState(false);
  const [awaitingLocationIds, setAwaitingLocationIds] = useState<string[]>([]);
  const { toast } = useToast();
  const { isUserOnline, onlineCount } = useOnlineUsers();
  
  // Refs to access current values in realtime callback without causing re-subscription
  const awaitingLocationIdsRef = useRef<string[]>([]);
  const profilesRef = useRef<{ id: string; full_name: string; avatar_url: string | null; location_sharing_enabled: boolean | null }[]>([]);
  
  // Keep refs in sync with state
  useEffect(() => {
    awaitingLocationIdsRef.current = awaitingLocationIds;
  }, [awaitingLocationIds]);
  
  useEffect(() => {
    profilesRef.current = profiles;
  }, [profiles]);

  const fetchLocations = async () => {
    setLoading(true);
    try {
      // First get all vendedores
      const { data: vendedores, error: vendedoresError } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'vendedor');

      if (vendedoresError) throw vendedoresError;

      const vendedorIdsList = vendedores?.map(v => v.user_id) || [];
      setVendedorIds(vendedorIdsList);

      if (vendedorIdsList.length === 0) {
        setLocations([]);
        setLoading(false);
        return;
      }

      // Get locations for vendedores only
      const { data: locationsData, error: locationsError } = await supabase
        .from('user_locations')
        .select('*')
        .in('user_id', vendedorIdsList);

      if (locationsError) throw locationsError;

      // Get profiles for these users
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, full_name, email, avatar_url, location_sharing_enabled')
        .in('id', vendedorIdsList);

      if (profilesError) throw profilesError;
      
      setProfiles(profilesData || []);

      // Combine locations with profiles
      const locationsWithProfiles = (locationsData || []).map(loc => ({
        ...loc,
        profile: profilesData?.find(p => p.id === loc.user_id),
      }));

      // Add vendedores without location data
      const vendedoresWithoutLocation = vendedorIdsList
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
          profile: profilesData?.find(p => p.id === id),
        }));

      // Combine and sort: online users first, then by last update
      const allLocations = [...locationsWithProfiles, ...vendedoresWithoutLocation];
      setLocations(allLocations);
      
      toast({
        title: 'Localizações atualizadas',
        description: `${allLocations.filter(l => l.latitude != null).length} vendedores com localização encontrados.`,
      });
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
        async (payload) => {
          const newData = payload.new as { user_id?: string; city?: string; region?: string } | null;
          
          if (newData?.user_id) {
            // Check if this user was in our awaiting list using ref
            const wasAwaiting = awaitingLocationIdsRef.current.includes(newData.user_id);
            
            // Remove user from awaiting list
            setAwaitingLocationIds(prev => prev.filter(id => id !== newData.user_id));
            
            // If user shared location after our request, show success toast
            if (wasAwaiting && newData.city) {
              // Get user name from profiles using ref
              const profile = profilesRef.current.find(p => p.id === newData.user_id);
              toast({
                title: '📍 Localização recebida!',
                description: `${profile?.full_name || 'Vendedor'} compartilhou sua localização: ${newData.city}, ${newData.region}`,
                duration: 5000,
              });
            }
          }
          
          // Refresh locations silently (without showing the default toast)
          try {
            const { data: vendedores } = await supabase
              .from('user_roles')
              .select('user_id')
              .eq('role', 'vendedor');

            const vendedorIdsList = vendedores?.map(v => v.user_id) || [];

            if (vendedorIdsList.length === 0) return;

            const { data: locationsData } = await supabase
              .from('user_locations')
              .select('*')
              .in('user_id', vendedorIdsList);

            const { data: profilesData } = await supabase
              .from('profiles')
              .select('id, full_name, email, avatar_url, location_sharing_enabled')
              .in('id', vendedorIdsList);

            const locationsWithProfiles = (locationsData || []).map(loc => ({
              ...loc,
              profile: profilesData?.find(p => p.id === loc.user_id),
            }));

            const vendedoresWithoutLocation = vendedorIdsList
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
                profile: profilesData?.find(p => p.id === id),
              }));

            setLocations([...locationsWithProfiles, ...vendedoresWithoutLocation]);
            if (profilesData) setProfiles(profilesData);
          } catch (error) {
            console.error('Error refreshing locations:', error);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [toast]);

  const checkOnlineStatus = (userId: string, lastUpdated: string) => {
    // First check presence system
    if (isUserOnline(userId)) return true;
    
    // Fallback to last_updated check
    if (!lastUpdated) return false;
    const diff = Date.now() - new Date(lastUpdated).getTime();
    return diff < 10 * 60 * 1000; // Less than 10 minutes
  };

  const openGoogleMaps = (lat: number | null, lon: number | null) => {
    if (lat && lon) {
      window.open(`https://www.google.com/maps?q=${lat},${lon}`, '_blank');
    }
  };

  const requestLocationUpdate = async () => {
    setRequestingLocation(true);
    try {
      const { data, error } = await supabase.functions.invoke('notify-location-update');
      
      if (error) throw error;
      
      toast({
        title: 'Solicitação enviada',
        description: `Solicitação de localização enviada para ${data?.usersWithoutLocation || 0} vendedores online sem localização.`,
      });
      
      // Store IDs of users awaiting location update
      if (data?.userIds) {
        setAwaitingLocationIds(data.userIds);
      }
      
      // Refresh locations after a short delay
      setTimeout(fetchLocations, 3000);
    } catch (error) {
      console.error('Error requesting location update:', error);
      toast({
        title: 'Erro ao solicitar atualização',
        description: 'Não foi possível enviar a solicitação de localização.',
        variant: 'destructive',
      });
    } finally {
      setRequestingLocation(false);
    }
  };

  const onlineWithoutLocation = locations.filter(l => 
    checkOnlineStatus(l.user_id, l.last_updated) && l.latitude == null
  ).length;

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
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="gap-1 px-3 py-1.5">
              <Users className="w-4 h-4" />
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              {locations.filter(l => checkOnlineStatus(l.user_id, l.last_updated)).length} online
            </Badge>
            <Badge variant="outline" className="gap-1 px-3 py-1.5 text-green-600 border-green-200 bg-green-50">
              <CheckCircle2 className="w-4 h-4" />
              {locations.filter(l => l.profile?.location_sharing_enabled === true).length} auto
            </Badge>
            <Badge variant="outline" className="gap-1 px-3 py-1.5 text-muted-foreground">
              <HelpCircle className="w-4 h-4" />
              {locations.filter(l => l.profile?.location_sharing_enabled === null).length} pendentes
            </Badge>
            {onlineWithoutLocation > 0 && (
              <Button 
                onClick={requestLocationUpdate} 
                variant="default" 
                disabled={requestingLocation}
                className="gap-2"
              >
                <Radio className={`w-4 h-4 ${requestingLocation ? 'animate-pulse' : ''}`} />
                Solicitar Localização ({onlineWithoutLocation})
              </Button>
            )}
            <Button onClick={fetchLocations} variant="outline" disabled={loading}>
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
          </div>
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
              <TabsTrigger value="history" className="flex items-center gap-2">
                <History className="w-4 h-4" />
                Histórico
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="map">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Mapa de Localizações</CardTitle>
                  <CardDescription>
                    {locations.filter(l => l.latitude != null).length} vendedores no mapa
                    {(() => {
                      const onlineWithoutLocation = locations.filter(l => 
                        checkOnlineStatus(l.user_id, l.last_updated) && l.latitude == null
                      ).length;
                      return onlineWithoutLocation > 0 
                        ? ` • ${onlineWithoutLocation} online sem localização` 
                        : '';
                    })()}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <LocationMap locations={locations} isUserOnline={isUserOnline} />
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="list">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...locations]
              .sort((a, b) => {
                const aOnline = checkOnlineStatus(a.user_id, a.last_updated);
                const bOnline = checkOnlineStatus(b.user_id, b.last_updated);
                if (aOnline && !bOnline) return -1;
                if (!aOnline && bOnline) return 1;
                return 0;
              })
              .map((location) => (
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
                    <div className="flex flex-col gap-1 items-end">
                      <Badge 
                        variant={checkOnlineStatus(location.user_id, location.last_updated) ? 'default' : 'secondary'}
                        className={checkOnlineStatus(location.user_id, location.last_updated) ? 'bg-green-500' : ''}
                      >
                        {checkOnlineStatus(location.user_id, location.last_updated) ? (
                          <><Wifi className="w-3 h-3 mr-1" /> Online</>
                        ) : (
                          <><WifiOff className="w-3 h-3 mr-1" /> Offline</>
                        )}
                      </Badge>
                      {/* Location sharing status badge */}
                      {location.profile?.location_sharing_enabled === true ? (
                        <Badge variant="outline" className="text-xs gap-1 text-green-600 border-green-200 bg-green-50">
                          <CheckCircle2 className="w-3 h-3" />
                          Auto
                        </Badge>
                      ) : location.profile?.location_sharing_enabled === false ? (
                        <Badge variant="outline" className="text-xs gap-1 text-red-600 border-red-200 bg-red-50">
                          <XCircle className="w-3 h-3" />
                          Recusado
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs gap-1 text-muted-foreground">
                          <HelpCircle className="w-3 h-3" />
                          Pendente
                        </Badge>
                      )}
                    </div>
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
                      {awaitingLocationIds.includes(location.user_id) ? (
                        <>
                          <Loader2 className="w-8 h-8 mx-auto mb-2 animate-spin text-primary" />
                          <p className="text-sm text-primary font-medium">Aguardando localização...</p>
                          <p className="text-xs">Solicitação enviada ao vendedor</p>
                        </>
                      ) : (
                        <>
                          <MapPin className="w-8 h-8 mx-auto mb-2 opacity-50" />
                          <p className="text-sm">Localização não disponível</p>
                          <p className="text-xs">O usuário ainda não acessou o portal</p>
                        </>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
            </TabsContent>
            
            <TabsContent value="history">
              <LocationHistory vendedorIds={vendedorIds} profiles={profiles} />
            </TabsContent>
          </Tabs>
        )}
      </div>
    </DashboardLayout>
  );
};

export default Localizar;
