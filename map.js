// Set your Mapbox access token here
mapboxgl.accessToken = 'pk.eyJ1IjoiY2xsMDE2IiwiYSI6ImNtN2NiYnhtNDAybXQycnB0amQ5MGJmNnkifQ.U-nr_xmtDfEu8K985TEpSA';

// Initialize the map
const map = new mapboxgl.Map({
    container: 'map', // ID of the div where the map will render
    style: 'mapbox://styles/mapbox/streets-v12', // Map style
    center: [-71.09415, 42.36027], // [longitude, latitude]
    zoom: 12, // Initial zoom level
    minZoom: 5, // Minimum allowed zoom
    maxZoom: 18 // Maximum allowed zoom
});