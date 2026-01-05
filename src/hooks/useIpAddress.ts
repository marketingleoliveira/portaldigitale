import { useState, useEffect } from 'react';

export const useIpAddress = () => {
  const [ipAddress, setIpAddress] = useState<string | null>(null);

  useEffect(() => {
    const fetchIp = async () => {
      try {
        const response = await fetch('https://api.ipify.org?format=json');
        const data = await response.json();
        setIpAddress(data.ip);
      } catch (error) {
        console.error('Error fetching IP address:', error);
        setIpAddress(null);
      }
    };

    fetchIp();
  }, []);

  return ipAddress;
};

export const getIpAddress = async (): Promise<string | null> => {
  try {
    const response = await fetch('https://api.ipify.org?format=json');
    const data = await response.json();
    return data.ip;
  } catch (error) {
    console.error('Error fetching IP address:', error);
    return null;
  }
};
