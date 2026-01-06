import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

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
    // Use ip-api.com (free, no API key required)
    const response = await fetch('http://ip-api.com/json/?fields=status,message,country,regionName,city,lat,lon,query');
    const data = await response.json();
    
    if (data.status === 'success') {
      return {
        ip: data.query,
        latitude: data.lat,
        longitude: data.lon,
        city: data.city,
        region: data.regionName,
        country: data.country,
      };
    }
    return null;
  } catch (error) {
    console.error('Error fetching geolocation:', error);
    return null;
  }
};

export const useLocationTracking = () => {
  const { user } = useAuth();

  useEffect(() => {
    if (!user?.id) return;

    const updateLocation = async () => {
      const geoData = await fetchGeoLocation();
      if (!geoData) return;

      const { error } = await supabase
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

      if (error) {
        console.error('Error updating location:', error);
      }
    };

    // Update location immediately
    updateLocation();

    // Update location every 5 minutes
    const interval = setInterval(updateLocation, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, [user?.id]);
};
