const API_KEY = import.meta.env.VITE_GEOAPIFY_API_KEY;

/* Convert place name → coordinates */
export async function geocode(place) {
  if (!API_KEY) {
    throw new Error("API key is missing. Please set VITE_GEOAPIFY_API_KEY in your .env file");
  }

  const url = `https://api.geoapify.com/v1/geocode/search?text=${encodeURIComponent(
    place
  )}&limit=1&apiKey=${API_KEY}`;

  const res = await fetch(url);
  
  if (!res.ok) {
    throw new Error(`Geocoding API error: ${res.status} ${res.statusText}`);
  }
  
  const data = await res.json();

  if (!data.features || !data.features.length) {
    throw new Error(`Location not found: ${place}`);
  }

  const [lon, lat] = data.features[0].geometry.coordinates;
  return { lat, lon };
}

/* Search for places and return results with coordinates */
export async function searchPlaces(text) {
  if (!text || text.length < 3) {
    return [];
  }

  if (!API_KEY) {
    throw new Error("API key is missing. Please set VITE_GEOAPIFY_API_KEY in your .env file");
  }

  const url = `https://api.geoapify.com/v1/geocode/search?text=${encodeURIComponent(
    text
  )}&limit=5&apiKey=${API_KEY}`;

  try {
    const res = await fetch(url);
    
    if (!res.ok) {
      throw new Error(`Search API error: ${res.status} ${res.statusText}`);
    }
    
    const data = await res.json();
    
    if (!data.features || !data.features.length) {
      return [];
    }

    return data.features.map(feature => {
      const [lon, lat] = feature.geometry.coordinates;
      return {
        formatted: feature.properties.formatted,
        lat: lat,
        lon: lon,
        city: feature.properties.city,
        country: feature.properties.country,
      };
    });
    
  } catch (error) {
    console.error("Search error:", error);
    throw error;
  }
}

/* Get route between two coordinates */
export async function getRoute(origin, destination) {
  if (!origin || !destination) {
    throw new Error("Origin and destination coordinates are required");
  }

  if (!API_KEY) {
    throw new Error("API key is missing. Please set VITE_GEOAPIFY_API_KEY in your .env file");
  }

  const routeUrl = `https://api.geoapify.com/v1/routing?waypoints=${origin.lat},${origin.lon}|${destination.lat},${destination.lon}&mode=drive&units=metric&apiKey=${API_KEY}`;

  try {
    const res = await fetch(routeUrl);
    
    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        throw new Error("Invalid API key or insufficient permissions");
      } else if (res.status === 429) {
        throw new Error("Rate limit exceeded. Please try again later");
      } else if (res.status === 400) {
        throw new Error("Invalid request parameters");
      } else {
        throw new Error(`API error: ${res.status}`);
      }
    }
    
    const data = await res.json();

    if (!data.features || !data.features.length) {
      throw new Error("Route calculation failed - no route found");
    }

    const feature = data.features[0];
    const properties = feature.properties;
    
    if (!properties || !properties.distance) {
      throw new Error("Invalid route data received");
    }

    return {
      distance: properties.distance, // in meters
      duration: properties.time,     // in seconds
      geometry: feature.geometry,    // GeoJSON geometry for map display
    };
    
  } catch (error) {
    console.error("Route error:", error);
    throw error;
  }
}

/* Autocomplete - get address suggestions */
export async function autocomplete(text, options = {}) {
  if (!text || text.length < 3) {
    return [];
  }

  const { limit = 5, filter = '' } = options;
  
  const url = `https://api.geoapify.com/v1/geocode/autocomplete?text=${encodeURIComponent(
    text
  )}&limit=${limit}${filter}&apiKey=${API_KEY}`;

  try {
    const res = await fetch(url);
    
    if (!res.ok) {
      console.error(`Autocomplete API error: ${res.status}`);
      return [];
    }
    
    const data = await res.json();
    
    if (!data.features || !data.features.length) {
      return [];
    }

    return data.features.map(feature => ({
      label: feature.properties.formatted,
      city: feature.properties.city,
      country: feature.properties.country,
      coordinates: feature.geometry.coordinates,
    }));
    
  } catch (error) {
    console.error("Autocomplete error:", error);
    return [];
  }
}

/* Calculate route distance */
export async function getDistance(origin, destination) {
  if (!origin || !destination) {
    throw new Error("Please enter both origin and destination");
  }

  const from = await geocode(origin);
  const to = await geocode(destination);

  const routeUrl = `https://api.geoapify.com/v1/routing?waypoints=${from.lat},${from.lon}|${to.lat},${to.lon}&mode=drive&units=metric&apiKey=${API_KEY}`;

  const res = await fetch(routeUrl);
  
  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      throw new Error("Invalid API key or insufficient permissions");
    } else if (res.status === 429) {
      throw new Error("Rate limit exceeded. Please try again later");
    } else if (res.status === 400) {
      throw new Error("Invalid request parameters");
    } else {
      throw new Error(`API error: ${res.status}`);
    }
  }
  
  const data = await res.json();

  if (!data.features || !data.features.length) {
    throw new Error("Route calculation failed - no route found");
  }

  const feature = data.features[0];
  const properties = feature.properties;
  
  if (!properties || !properties.distance) {
    throw new Error("Invalid route data received");
  }

  return {
    distanceKm: (properties.distance / 1000).toFixed(2),
    durationMin: Math.round(properties.time / 60),
    routeGeometry: feature.geometry,
    origin: from,
    destination: to,
  };
}