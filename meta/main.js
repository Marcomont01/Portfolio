import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7/+esm';

/* ----------------------------------------------------
   GLOBAL STATE
---------------------------------------------------- */

// All processed commits (one object per commit)
let COMMITS = [];

// All original rows from loc.csv (one per file + line + commit)
let RAW_LINES = [];

// D3 pieces used by the scatterplot
let xScale, yScale;
let svg, dotsGroup, rScale;

// Observers used for scrollytelling
let topObserver = null;      // for top scrolly (scatter)
let filesObserver = null;    // for Codebase evolution scrolly


/* ----------------------------------------------------
   TOOLTIP HELPERS
---------------------------------------------------- */

// Fill tooltip with info about one commit
function renderTooltipContent(commit) {
  const link = document.getElementById('commit-link');
  const date = document.getElementById('commit-date');
  if (!link || !date || !commit) return;

  link.href = commit.url;
  link.textContent = commit.id; // short id
  date.textContent = commit.datetime?.toLocaleString('en', {
    dateStyle: 'full',
    timeStyle: 'short',
  });
}

// Show or hide the tooltip box
function updateTooltipVisibility(isVisible) {
  const tip = document.getElementById('commit-tooltip');
  if (!tip) return;
  tip.hidden = !isVisible;
}

// Move tooltip to follow the mouse
function updateTooltipPosition(event) {
  const tip = document.getElementById('commit-tooltip');
  if (!tip) return;
  tip.style.left = `${event.clientX}px`;
  tip.style.top = `${event.clientY}px`;
}


/* ----------------------------------------------------
   SUMMARY STATS (HEADER)
---------------------------------------------------- */

// Render top stats row: COMMITS, FILES, TOTAL LOC, etc.
function renderCommitInfo(data, commits) {
  const statsDiv = d3.select('#stats');
  statsDiv.html('');

  const dl = statsDiv.append('dl').attr('class', 'stats');

  dl.append('dt').text('COMMITS');
  dl.append('dd').text(commits.length);

  const fileCount = new Set(data.map(d => d.file)).size;
  dl.append('dt').text('FILES');
  dl.append('dd').text(fileCount);

  const totalLOC = d3.sum(data, d => d.length);
  dl.append('dt').html('TOTAL <abbr title="Lines of code">LOC</abbr>');
  dl.append('dd').text(totalLOC);

  dl.append('dt').text('MAX DEPTH');
  dl.append('dd').text(d3.max(data, d => d.depth));

  dl.append('dt').text('LONGEST LINE');
  dl.append('dd').text(d3.max(data, d => d.length));

  const linesPerFile = d3.rollup(data, v => v.length, d => d.file);
  dl.append('dt').text('MAX LINES');
  dl.append('dd').text(d3.max(linesPerFile.values()));
}


/* ----------------------------------------------------
   BRUSH HELPERS
---------------------------------------------------- */

// Is a commit dot inside the current brush box?
function isCommitSelected(selection, commit) {
  if (!selection) return false;
  const [[x0, y0], [x1, y1]] = selection;
  const cx = xScale(commit.datetime);
  const cy = yScale(commit.hourFrac);
  return x0 <= cx && cx <= x1 && y0 <= cy && cy <= y1;
}

// Update "N commits selected" text
function renderSelectionCount(selection) {
  const selected = selection
    ? COMMITS.filter(d => isCommitSelected(selection, d))
    : [];
  const el = document.querySelector('#selection-count');
  if (el) el.textContent = `${selected.length || 'No'} commits selected`;
}

// Language breakdown (css/html/js) for a set of commits
// selection: brush selection (or null)
// commitsForCalc: which commits to summarize (default = all)
function renderLanguageBreakdown(selection, commitsForCalc = COMMITS) {
  const container = document.getElementById('language-breakdown');
  if (!container) return;

  const chosen = selection
    ? commitsForCalc.filter(d => isCommitSelected(selection, d))
    : commitsForCalc.slice();

  const lines = chosen.flatMap(d => d.lines);
  const breakdown = d3.rollup(lines, v => v.length, d => d.type);

  container.innerHTML = '';
  const total = lines.length || 1;

  for (const [language, count] of breakdown) {
    const pct = d3.format('.1~%')(count / total);
    container.innerHTML += `
      <dt>${language}</dt>
      <dd>${count} lines (${pct})</dd>
    `;
  }
}

