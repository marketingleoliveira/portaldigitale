import { useEffect, useRef, useCallback } from 'react';
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
    // Use edge function to avoid CORS issues
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

export const useLocationTracking = () => {
  const { user } = useAuth();
  const lastLocationRef = useRef<string | null>(null);
  const isUpdatingRef = useRef(false);

  const updateLocation = useCallback(async () => {
    if (!user?.id || isUpdatingRef.current) return;
    
    isUpdatingRef.current = true;
    
    try {
      const geoData = await fetchGeoLocation();
      if (!geoData) {
        console.log('Could not fetch geolocation data');
        return;
      }

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
      } else {
        console.log('Location updated successfully:', geoData.city);
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
    } finally {
      isUpdatingRef.current = false;
    }
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;

    // Update location immediately
    updateLocation();

    // Update location every 5 minutes
    const interval = setInterval(updateLocation, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, [user?.id, updateLocation]);
};
