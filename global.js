console.log("It's Alive!");

function $$(selector, context = document) {
  return Array.from(context.querySelectorAll(selector));
}
const IS_GH_PAGES = location.hostname.endsWith("github.io");
const REPO = IS_GH_PAGES ? location.pathname.split("/")[1] : "";
const BASE_PATH = IS_GH_PAGES ? `/${REPO}/` : "/";   // e.g., "/PORTFOLIO/" on GH, "/" locally

 //Pages with their URLs
const pages = [
  { url: "",          title: "Home" },
  { url: "projects/", title: "Projects" },
  { url: "contact/",  title: "Contact" },
  { url: "cv/",       title: "CV" },
  { url: "https://github.com/marcomont01", title: "Github" }
];


//make sure it works locally and on GitHub
const nav = document.createElement("nav");

//puts <nav> at the top of the page
document.body.prepend(nav);

//for each page in the list
for (const p of pages) {
  // adds folder name of the link is not a full URL
  const href = p.url.startsWith("http") ? p.url : BASE_PATH + p.url;

  // make a new <a> tag
  const a = document.createElement("a");
  a.href = href; // set where it goes
  a.textContent = p.title; // set the link name

  // make GitHub open in a new tab
  if (a.host !== location.host) {
    a.target = "_blank";
  }

  // highlight current page link
  if (a.host === location.host && a.pathname === location.pathname) {
    a.classList.add("current");
  }

  // add link to <nav>
  nav.append(a);
}

// Dark mode theme switch
document.body.insertAdjacentHTML(
  'afterbegin',
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

// make dropdown work
const themeSelect = document.querySelector("#theme-select");


// save and load theme preference
function setColorScheme(value) {
  document.documentElement.style.colorScheme = value; // apply theme
  localStorage.colorScheme = value;                   // save it
}

// when dropdown changes
themeSelect.addEventListener("change", (e) => {
  setColorScheme(e.target.value);
});

// when page loads, check saved theme
if ("colorScheme" in localStorage) {
  const saved = localStorage.colorScheme;
  setColorScheme(saved);
  themeSelect.value = saved; // show saved option in dropdown
}

// fetch a JSON file and return parsed data (or [] on error)
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


export function renderProject(project, container, headingLevel = "h2") {
  if (!container) return;

  const article = document.createElement("article");

  const imgHTML = project.image
    ? `<img src="${project.image}" alt="${project.title || ""}" loading="lazy">`
    : `<div class="image-placeholder">IMAGE COMING SOON</div>`;

  const titleHTML = project.link
    ? `<a href="${project.link}" target="_blank" rel="noopener">${project.title || "Untitled Project"}</a>`
    : (project.title || "Untitled Project");

  const tags = Array.isArray(project.tags) ? project.tags : [];
  const tagsHTML = tags.length
    ? `<div style="margin:.5rem 0 0; display:flex; gap:.5rem; flex-wrap:wrap;">
         ${tags.map(t => `<span style="font-size:.75rem; padding:.2rem .5rem; border-radius:999px; background:#e5e7eb; color:#111;">${t}</span>`).join("")}
       </div>`
    : "";

  article.innerHTML = `
    <${headingLevel} style="margin:0 0 .5rem 0">${titleHTML}</${headingLevel}>
    ${imgHTML}
    <p>${project.description || ""}</p>
    ${tagsHTML}
  `;

  container.appendChild(article);
}

