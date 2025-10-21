import { fetchJSON, renderProjects } from "../global.js";

async function main() {
  const data = await fetchJSON("../lib/projects.json"); // relative to this file
  const listEl  = document.querySelector(".projects");
  const titleEl = document.querySelector(".projects-title");

  renderProjects(data, listEl, "h2");
  if (titleEl) titleEl.textContent = `${Array.isArray(data) ? data.length : 0} Projects`;
}

main();