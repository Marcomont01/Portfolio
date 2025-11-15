// ===== imports (CDN) =====
import mapboxgl from 'https://cdn.jsdelivr.net/npm/mapbox-gl@2.15.0/+esm';
import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7/+esm';

// constants (URLs from the lab)
// lanes
const BOSTON_LANES_URL =
  'https://bostonopendata-boston.opendata.arcgis.com/datasets/boston::existing-bike-network-2022.geojson';

// paste the Cambridge GeoJSON link from the lab page here:
const CAMBRIDGE_LANES_URL = 'https://raw.githubusercontent.com/cambridgegis/cambridgegis_data/main/Recreation/Bike_Facilities/RECREATION_BikeFacilities.geojson';

// stations + trips
const STATIONS_URL = 'https://dsc106.com/labs/lab07/data/bluebikes-stations.json';
const TRIPS_URL    = 'https://dsc106.com/labs/lab07/data/bluebikes-traffic-2024-03.csv';

// ----- tiny helpers -----

// format minutes since midnight
function formatTime(min) {
  if (Number(min) === 1) return 'Any time';
  const d = new Date(0,0,0,0,0,0,0);
  d.setMinutes(Number(min));
  return d.toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' });
}

// convert lon/lat to current svg pixel coords
function projectToPx([lon, lat]) {
  const p = map.project([lon, lat]);
  return [p.x, p.y];
}

// square-root size scale (looks better for areas)
const radiusScale = d3.scaleSqrt().range([2, 25]);

// 3-bucket color for “flow” (departures ratio)
const flowColor = d3.scaleQuantize().domain([0, 1]).range([
  '#6ea8fe', // more departures
  '#c9c9ff', // balanced
  '#ffb26e'  // more arrivals
]);

// map setup 
mapboxgl.accessToken = 'pk.eyJ1IjoibWFyY29tb250MDEiLCJhIjoiY21odmlmOHFrMGJ3cDJrcTFlc3pzcm9payJ9.J7UxzMmqTskHRGnxs_wSeg'; 

const map = new mapboxgl.Map({
  container: 'map',
  style: 'mapbox://styles/mapbox/streets-v12',
  center: [-71.09415, 42.36027],  // Boston/Cambridge
  zoom: 12,
  minZoom: 5,
  maxZoom: 18
});

// svg overlay + UI refs
const svg = d3.select('#map').select('svg');
const timeSlider = document.getElementById('time-slider');
const timeReadout = document.getElementById('selected-time');

// data holders
let stations = [];
let trips = [];
let filteredStations = []; // will hold stations with computed traffic for current filter

// compute lon/lat -> pixel each render
function getCoords(station) {
  const { lon, lat } = station;
  const [cx, cy] = projectToPx([lon, lat]);
  return { cx, cy };
}

// ----- Step 2: Add bike lanes (Boston + Cambridge) -----
function addBikeLanes() {
  

  map.addSource('boston_route', {
    type: 'geojson',
    data: BOSTON_LANES_URL
  });
    map.addLayer({
      id: 'bike-lanes-boston',
      type: 'line',
      source: 'boston_route',
      paint: {
        'line-color': 'green',
        'line-width': 3,
        'line-opacity': 0.4
      }
    });

    // source + layer for Cambridge lanes (same styling)
    map.addSource('cambridge_route', {
      type: 'geojson',
      data: CAMBRIDGE_LANES_URL
    });
    
    map.addLayer({
      id: 'bike-lanes-cambridge',
      type: 'line',
      source: 'cambridge_route',
      paint: {
        'line-color': 'green',
        'line-width': 3,
        'line-opacity': 0.4
      }
    });
};

// ----- Step 3: Stations (SVG overlay with D3) -----
function setupStations() {
  // select svg once
  const circles = svg.selectAll('circle');

  // helper to (re)position all circles based on current view
  function updatePositions() {
    svg.selectAll('circle')
      .attr('cx', d => getCoords(d).cx)
      .attr('cy', d => getCoords(d).cy);
  }

  // draw circles if not present yet
  function drawCircles() {
    const join = svg
      .selectAll('circle')
      .data(filteredStations, d => d.short_name); // key by station

    join.enter()
      .append('circle')
      .attr('r', d => radiusScale(d.totalTraffic || 0))
      .attr('cx', d => getCoords(d).cx)
      .attr('cy', d => getCoords(d).cy)
      .attr('fill', d => flowColor((d.departures || 0) / Math.max(1, d.totalTraffic || 1)))
      .each(function(d){ // basic tooltip with exact numbers
        d3.select(this).append('title')
          .text(() => `${d.totalTraffic ?? 0} trips (${d.departures ?? 0} departures, ${d.arrivals ?? 0} arrivals)`);
      });

    // update existing
    join
      .attr('r', d => radiusScale(d.totalTraffic || 0))
      .attr('fill', d => flowColor((d.departures || 0) / Math.max(1, d.totalTraffic || 1)))
      .select('title')
      .text(d => `${d.totalTraffic ?? 0} trips (${d.departures ?? 0} departures, ${d.arrivals ?? 0} arrivals)`);

    // remove old
    join.exit().remove();

    updatePositions();
  }

  // reposition on map interactions
  map.on('move', updatePositions);
  map.on('zoom', updatePositions);
  map.on('resize', updatePositions);
  map.on('moveend', updatePositions);

  return { drawCircles };
}

