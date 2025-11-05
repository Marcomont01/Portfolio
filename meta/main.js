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
  const dots = svg
    .append("g")
    .attr("class", "dots")
    .selectAll("circle")
    .data(commits)
    .join("circle")
    .attr("cx", (d) => xScale(d.datetime)) // X position by date
    .attr("cy", (d) => yScale(d.hourFrac)) // Y position by time
    .attr("r", 5)
    .attr("fill", "steelblue")
    .append("title") // small tooltip on hover
    .text((d) => `${d.author} – ${d.datetime.toLocaleString()}\nLines: ${d.totalLines}`);

  // Update legend color and position when commits change
  // (we could add a small legend later if needed)
}