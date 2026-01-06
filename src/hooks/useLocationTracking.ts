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

// Get precise location using browser's Geolocation API (GPS)
const getBrowserGeolocation = (): Promise<GeolocationPosition> => {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation not supported'));
      return;
    }
    
    navigator.geolocation.getCurrentPosition(
      resolve,
      reject,
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  });
};

// Reverse geocoding to get city/region from coordinates
const reverseGeocode = async (lat: number, lng: number): Promise<{ city: string; region: string; country: string }> => {
  try {
    const { data: tokenData } = await supabase.functions.invoke('get-mapbox-token');
    if (tokenData?.token) {
      const response = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${tokenData.token}&types=place,region,country&language=pt`
      );
      if (response.ok) {
        const data = await response.json();
        const features = data.features || [];
        const place = features.find((f: any) => f.place_type?.includes('place'));
        const region = features.find((f: any) => f.place_type?.includes('region'));
        const country = features.find((f: any) => f.place_type?.includes('country'));
        
        return {
          city: place?.text || 'Unknown',
          region: region?.text || 'Unknown',
          country: country?.text || 'Brazil',
        };
      }
    }
  } catch (error) {
    console.error('Reverse geocoding failed:', error);
  }
  return { city: 'Unknown', region: 'Unknown', country: 'Unknown' };
};

const fetchGeoLocation = async (): Promise<GeoLocationData | null> => {
  try {
    // First, try to get precise location from browser GPS
    try {
      const position = await getBrowserGeolocation();
      const { latitude, longitude } = position.coords;
      
      // Get city/region from coordinates
      const locationInfo = await reverseGeocode(latitude, longitude);
      
      // Get IP address from edge function
      const { data: ipData } = await supabase.functions.invoke('get-geolocation');
      
      console.log('GPS location obtained:', { latitude, longitude, ...locationInfo });
      
      return {
        ip: ipData?.ip || 'Unknown',
        latitude,
        longitude,
        city: locationInfo.city,
        region: locationInfo.region,
        country: locationInfo.country,
      };
    } catch (gpsError) {
      console.log('GPS failed, falling back to IP geolocation:', gpsError);
    }
    
    // Fallback to IP-based geolocation
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

  const updateLocation = useCallback(async (force: boolean = false) => {
    if (!user?.id) return;
    if (isUpdatingRef.current && !force) return;
    
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

    // Update location every 1 minute
    const interval = setInterval(() => updateLocation(), 1 * 60 * 1000);

    // Listen for forced location update requests
    const channel = supabase
      .channel('location-update-request')
      .on('broadcast', { event: 'request-location-update' }, (payload) => {
        const userIds = payload.payload?.user_ids || [];
        if (userIds.includes(user.id)) {
          console.log('Received forced location update request');
          updateLocation(true);
        }
      })
      .subscribe();

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [user?.id, updateLocation]);

  return { updateLocation };
};