// Brush handler for scatterplot
function brushed(event) {
  const selection = event.selection;

  d3.selectAll('circle').classed('selected', d =>
    isCommitSelected(selection, d)
  );

  renderSelectionCount(selection);
  renderLanguageBreakdown(selection);
}


/* ----------------------------------------------------
   DATA LOADING
---------------------------------------------------- */

// Load loc.csv and convert each row
async function loadData() {
  const rows = await d3.csv('loc.csv', row => {
    const dt = new Date(
      `${row.date}T${row.time || '00:00'}${row.timezone || ''}`
    );
    return {
      commit: row.commit,
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

// Group rows by commit id and build commit objects
function processCommits(data) {
  return d3.groups(data, d => d.commit).map(([commit, lines]) => {
    const first = lines[0];

    const obj = {
      id: commit,
      url: `https://github.com/Marcomont01/Portfolio/commit/${commit}`,
      date: first.date,
      time: first.time,
      timezone: first.timezone,
      datetime: first.datetime,
      hourFrac:
        first.datetime.getHours() + first.datetime.getMinutes() / 60,
      totalLines: lines.length,
    };

    // store full line list as a hidden property
    Object.defineProperty(obj, 'lines', {
      value: lines,
      enumerable: false,
    });

    return obj;
  });
}


/* ----------------------------------------------------
   SCATTERPLOT (INIT + UPDATE)
---------------------------------------------------- */

// Build axes, grid, and container once
function initScatterPlot(commits) {
  const width = 1000;
  const height = 600;

  const margin = { top: 10, right: 10, bottom: 30, left: 28 };
  const usableArea = {
    top: margin.top,
    right: width - margin.right,
    bottom: height - margin.bottom,
    left: margin.left,
    width: width - margin.left - margin.right,
    height: height - margin.top - margin.bottom,
  };

  svg = d3
    .select('#chart')
    .append('svg')
    .attr('viewBox', `0 0 ${width} ${height}`)
    .style('overflow', 'visible');

  // X = time
  xScale = d3
    .scaleTime()
    .domain(d3.extent(commits, d => d.datetime))
    .range([usableArea.left, usableArea.right])
    .nice();

  // Y = hour of day
  yScale = d3
    .scaleLinear()
    .domain([0, 24])
    .range([usableArea.bottom, usableArea.top]);

  // Horizontal gridlines
  svg
    .append('g')
    .attr('class', 'gridlines')
    .attr('transform', `translate(${usableArea.left}, 0)`)
    .call(d3.axisLeft(yScale).tickFormat('').tickSize(-usableArea.width));

  // Axes
  const xAxis = d3.axisBottom(xScale);
  const yAxis = d3
    .axisLeft(yScale)
    .tickFormat(d => String(d % 24).padStart(2, '0') + ':00');

  svg
    .append('g')
    .attr('transform', `translate(0, ${usableArea.bottom})`)
    .call(xAxis);

  svg
    .append('g')
    .attr('transform', `translate(${usableArea.left}, 0)`)
    .call(yAxis);

  const [minLines, maxLines] = d3.extent(commits, d => d.totalLines);
  rScale = d3.scaleSqrt().domain([minLines, maxLines]).range([2, 30]);

  dotsGroup = svg.append('g').attr('class', 'dots');

  updateScatterPlot(commits);

  svg.call(d3.brush().on('start brush end', brushed));

  svg.selectAll('.dots, .overlay ~ *').raise();
}

// Update the scatterplot when visible commits change
function updateScatterPlot(commitsToShow) {
  if (!commitsToShow || commitsToShow.length === 0) {
    dotsGroup.selectAll('circle').remove();
    return;
  }

  const sorted = d3.sort(commitsToShow, d => -d.totalLines);

  const dots = dotsGroup
    .selectAll('circle')
    .data(sorted, d => d.id); // key by commit id

  dots.exit().remove();

  const dotsEnter = dots
    .enter()
    .append('circle')
    .attr('cx', d => xScale(d.datetime))
    .attr('cy', d => yScale(d.hourFrac))
    .attr('r', 0)
    .attr('fill', 'steelblue')
    .style('fill-opacity', 0.7);

  dotsEnter
    .merge(dots)
    .transition()
    .duration(300)
    .attr('cx', d => xScale(d.datetime))
    .attr('cy', d => yScale(d.hourFrac))
    .attr('r', d => rScale(d.totalLines));

  dotsEnter
    .merge(dots)
    .on('mouseenter', (event, commit) => {
      d3.select(event.currentTarget).style('fill-opacity', 1);
      renderTooltipContent(commit);
      updateTooltipVisibility(true);
      updateTooltipPosition(event);
    })
    .on('mousemove', event => {
      updateTooltipPosition(event);
    })
    .on('mouseleave', event => {
      d3.select(event.currentTarget).style('fill-opacity', 0.7);
      updateTooltipVisibility(false);
    });
}


/* ----------------------------------------------------
   SCROLLYTELLING STORIES
---------------------------------------------------- */

// Build top-left story: one "step" per commit
function renderCommitStory(commits) {
  const story = d3.select('#scatter-story');
  story.html('');

  const sorted = commits
    .slice()
    .sort((a, b) => d3.ascending(a.datetime, b.datetime));

  const steps = story
    .selectAll('.step')
    .data(sorted)
    .join('div')
    .attr('class', 'step')
    .attr('data-index', (_, i) => i)
    .html(d => {
      const when = d.datetime.toLocaleString('en', {
        dateStyle: 'full',
        timeStyle: 'short',
      });
      const lineCount = d.lines.length;
      const fileCount = new Set(d.lines.map(l => l.file)).size;
      return `
        <p>On ${when}, I made <a href="${d.url}" target="_blank" rel="noopener">another glorious commit</a>.
        I edited ${lineCount} lines across ${fileCount} files.</p>
      `;
    });

  return steps.nodes();
}

// Build bottom-right story (under Codebase evolution)
function renderCodebaseStory(commits) {
  const container = d3.select('#files-story');
  container.html('');

  const sorted = commits
    .slice()
    .sort((a, b) => d3.ascending(a.datetime, b.datetime));

  const steps = container
    .selectAll('.files-step')
    .data(sorted)
    .join('div')
    .attr('class', 'files-step')
    .attr('data-index', (_, i) => i)
    .html(d => {
      const when = d.datetime.toLocaleString('en', {
        dateStyle: 'full',
        timeStyle: 'short',
      });
      const lineCount = d.lines.length;
      const fileCount = new Set(d.lines.map(l => l.file)).size;
      return `
        <p>On ${when}, I made <a href="${d.url}" target="_blank" rel="noopener">another glorious commit</a>.
        I edited ${lineCount} lines across ${fileCount} files.</p>
      `;
    });

  return steps.nodes();
}


/* ----------------------------------------------------
   SCROLLY CONTROLLERS
---------------------------------------------------- */

// Top scrolly: controls scatterplot + language breakdown
function setupTopScrolly(commits) {
  const steps = renderCommitStory(commits);

  const sortedCommits = commits
    .slice()
    .sort((a, b) => d3.ascending(a.datetime, b.datetime));

  if (topObserver) topObserver.disconnect();

  topObserver = new IntersectionObserver(
    entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;

        const el = entry.target;
        const index = Number(el.dataset.index);
        const currentCommit = sortedCommits[index];

        steps.forEach(stepEl =>
          stepEl.classList.toggle('active', stepEl === el)
        );

        const cutoff = currentCommit.datetime;
        const subset = COMMITS.filter(d => d.datetime <= cutoff);

        updateScatterPlot(subset);
        renderSelectionCount(null);
        renderLanguageBreakdown(null, subset);
      });
    },
    {
      threshold: 0.05,
      rootMargin: '-40% 0px -40% 0px',
    }
  );

  steps.forEach(stepEl => topObserver.observe(stepEl));

  // Initial view for top scrolly
  if (sortedCommits.length > 0) {
    const cutoff = sortedCommits[0].datetime;
    const subset = COMMITS.filter(d => d.datetime <= cutoff);
    updateScatterPlot(subset);
    renderLanguageBreakdown(null, subset);
    steps[0].classList.add('active');
  }
}

// Bottom scrolly: controls Codebase evolution (unit viz)
function setupFilesScrolly(commits, allLines) {
  const steps = renderCodebaseStory(commits);

  const sortedCommits = commits
    .slice()
    .sort((a, b) => d3.ascending(a.datetime, b.datetime));

  if (filesObserver) filesObserver.disconnect();

  filesObserver = new IntersectionObserver(
    entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;

        const el = entry.target;
        const index = Number(el.dataset.index);
        const currentCommit = sortedCommits[index];

        steps.forEach(stepEl =>
          stepEl.classList.toggle('active', stepEl === el)
        );

        const cutoff = currentCommit.datetime;
        const subset = COMMITS.filter(d => d.datetime <= cutoff);
        const activeIds = new Set(subset.map(d => d.id));
        const lineSubset = allLines.filter(row => activeIds.has(row.commit));

        // Unit viz now driven by BOTTOM story
        renderUnitVisualization(lineSubset);
      });
    },
    {
      threshold: 0.05,
      rootMargin: '-40% 0px -40% 0px',
    }
  );

  steps.forEach(stepEl => filesObserver.observe(stepEl));

  // Initial view for Codebase evolution
  if (sortedCommits.length > 0) {
    const cutoff = sortedCommits[0].datetime;
    const subset = COMMITS.filter(d => d.datetime <= cutoff);
    const activeIds = new Set(subset.map(d => d.id));
    const lineSubset = allLines.filter(row => activeIds.has(row.commit));

    renderUnitVisualization(lineSubset);
    steps[0].classList.add('active');
  }
}


