const projects = [
  {
    title: "Project Title",
    subtitle: "Short supporting line.",
    color: "#5c8dad",
    span: "span-2",
  },
  {
    title: "Project Title",
    subtitle: "Short supporting line.",
    color: "#c4551d",
    span: "",
  },
  {
    title: "Project Title",
    subtitle: "Short supporting line.",
    color: "#365b36",
    span: "",
  },
  {
    title: "Project Title",
    subtitle: "Short supporting line.",
    color: "#4a3f4a",
    span: "span-2",
  },
];

const projectsGrid = document.getElementById("projects");

projects.forEach((project) => {
  const card = document.createElement("article");
  card.className = `project-card ${project.span}`.trim();
  card.style.background = project.color;

  card.innerHTML = `
    <h3>${project.title}</h3>
    <p>${project.subtitle}</p>
  `;

  projectsGrid.appendChild(card);
});
