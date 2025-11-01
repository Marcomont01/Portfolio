import { fetchJSON, renderProjects } from "../global.js";
import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7/+esm";

const IS_GH_PAGES = location.hostname.endsWith("github.io");
const REPO = IS_GH_PAGES ? location.pathname.split("/")[1] : "";
const BASE_PATH = IS_GH_PAGES ? `/${REPO}/` : "/";

let ALL = [];
let SELECTED_YEAR = null; // which year is currently selected in the pie (null = show all)

function getAllTags(items) {
  const set = new Set();
  (items || []).forEach(p => (p.tags || []).forEach(t => set.add(t)));
  return Array.from(set).sort();
}

function populateFilter(tags) {
  const sel = document.querySelector("#tag-filter");
  if (!sel) return;
  sel.innerHTML = `<option value="">All</option>` + tags.map(t => `<option>${t}</option>`).join("");
}

function applyFilter() {
  const sel = document.querySelector("#tag-filter");
  const tag = sel?.value || "";
  const listEl = document.querySelector(".projects");
  const shown = tag ? ALL.filter(p => (p.tags || []).includes(tag)) : ALL;
  renderProjects(shown, listEl, "h2");
  drawPie(shown);
  const titleEl = document.querySelector(".projects-title");
  if (titleEl) titleEl.textContent = `${shown.length} Projects`;
}
let query = ''; // global search text

function addSearchFeature() {
  const searchInput = document.querySelector('.searchBar');
  if (!searchInput) return;

  searchInput.addEventListener('input', (event) => {
    query = event.target.value.toLowerCase();

    // filter projects by all metadata (title, desc, year, etc.)
    const filteredProjects = ALL.filter((project) => {
      const values = Object.values(project).join('\n').toLowerCase();
      return values.includes(query);
    });

    // render filtered projects
    renderProjects(filteredProjects, document.querySelector('.projects'), 'h2');

    // update pie + legend to reflect visible projects
    drawPie(filteredProjects);
  });
}

async function main() {
  ALL = await fetchJSON(`${BASE_PATH}lib/projects.json`);
  populateFilter(getAllTags(ALL));
  applyFilter();
  addSearchFeature();
  document.querySelector("#tag-filter")?.addEventListener("change", applyFilter);
}
main();

// count how many projects per year
function groupCountsByYear(items) {
  const counts = new Map();
  for (const p of items) {
    const y = String(p.year ?? "Unknown"); // use "Unknown" if year is missing
    counts.set(y, (counts.get(y) || 0) + 1);
  }
  return Array.from(counts.entries()).sort((a, b) => b[0].localeCompare(a[0])); // sort newest first
}

// draw the pie chart on the page
function drawPie(items) {
  const svg = d3.select("#projects-pie-plot"); // grab the svg
  if (svg.empty()) return;
  svg.selectAll("*").remove(); // clear anything already there

  const data = groupCountsByYear(items); // get data grouped by year
  if (!data.length) return; // stop if no data

  const pie = d3.pie().sort(null).value(d => d[1]); // make pie layout
  const arcs = pie(data); // create arcs

  const arc = d3.arc().innerRadius(0).outerRadius(48); // shape of each slice
  const color = d3.scaleOrdinal(d3.schemeTableau10).domain(data.map(d => d[0])); // colors for slices
  drawLegend(data, color);
  // draw each slice of the pie
  let selectedIndex = -1; // keeps track of which slice is selected

svg.append("g")
  .selectAll("path")
  .data(arcs)
  .join("path")
  .attr("d", arc)
  // if selected: turn green; else use palette color
  .attr("fill", d => (String(d.data[0]) === String(SELECTED_YEAR) ? "#2ecc71" : color(d.data[0])))
  // dim non-selected wedges when something is selected
  .attr("opacity", d => (SELECTED_YEAR && String(d.data[0]) !== String(SELECTED_YEAR) ? 0.35 : 1))
  .attr("stroke", "white")
  .attr("stroke-width", 1)
  .style("cursor", "pointer")
  .on("click", (event, d) => {
    const year = String(d.data[0]);

    // toggle selection (null clears highlight)
    SELECTED_YEAR = (SELECTED_YEAR === year) ? null : year;

    // filter the PROJECT CARDS only (optional—remove this block if you don't want cards to filter)
    const filtered = SELECTED_YEAR
      ? ALL.filter(p => String(p.year) === String(SELECTED_YEAR))
      : ALL;
    renderProjects(filtered, document.querySelector(".projects"), "h2");

    // re-draw the pie with the SAME 'items' passed in (so pie stays whole),
    // but styling will reflect the new SELECTED_YEAR state.
    drawPie(items);
  });

  // add small text labels in the pie
  const label = d3.arc().innerRadius(28).outerRadius(28);
  svg.append("g")
    .attr("font-size", 3.6)
    .attr("text-anchor", "middle")
    .selectAll("text")
    .data(arcs)
    .join("text")
    .attr("transform", d => `translate(${label.centroid(d)})`)
    .text(d => `${d.data[0]} (${d.data[1]})`);
}

// build the legend list from [label, value] data
function drawLegend(pairs, color) {
  const legend = d3.select(".legend");
  if (legend.empty()) return;

  const items = pairs.map(([label, value]) => ({ label, value }));

  const li = legend.selectAll("li").data(items, d => d.label).join("li")
    .attr("style", (d, i) => `--color:${color(d.label)};`);

  li.html(d => `
    <span class="swatch" style="background: var(--color)"></span>
    ${d.label} <em>(${d.value})</em>
  `);
}