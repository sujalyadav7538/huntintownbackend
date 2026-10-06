export const geoCode = async (address) => {
  try {
    const requestOptions = {
      method: "GET",
    };
    const response = await fetch(
      `https://api.geoapify.com/v1/geocode/search?text=${encodeURIComponent(
        address,
      )}&apiKey=${process.env.GEOAPIFY_API_KEY}`,
      requestOptions,
    );
    const data = await response.json();
    const coordinates = data.features[0].geometry.coordinates;
    return coordinates;
  } catch (error) {
    console.error("[geoCode] Failed to geocode address:", error.message);
    return null;
  }
};

// Returns a short human-readable address for [longitude, latitude], or null.
export const reverseGeoCode = async ([longitude, latitude]) => {
  try {
    const response = await fetch(
      `https://api.geoapify.com/v1/geocode/reverse?lat=${latitude}&lon=${longitude}&apiKey=${process.env.GEOAPIFY_API_KEY}`,
    );
    const data = await response.json();
    const props = data?.features?.[0]?.properties;
    if (!props) return null;

    const parts = [
      props.suburb || props.district || props.street,
      props.city || props.county,
      props.state,
    ].filter(Boolean);

    return parts.length ? [...new Set(parts)].join(", ") : props.formatted || null;
  } catch (error) {
    console.error("[geoCode] Failed to reverse geocode:", error.message);
    return null;
  }
};
