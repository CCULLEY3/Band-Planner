// backend/src/services/geocodeService.js
//
// Uses OpenStreetMap Nominatim — completely free, no API key required.
// Rate limit: 1 req/sec, must include a meaningful User-Agent.
// Docs: https://nominatim.org/release-docs/latest/api/Search/

const https = require('https');

const USER_AGENT = `BandPlanner/1.0 (${process.env.CONTACT_EMAIL || 'admin@bandplanner.dev'})`;

/**
 * Geocode an address / city string → { lat, lng, displayName }
 * Returns null if nothing found.
 */
const geocode = (query) => new Promise((resolve, reject) => {
  const encoded = encodeURIComponent(query);
  const url = `https://nominatim.openstreetmap.org/search?q=${encoded}&format=json&limit=1&addressdetails=1`;

  const req = https.get(url, {
    headers: {
      'User-Agent': USER_AGENT,
      'Accept-Language': 'en',
    },
  }, (res) => {
    let data = '';
    res.on('data', chunk => { data += chunk; });
    res.on('end', () => {
      try {
        const results = JSON.parse(data);
        if (!results.length) return resolve(null);
        const r = results[0];
        resolve({
          lat:         parseFloat(r.lat),
          lng:         parseFloat(r.lon),
          displayName: r.display_name,
          city:        r.address?.city || r.address?.town || r.address?.village,
          state:       r.address?.state,
          country:     r.address?.country_code?.toUpperCase(),
          zip:         r.address?.postcode,
        });
      } catch (err) {
        reject(err);
      }
    });
  });

  req.on('error', reject);
  req.setTimeout(8000, () => { req.destroy(new Error('Geocode timeout')); });
});

/**
 * Geocode a venue: tries "venue name, city, state" then falls back to "city, state".
 */
const geocodeVenue = async (venue) => {
  const queries = [
    venue.address ? `${venue.address}, ${venue.city}, ${venue.state || ''} ${venue.country || 'US'}` : null,
    `${venue.city}, ${venue.state || ''} ${venue.country || 'US'}`,
    `${venue.city}, ${venue.country || 'US'}`,
  ].filter(Boolean);

  for (const query of queries) {
    try {
      const result = await geocode(query.trim());
      if (result) return result;
    } catch (err) {
      console.warn(`Geocode attempt failed for "${query}":`, err.message);
    }
    // Nominatim rate limit: 1 req/second
    await sleep(1100);
  }
  return null;
};

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

/**
 * Haversine distance between two lat/lng pairs.
 * Returns distance in miles.
 */
const haversineDistance = (lat1, lng1, lat2, lng2) => {
  const R  = 3958.8; // Earth radius in miles
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const toRad = (deg) => (deg * Math.PI) / 180;

/**
 * Estimate drive hours: distance / 55 mph average (accounts for stops, traffic).
 */
const estimateDriveHours = (miles) => +(miles / 55).toFixed(1);

/**
 * Calculate all travel legs for an ordered list of stops.
 * stops: [{ lat, lng }]
 * Returns: [{ miles, driveHrs }]  (length = stops.length - 1)
 */
const calculateLegs = (stops) => {
  const legs = [];
  for (let i = 1; i < stops.length; i++) {
    const prev = stops[i - 1];
    const curr = stops[i];
    if (prev.lat && prev.lng && curr.lat && curr.lng) {
      const miles    = haversineDistance(prev.lat, prev.lng, curr.lat, curr.lng);
      const driveHrs = estimateDriveHours(miles);
      legs.push({ miles: +miles.toFixed(1), driveHrs });
    } else {
      legs.push({ miles: null, driveHrs: null });
    }
  }
  return legs;
};

module.exports = { geocode, geocodeVenue, haversineDistance, estimateDriveHours, calculateLegs, sleep };
