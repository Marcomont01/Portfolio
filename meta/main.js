import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7/+esm';

// Global state so brush helpers can access scales & data
let COMMITS = [];
let xScale, yScale;

// Fills the tooltip with the current commit
function renderTooltipContent(commit) {
  const link = document.getElementById('commit-link');
  const date = document.getElementById('commit-date');
  if (!commit) return;

  link.href = commit.url;            // link to the commit on GitHub
  link.textContent = commit.id;      // short commit id
  date.textContent = commit.datetime?.toLocaleString('en', { dateStyle: 'full' });
}

// Shows or hides the tooltip
function updateTooltipVisibility(isVisible) {
  const tip = document.getElementById('commit-tooltip');
  tip.hidden = !isVisible;
}

// Moves the tooltip near the mouse
function updateTooltipPosition(event) {
  const tip = document.getElementById('commit-tooltip');
  tip.style.left = `${event.clientX}px`;
  tip.style.top  = `${event.clientY}px`;
}

//  Summary stats
function renderCommitInfo(data, commits) {
  const dl = d3.select('#stats').append('dl').attr('class', 'stats');

  // Total lines of code across loc.csv
  const totalLOC = d3.sum(data, d => d.length);
  dl.append('dt').html('Total <abbr title="Lines of code">LOC</abbr>');
  dl.append('dd').text(totalLOC);

  // Total commits (after grouping)
  dl.append('dt').text('Total commits');
  dl.append('dd').text(commits.length);
}

// Brushing helpers
function isCommitSelected(selection, commit) {
  if (!selection) return false;
  const [[x0, y0], [x1, y1]] = selection;
  const cx = xScale(commit.datetime);
  const cy = yScale(commit.hourFrac);
  return x0 <= cx && cx <= x1 && y0 <= cy && cy <= y1;
}

// Show "N commits selected" under chart
function renderSelectionCount(selection) {
  const selected = selection
    ? COMMITS.filter(d => isCommitSelected(selection, d))
    : [];
  const el = document.querySelector('#selection-count');
  if (el) el.textContent = `${selected.length || 'No'} commits selected`;
  return selected;
}

// Show language breakdown for selected commits (or all if none)
function renderLanguageBreakdown(selection) {
  const container = document.getElementById('language-breakdown');
  if (!container) return;

  const chosen = selection
    ? COMMITS.filter(d => isCommitSelected(selection, d))
    : [];

  const lines = (chosen.length ? chosen : COMMITS).flatMap(d => d.lines);

  // Count lines per language/type
  const breakdown = d3.rollup(lines, v => v.length, d => d.type);

  // Render
  container.innerHTML = '';
  const total = lines.length || 1;
  for (const [language, count] of breakdown) {
    const proportion = count / total;
    const formatted = d3.format('.1~%')(proportion);
    container.innerHTML += `
      <dt>${language}</dt>
      <dd>${count} lines (${formatted})</dd>
    `;
  }
}

// Brush event handler (start/brush/end)
function brushed(event) {
  const selection = event.selection;

  // Visually tag dots
  d3.selectAll('circle').classed('selected', d => isCommitSelected(selection, d));

  // Update summary below
  renderSelectionCount(selection);
  renderLanguageBreakdown(selection);
}

// Read meta/loc.csv and convert strings to useful JS types
async function loadData() {
  const rows = await d3.csv('loc.csv', (row) => {
    const dt = new Date(`${row.date}T${row.time || '00:00'}${row.timezone || ''}`);
    return {
      commit: row.commit,        // <-- IMPORTANT: keep commit id
      file: row.file,
      type: row.type,
      author: row.author,
      line: +row.line,
      depth: +row.depth,
      length: +row.length,
      date: row.date,
      time: row.time,
      timezone: row.timezone,
      datetime: dt,
    };
  });
  return rows;
}

// Collapse rows into one object per commit (with a hidden .lines array)
function processCommits(data) {
  return d3.groups(data, d => d.commit).map(([commit, lines]) => {
    const first = lines[0];
    const ret = {
      id: commit,
      url: `https://github.com/Marcomont01/Portfolio/commit/${commit}`, 
      date: first.date,
      time: first.time,
      timezone: first.timezone,
      datetime: first.datetime,
      // decimal hour for Y positioning
      hourFrac: first.datetime.getHours() + first.datetime.getMinutes() / 60,
      // derived: number of lines touched in this commit
      totalLines: lines.length,
    };
    // keep the full line details but don’t clutter console prints
    Object.defineProperty(ret, 'lines', { value: lines, enumerable: false });
    return ret;
  });
}

