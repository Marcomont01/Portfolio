console.log("It's Alive!");

function $$(selector, context = document) {
  return Array.from(context.querySelectorAll(selector));
}
 //Pages with their URLs
const pages = [
  { url: "",          title: "Home" },
  { url: "projects/", title: "Projects" },
  { url: "contact/",  title: "Contact" },
  { url: "cv/",       title: "CV" },
  { url: "https://github.com/marcomont01", title: "Github" }
];

//make sure it works locally and on GitHub
const BASE_PATH =
  location.hostname === "localhost" || location.hostname === "127.0.0.1"
    ? "/"              // local server
    : "/Portfolio/";

  //<nav> tag
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