// ----- Step 4 + 5: Load data, compute traffic, filter by time -----

// compute arrivals/departures for all stations given a trips array
function computeStationTraffic(stationsInput, tripsInput) {
  // quick maps for counting
  const depCounts = d3.rollup(tripsInput, v => v.length, d => d.start_station_id);
  const arrCounts = d3.rollup(tripsInput, v => v.length, d => d.end_station_id);

  // attach counts to station objects
  const out = stationsInput.map(s => {
    const departures = depCounts.get(s.id) ?? 0;
    const arrivals   = arrCounts.get(s.id) ?? 0;
    const totalTraffic = departures + arrivals;
    return { ...s, departures, arrivals, totalTraffic };
  });

  // update radius domain with new totals
  radiusScale.domain([0, d3.max(out, d => d.totalTraffic) || 1]);

  return out;
}

// convert a Date to minutes since midnight
function minutesSinceMidnight(date) {
  return date.getHours() * 60 + date.getMinutes();
}

// filter trips by ±60 minutes around selected time (handles wrap-around)
function filterTripsByTime(allTrips, minute) {
  if (Number(minute) === 1) return allTrips; // 1 == “Any time” in our UI

  const minMinute = (Number(minute) - 60 + 1440) % 1440;
  const maxMinute = (Number(minute) + 60) % 1440;

  // precompute minutes for start/end
  return allTrips.filter(t => {
    const mStart = minutesSinceMidnight(t.start);
    const mEnd   = minutesSinceMidnight(t.end);
    // inside window for either start or end
    const inRange = (minMinute <= maxMinute)
      ? (mStart >= minMinute && mStart <= maxMinute) || (mEnd >= minMinute && mEnd <= maxMinute)
      : (mStart >= minMinute || mStart <= maxMinute) || (mEnd >= minMinute || mEnd <= maxMinute);
    return inRange;
  });
}

// ----- Step 5.2: reactivity (hook slider) -----
function wireSlider(onChange) {
  function updateLabel() {
    const v = Number(timeSlider.value);
    timeReadout.textContent = v === 1 ? 'Any time' : formatTime(v);
  }
  timeSlider.addEventListener('input', () => {
    updateLabel();
    onChange(Number(timeSlider.value));
  });
  updateLabel(); // initial text
}

// ===== main load =====
map.on('load', async () => {
  // Step 2: lanes
  addBikeLanes();

  // Step 3.1: load stations (json) + TRIPS (csv)
  // stations json: note structure has data.stations
  const stationsJson = await (await fetch(STATIONS_URL)).json();
  stations = stationsJson.data.stations.map(s => ({
    id: s.number,
    short_name: s.short_name,
    name: s.name,
    lon: s.lon,
    lat: s.lat
  }));

  // trips csv (~260k rows). parse dates right away.
  let tripsRaw = await d3.csv(TRIPS_URL, d => ({
    ride_id: d.ride_id,
    bike_type: d.bike_type,
    start: new Date(d.trip_started_at),
    end:   new Date(d.trip_ended_at),
    start_station_id: +d.start_station_id,
    end_station_id: +d.end_station_id,
    member: d.member
  }));
  trips = tripsRaw; // keep original

  // Step 3.2 + 3.3: add svg overlay and draw circles
  const { drawCircles } = setupStations();

  // initial (no filter) -> compute using all trips
  filteredStations = computeStationTraffic(stations, trips);
  drawCircles();

  // Step 5: slider filter: recompute on change and redraw
  wireSlider((minute) => {
    const t = filterTripsByTime(trips, minute);
    filteredStations = computeStationTraffic(stations, t);

    // redraw circles with new sizes/colors
    drawCircles();
  });
});