console.log("It's Alive!");

// quick selector helper
function $$(selector, context = document) {
  return Array.from(context.querySelectorAll(selector));
}

// handle base paths for GitHub and local
const IS_GH_PAGES = location.hostname.endsWith("github.io");
const REPO = IS_GH_PAGES ? location.pathname.split("/")[1] : "";
const BASE_PATH = IS_GH_PAGES ? `/${REPO}/` : "/";
const BASE_PATH_IMG = IS_GH_PAGES ? `/${REPO}/` : "/";

// list of pages for navbar
const pages = [
  { url: "", title: "Home" },
  { url: "projects/", title: "Projects" },
  { url: "contact/", title: "Contact" },
  { url: "cv/", title: "CV" },
  { url: "https://github.com/marcomont01", title: "Github" }
];

// create and add navbar
const nav = document.createElement("nav");
document.body.prepend(nav);

// make each nav link
for (const p of pages) {
  const href = p.url.startsWith("http") ? p.url : BASE_PATH + p.url;
  const a = document.createElement("a");
  a.href = href;
  a.textContent = p.title;

  if (a.host !== location.host) a.target = "_blank";
  if (a.host === location.host && a.pathname === location.pathname)
    a.classList.add("current");

  nav.append(a);
}

// add theme dropdown
document.body.insertAdjacentHTML(
  "afterbegin",
  `
  <label class="color-scheme">
    <select id="theme-select">
      <option value="light dark">Automatic</option>
      <option value="light">Light</option>
      <option value="dark">Dark</option>
    </select>
  </label>
`
);

const themeSelect = document.querySelector("#theme-select");

// change theme and remember it
function setColorScheme(value) {
  document.documentElement.style.colorScheme = value;
  localStorage.colorScheme = value;
}

themeSelect.addEventListener("change", (e) => setColorScheme(e.target.value));

// load saved theme on startup
if ("colorScheme" in localStorage) {
  const saved = localStorage.colorScheme;
  setColorScheme(saved);
  themeSelect.value = saved;
}

// fetch JSON safely
export async function fetchJSON(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    return await res.json();
  } catch (err) {
    console.error("fetchJSON error:", err);
    return [];
  }
}

// build one project card
export function renderProject(project, container, headingLevel = "h2") {
  if (!container) return;

  const article = document.createElement("article");

  // choose correct image path
  const imgSrc = project.image
    ? (project.image.startsWith("http")
        ? project.image
        : BASE_PATH_IMG + project.image.replace(/^\.?\/*/, ""))
    : "";

  // create image or placeholder
  const imgHTML = imgSrc
    ? `<img src="${imgSrc}" alt="${project.title || ""}" loading="lazy">`
    : `<div class="image-placeholder">IMAGE COMING SOON</div>`;

  // add title and description
  const titleHTML = project.link
    ? `<a href="${project.link}" target="_blank" rel="noopener">${project.title || "Untitled Project"}</a>`
    : project.title || "Untitled Project";

  article.innerHTML = `
    <${headingLevel}>${titleHTML}</${headingLevel}>
    ${imgHTML}
    <p>${project.description || ""}</p>
  `;

  container.appendChild(article);
}

// render a group of projects
export function renderProjects(projects, container, headingLevel = "h2") {
  if (!container) return;
  container.innerHTML = "";
  (projects || []).forEach((p) => renderProject(p, container, headingLevel));
}

// fetch GitHub data for a username
export async function fetchGitHubData(username) {
  // use the GitHub API for that user
  return fetchJSON(`https://api.github.com/users/${username}`);
}