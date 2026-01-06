import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Try multiple geolocation APIs
    let geoData = null;

    // Try ipapi.co first
    try {
      const response = await fetch('https://ipapi.co/json/', {
        headers: { 'User-Agent': 'Mozilla/5.0' }
      });
      if (response.ok) {
        const data = await response.json();
        if (data.ip && data.latitude) {
          geoData = {
            ip: data.ip,
            latitude: data.latitude,
            longitude: data.longitude,
            city: data.city || 'Unknown',
            region: data.region || 'Unknown',
            country: data.country_name || 'Unknown',
          };
        }
      }
    } catch (e) {
      console.log('ipapi.co failed, trying fallback');
    }

    // Fallback to ip-api.com
    if (!geoData) {
      try {
        const response = await fetch('http://ip-api.com/json/?fields=status,message,country,regionName,city,lat,lon,query');
        if (response.ok) {
          const data = await response.json();
          if (data.status === 'success') {
            geoData = {
              ip: data.query,
              latitude: data.lat,
              longitude: data.lon,
              city: data.city || 'Unknown',
              region: data.regionName || 'Unknown',
              country: data.country || 'Unknown',
            };
          }
        }
      } catch (e) {
        console.log('ip-api.com failed, trying last fallback');
      }
    }

    // Last fallback to ipwho.is
    if (!geoData) {
      try {
        const response = await fetch('https://ipwho.is/');
        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            geoData = {
              ip: data.ip,
              latitude: data.latitude,
              longitude: data.longitude,
              city: data.city || 'Unknown',
              region: data.region || 'Unknown',
              country: data.country || 'Unknown',
            };
          }
        }
      } catch (e) {
        console.log('ipwho.is also failed');
      }
    }

    if (!geoData) {
      return new Response(
        JSON.stringify({ error: 'Could not determine location' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    return new Response(
      JSON.stringify(geoData),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  } catch (error) {
    console.error('Error fetching geolocation:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to fetch geolocation' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
