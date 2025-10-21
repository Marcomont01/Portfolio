import { fetchJSON, renderProjects } from "../global.js";

const IS_GH_PAGES = location.hostname.endsWith("github.io");
const REPO = IS_GH_PAGES ? location.pathname.split("/")[1] : "";
const BASE_PATH = IS_GH_PAGES ? `/${REPO}/` : "/";

async function main() {
  const data = await fetchJSON(`${BASE_PATH}lib/projects.json`);

  const listEl  = document.querySelector(".projects");
  const titleEl = document.querySelector(".projects-title");

  renderProjects(data, listEl, "h2");
  if (titleEl) titleEl.textContent = `${Array.isArray(data) ? data.length : 0} Projects`;
}
main();