function renderScatterPlot(data, commits) {
  // --- Setup chart size ---
  const width = 1000;
  const height = 600;

  // Create SVG container in the "chart" div
  const svg = d3
    .select("#chart")
    .append("svg")
    .attr("viewBox", `0 0 ${width} ${height}`)
    .style("overflow", "visible");

  // Define chart scales 
  // X-axis = dates, Y-axis = time of day
  xScale = d3
    .scaleTime()
    .domain(d3.extent(commits, (d) => d.datetime)) // get min and max date
    .range([0, width])
    .nice();

  yScale = d3
    .scaleLinear()
    .domain([0, 24]) // hours in a day
    .range([height, 0]);

  // --- Add margins for spacing ---
  const margin = { top: 10, right: 10, bottom: 30, left: 28 };
  const usableArea = {
    top: margin.top,
    right: width - margin.right,
    bottom: height - margin.bottom,
    left: margin.left,
    width: width - margin.left - margin.right,
    height: height - margin.top - margin.bottom,
  };

  // Update scale ranges to leave room for labels and axes
  xScale.range([usableArea.left, usableArea.right]);
  yScale.range([usableArea.bottom, usableArea.top]);

  // --- Add gridlines before drawing the axes ---
  // These help you line up dots with their times
  svg
    .append("g")
    .attr("class", "gridlines")
    .attr("transform", `translate(${usableArea.left}, 0)`)
    .call(d3.axisLeft(yScale).tickFormat("").tickSize(-usableArea.width));

  // --- Create axes ---
  const xAxis = d3.axisBottom(xScale);
  const yAxis = d3
    .axisLeft(yScale)
    .tickFormat((d) => String(d % 24).padStart(2, "0") + ":00"); // format 0→00:00 etc.

  // Add x-axis at the bottom
  svg
    .append("g")
    .attr("transform", `translate(0, ${usableArea.bottom})`)
    .call(xAxis);

  // Add y-axis on the left
  svg
    .append("g")
    .attr("transform", `translate(${usableArea.left}, 0)`)
    .call(yAxis);

  // --- Add dots for each commit ---
  // Each circle = one commit
  
const dotsGroup = svg.append("g").attr("class", "dots");

// Sort largest first later in Step 4; for now render directly
const sortedCommits = d3.sort(commits, d => -d.totalLines); // largest first

let dots = dotsGroup
  .selectAll("circle")
  .data(commits)
  .join("circle")
  .attr("cx", d => xScale(d.datetime))
  .attr("cy", d => yScale(d.hourFrac))
  .attr("r", 5)
  .attr("fill", "steelblue");

  // Size by totalLines (square-root => area ~ count)
  const [minLines, maxLines] = d3.extent(commits, d => d.totalLines);
  const rScale = d3.scaleSqrt().domain([minLines, maxLines]).range([2, 30]);
// Tooltip events

 dots
    .attr("r", d => rScale(d.totalLines))
    .style("fill-opacity", 0.7);

dots
  .on("mouseenter", (event, commit) => {
  d3.select(event.currentTarget).style('fill-opacity', 1);
  renderTooltipContent(commit);
  updateTooltipVisibility(true);
  updateTooltipPosition(event);
})
.on("mousemove", (event) => {
  updateTooltipPosition(event);
})
.on("mouseleave", (event) => {
  d3.select(event.currentTarget).style('fill-opacity', 0.7);
  updateTooltipVisibility(false);
});

// --- Brushing (inside the function so svg is in scope) ---
  svg.call(d3.brush().on("start brush end", brushed));

  // Keep tooltips working: raise dots above the overlay rectangle
  svg.selectAll(".dots, .overlay ~ *").raise();
}

async function init() {
  try {
    const data = await loadData();
    const commits = processCommits(data);
COMMITS = commits;                

renderCommitInfo(data, commits);  

// Small boot-time message (optional)
const countP = document.getElementById('selection-count');
if (countP) countP.textContent = `Loaded ${commits.length} commits`;

renderScatterPlot(data, commits);


  } catch (err) {
    console.error('Meta page init failed:', err);
    const countP = document.getElementById('selection-count');
    if (countP) countP.textContent = 'Failed to load data (open console)';
  }
}

// kick things off
init();