/* ----------------------------------------------------
   UNIT VISUALIZATION (FILES)
---------------------------------------------------- */

// One row per file: [file name] | [dots] | [NN lines]
function renderUnitVisualization(linesData) {
  const container = d3.select('#files');
  container.html('');

  const files = d3
    .groups(linesData, d => d.file)
    .map(([file, lines]) => ({ file, lines }))
    .sort((a, b) => d3.descending(a.lines.length, b.lines.length));

  const color = d3.scaleOrdinal(d3.schemeTableau10);

  const rows = container
    .selectAll('.file-row')
    .data(files)
    .join(enter => {
      const row = enter.append('div').attr('class', 'file-row');
      row.append('div').attr('class', 'file-label'); // left
      row.append('div').attr('class', 'file-dots');  // middle
      row.append('div').attr('class', 'file-count'); // right
      return row;
    });

  rows.select('.file-label').text(d => d.file);
  rows.select('.file-count').text(d => `${d.lines.length} lines`);

  rows.each(function (d) {
    const dots = d3
      .select(this)
      .select('.file-dots')
      .selectAll('span.file-dot')
      .data(d3.range(d.lines.length));

    dots
      .join('span')
      .attr('class', 'file-dot')
      .style('background-color', color(d.file));
  });
}


/* ----------------------------------------------------
   INIT
---------------------------------------------------- */

async function init() {
  try {
    const data = await loadData();
    const commits = processCommits(data);

    RAW_LINES = data;
    COMMITS = commits;

    renderCommitInfo(data, commits);
    initScatterPlot(commits);

    // TOP scrolly: scatter + language breakdown
    setupTopScrolly(commits);

    // BOTTOM scrolly: Codebase evolution (unit viz)
    setupFilesScrolly(commits, data);

    const countP = document.getElementById('selection-count');
    if (countP) countP.textContent = 'No commits selected';
  } catch (err) {
    console.error('Meta page init failed:', err);
    const countP = document.getElementById('selection-count');
    if (countP) countP.textContent = 'Failed to load data (open console)';
  }
}

// Start everything
init();