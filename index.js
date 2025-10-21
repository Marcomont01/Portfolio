import { fetchJSON, renderProjects } from "./global.js";

// handle local and GitHub paths
const IS_GH_PAGES = location.hostname.endsWith("github.io");
const REPO = IS_GH_PAGES ? location.pathname.split("/")[1] : "";
const BASE_PATH = IS_GH_PAGES ? `/${REPO}/` : "/";

// load only the first 3 projects
async function main() {
  const projects = await fetchJSON(`${BASE_PATH}lib/projects.json`);
  const latest = (projects || []).slice(0, 3);
  const container = document.querySelector(".projects");
  renderProjects(latest, container, "h3");
}

main();

import { fetchGitHubData } from "./global.js";

async function loadGitHubStats() {
  // find where to show the stats
  const profileStats = document.querySelector("#profile-stats");
  if (!profileStats) return;

  // get GitHub info for your username
  const githubData = await fetchGitHubData("marcomont01");

  // show the data nicely
  profileStats.innerHTML = `
    <dl>
      <dt>Followers:</dt><dd>${githubData.followers}</dd>
      <dt>Following:</dt><dd>${githubData.following}</dd>
      <dt>Public Repos:</dt><dd>${githubData.public_repos}</dd>
      <dt>Public Gists:</dt><dd>${githubData.public_gists}</dd>
    </dl>
  `;
}

loadGitHubStats();