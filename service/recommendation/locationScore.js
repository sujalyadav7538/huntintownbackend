
/**
 * Calculate recommendation score based on distance
 *
 * @param {Object} userLocation
 * @param {Object} postLocation
 * @returns {number}
 */
export default function calculateLocationScore(userLocation, postLocation) {
  if (
    !userLocation?.coordinates ||
    !postLocation?.coordinates ||
    userLocation.coordinates.length !== 2 ||
    postLocation.coordinates.length !== 2
  ) {
    return 0;
  }

  const [userLng, userLat] = userLocation.coordinates;
  const [postLng, postLat] = postLocation.coordinates;

  const distance = getDistanceInKm(userLat, userLng, postLat, postLng);

  if (distance <= 2) return 30;
  if (distance <= 5) return 20;
  if (distance <= 10) return 10;
  if (distance <= 20) return 5;

  return 0;
}

/**
 * Haversine Formula
 * Returns distance in KM
 */
function getDistanceInKm(lat1, lon1, lat2, lon2) {
  const R = 6371;

  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

function toRadians(value) {
  return (value * Math.PI) / 180;
}
