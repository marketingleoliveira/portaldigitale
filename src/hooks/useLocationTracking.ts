import { useEffect, useRef } from 'react';
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
  const lastLocationRef = useRef<string | null>(null);

  useEffect(() => {
    if (!user?.id) return;

    const updateLocation = async () => {
      const geoData = await fetchGeoLocation();
      if (!geoData) return;

      // Create a location signature to avoid duplicate entries
      const locationSignature = `${geoData.latitude},${geoData.longitude}`;
      
      // Update current location
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
      }

      // Add to history only if location changed or first entry
      if (lastLocationRef.current !== locationSignature) {
        const { error: historyError } = await supabase
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

        if (historyError) {
          console.error('Error inserting location history:', historyError);
        } else {
          lastLocationRef.current = locationSignature;
        }
      }
    };

    // Update location immediately
    updateLocation();

    // Update location every 5 minutes
    const interval = setInterval(updateLocation, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, [user?.id]);
};
