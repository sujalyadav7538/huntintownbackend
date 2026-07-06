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
    console.log(error.message, "heloo");
  }
};
