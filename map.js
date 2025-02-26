mapboxgl.accessToken = 'pk.eyJ1IjoiY2xsMDE2IiwiYSI6ImNtN2NiYnhtNDAybXQycnB0amQ5MGJmNnkifQ.U-nr_xmtDfEu8K985TEpSA';

// Initialize map
const map = new mapboxgl.Map({
    container: 'map', // ID of the div where the map will render
    style: 'mapbox://styles/mapbox/streets-v12', // Map style
    center: [-71.08268241189755, 42.36579381740771], // [longitude, latitude]
    zoom: 12, // Initial zoom level
    minZoom: 5, // Minimum allowed zoom
    maxZoom: 18 // Maximum allowed zoom
});


function getCoords(station) {
    const point = new mapboxgl.LngLat(+station.lon, +station.lat); // Convert lon/lat to Mapbox LngLat
    const { x, y } = map.project(point);
    return { cx: x, cy: y };
}

map.on('load', async () => {
    map.addSource('boston_route', {
        type: 'geojson',
        data: 'https://bostonopendata-boston.opendata.arcgis.com/datasets/boston::existing-bike-network-2022.geojson?...'
    });

    map.addSource('cambridge_route', {
        type: 'geojson',
        data: 'https://raw.githubusercontent.com/cambridgegis/cambridgegis_data/main/Recreation/Bike_Facilities/RECREATION_BikeFacilities.geojson'
    });

    map.addLayer({
        id: 'boston_bike-lanes',
        type: 'line',
        source: 'boston_route',
        paint: {
            'line-color': 'green',
            'line-width': 3,
            'line-opacity': 0.4
        }
    });

    map.addLayer({
        id: 'cambridge_bike-lanes',
        type: 'line',
        source: 'cambridge_route',
        paint: {
            'line-color': 'green',
            'line-width': 3,
            'line-opacity': 0.4
        }
    });

    const svg = d3.select("#map").select("svg");

    let jsonData, trips;
    try {
        const stationsurl = "https://dsc106.com/labs/lab07/data/bluebikes-stations.json";
        const tripsurl = "https://dsc106.com/labs/lab07/data/bluebikes-traffic-2024-03.csv";

        // Fetch JSON data
        jsonData = await d3.json(stationsurl);

        // Fetch CSV data and parse date strings immediately into Date objects
        trips = await d3.csv(
            tripsurl,
            (trip) => {
                trip.started_at = new Date(trip.started_at);
                trip.ended_at = new Date(trip.ended_at);
                return trip;
            }
        );

        // Extract stations array and compute initial traffic using all trips
        let stations = jsonData.data.stations;
        stations = computeStationTraffic(stations, trips);

        // Define the radius scale using square root scaling
        const radiusScale = d3
            .scaleSqrt()
            .domain([0, d3.max(stations, (d) => d.totalTraffic)])
            .range([0, 25]);

        // Define the stationFlow quantize scale to map ratio to discrete values
        let stationFlow = d3.scaleQuantize().domain([0, 1]).range([0, 0.5, 1]);

        // Append circles to the SVG for each station using a key function
        const circles = svg.selectAll('circle')
            .data(stations, (d) => d.short_name)
            .enter()
            .append('circle')
            .attr('fill', 'steelblue')
            .attr('stroke', 'white')
            .attr('stroke-width', 1)
            .attr('opacity', 0.6)
            .attr('pointer-events', 'auto')
            .attr('r', d => radiusScale(d.totalTraffic))
            .style("--departure-ratio", d => stationFlow(d.departures / d.totalTraffic))
            .each(function (d) {
                d3.select(this)
                    .append('title')
                    .text(`${d.totalTraffic} trips (${d.departures} departures, ${d.arrivals} arrivals)`);
            });

        // Function to update circle positions when the map moves/zooms
        function updatePositions() {
            circles
                .attr('cx', d => getCoords(d).cx)
                .attr('cy', d => getCoords(d).cy);
        }

        updatePositions();

        map.on('move', updatePositions);
        map.on('zoom', updatePositions);
        map.on('resize', updatePositions);
        map.on('moveend', updatePositions);

        function updateScatterPlot(timeFilter) {
            const filteredTrips = filterTripsbyTime(trips, timeFilter);

            const filteredStations = computeStationTraffic(stations, filteredTrips);

            timeFilter === -1 ? radiusScale.range([0, 25]) : radiusScale.range([3, 50]);

            circles
                .data(filteredStations, (d) => d.short_name)
                .join('circle')
                .attr('fill', 'steelblue')
                .attr('stroke', 'white')
                .attr('stroke-width', 1)
                .attr('opacity', 0.6)
                .attr('pointer-events', 'auto')
                .attr('r', (d) => radiusScale(d.totalTraffic))
                .style('--departure-ratio', (d) => stationFlow(d.departures / d.totalTraffic))
                .each(function (d) {
                    d3.select(this).select('title').remove();
                    d3.select(this)
                        .append('title')
                        .text(`${d.totalTraffic} trips (${d.departures} departures, ${d.arrivals} arrivals)`);
                });
        }

        const timeSlider = document.getElementById('time-slider');
        const selectedTime = document.getElementById('selected-time');
        const anyTimeLabel = document.getElementById('any-time');

        // Update displayed time and scatterplot based on slider input
        function updateTimeDisplay() {
            let timeFilter = Number(timeSlider.value);

            if (timeFilter === -1) {
                selectedTime.textContent = '';
                anyTimeLabel.style.display = 'block';
            } else {
                selectedTime.textContent = formatTime(timeFilter);
                anyTimeLabel.style.display = 'none';
            }

            // Update scatterplot based on the current time filter
            updateScatterPlot(timeFilter);
        }

        function formatTime(minutes) {
            const date = new Date(0, 0, 0, 0, minutes);
            return date.toLocaleString('en-US', { timeStyle: 'short' });
        }

        // Listen for slider input and update display in real-time
        timeSlider.addEventListener('input', updateTimeDisplay);

        // Initialize display on page load
        updateTimeDisplay();

    } catch (error) {
        console.error('Error loading data:', error);
    }
});

function minutesSinceMidnight(date) {
    return date.getHours() * 60 + date.getMinutes();
}

function filterTripsbyTime(trips, timeFilter) {
    return timeFilter === -1
        ? trips // No filtering if timeFilter is -1
        : trips.filter((trip) => {
            const startedMinutes = minutesSinceMidnight(trip.started_at);
            const endedMinutes = minutesSinceMidnight(trip.ended_at);
            return (
                Math.abs(startedMinutes - timeFilter) <= 60 ||
                Math.abs(endedMinutes - timeFilter) <= 60
            );
        });
}

function computeStationTraffic(stations, trips) {
    const departures = d3.rollup(
        trips,
        (v) => v.length,
        (d) => d.start_station_id
    );

    const arrivals = d3.rollup(
        trips,
        (v) => v.length,
        (d) => d.end_station_id
    );

    return stations.map((station) => {
        let id = station.short_name;
        station.arrivals = arrivals.get(id) ?? 0;
        station.departures = departures.get(id) ?? 0;
        station.totalTraffic = station.arrivals + station.departures;
        return station;
    });
}

let stationFlow = d3.scaleQuantize().domain([0, 1]).range([0, 0.5, 1]);
