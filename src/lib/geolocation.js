// Utilitaires de géolocalisation terrain (vérification de présence à l'agence).

export const GEO_DEFAULT_RADIUS_M = 200; // rayon de tolérance par défaut (mètres)
export const GEO_FEATURE_KEY = 'geolocation_verification';

/**
 * Récupère la position GPS actuelle (Promise).
 * @returns {Promise<{ latitude:number, longitude:number, accuracy:number }>}
 */
export function getCurrentPosition({ timeout = 12000, maximumAge = 0, enableHighAccuracy = true } = {}) {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      reject(new Error("La géolocalisation n'est pas disponible sur cet appareil."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
      }),
      (err) => {
        const messages = {
          1: "Accès à la position refusé. Autorisez la localisation pour ce site.",
          2: 'Position indisponible. Vérifiez le GPS / la connexion.',
          3: "Délai dépassé pour obtenir la position.",
        };
        reject(new Error(messages[err.code] || err.message || 'Impossible d\'obtenir la position.'));
      },
      { enableHighAccuracy, timeout, maximumAge }
    );
  });
}

const toRad = (deg) => (deg * Math.PI) / 180;

/**
 * Distance en mètres entre deux points GPS (formule de Haversine).
 */
export function haversineMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000; // rayon terrestre (m)
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

const hasCoords = (o) =>
  o && Number.isFinite(Number(o.latitude)) && Number.isFinite(Number(o.longitude));

/**
 * Compare une position capturée aux coordonnées d'une agence.
 * @returns {{ ok:boolean, hasReference:boolean, distance:number|null, verified:boolean|null }}
 */
export function checkAgencyProximity(position, agency, radiusM = GEO_DEFAULT_RADIUS_M) {
  if (!hasCoords(agency)) {
    // Pas de coordonnées de référence sur l'agence → on ne peut pas vérifier.
    return { ok: true, hasReference: false, distance: null, verified: null };
  }
  if (!hasCoords(position)) {
    return { ok: false, hasReference: true, distance: null, verified: false };
  }
  const distance = haversineMeters(
    Number(position.latitude), Number(position.longitude),
    Number(agency.latitude), Number(agency.longitude),
  );
  return { ok: distance <= radiusM, hasReference: true, distance, verified: distance <= radiusM };
}

export const formatDistance = (m) => {
  if (m == null) return '—';
  return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${m} m`;
};
