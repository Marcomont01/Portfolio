// --- Tooltip helpers ---
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

  // --- Define chart scales ---
  // X-axis = dates, Y-axis = time of day
  const xScale = d3
    .scaleTime()
    .domain(d3.extent(commits, (d) => d.datetime)) // get min and max date
    .range([0, width])
    .nice();

  const yScale = d3
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
  const grid = svg
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
let dots = dotsGroup
  .selectAll("circle")
  .data(commits)
  .join("circle")
  .attr("cx", d => xScale(d.datetime))
  .attr("cy", d => yScale(d.hourFrac))
  .attr("r", 5)
  .attr("fill", "steelblue");

// Tooltip events
dots
  .on("mouseenter", (event, commit) => {
    renderTooltipContent(commit);          // fill tooltip
    updateTooltipVisibility(true);         // show tooltip
    updateTooltipPosition(event);          // initial position
  })
  .on("mousemove", (event) => {
    updateTooltipPosition(event);          // follow mouse
  })
  .on("mouseleave", () => {
    updateTooltipVisibility(false);        // hide tooltip
  });

// Update legend color and position when commits change
// (placeholder comment per your request)

  // --- Size dots by number of lines edited ---
const [minLines, maxLines] = d3.extent(commits, d => d.totalLines);

// Use square-root scale so dot *area* is proportional
const rScale = d3.scaleSqrt().domain([minLines, maxLines]).range([2, 30]);

// Apply radius and transparency
dots
  .attr("r", d => rScale(d.totalLines))
  .style("fill-opacity", 0.7);
  }
