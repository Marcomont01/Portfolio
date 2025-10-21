// import both functions from global.js
import { fetchJSON, renderProjects } from '../global.js';

// main function to load and display projects
async function main() {
  // get data from your JSON file
  const projects = await fetchJSON('./lib/projects.json');

  // find where to place the projects
  const projectsContainer = document.querySelector('.projects');

  // show all projects on the page
  renderProjects(projects, projectsContainer, 'h2');

  // show project count in the page title
  const title = document.querySelector('.projects-title');
  title.textContent = `${projects.length} Projects`;
}

// run the main function
main();