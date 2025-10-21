import { fetchJSON, renderProjects } from "../global.js";

const IS_GH_PAGES = location.hostname.endsWith("github.io");
const REPO = IS_GH_PAGES ? location.pathname.split("/")[1] : "";
const BASE_PATH = IS_GH_PAGES ? `/${REPO}/` : "/";

let ALL = [];

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
  const titleEl = document.querySelector(".projects-title");
  if (titleEl) titleEl.textContent = `${shown.length} Projects`;
}

async function main() {
  ALL = await fetchJSON(`${BASE_PATH}lib/projects.json`);
  populateFilter(getAllTags(ALL));
  applyFilter();
  document.querySelector("#tag-filter")?.addEventListener("change", applyFilter);
}
main();