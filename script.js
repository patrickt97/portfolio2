const projects = [
  {
    title: "Pikkit Replay",
    subtitle: "Your year in sports betting.",
    image: "assets/Replay.png",
    url: "https://pikkit.com/replay",
    span: "span-2",
  },
  {
    title: "Bristle",
    subtitle: "Airbnb clean. Anytime.",
    image: "assets/Bristle.png",
    span: "",
  },
  {
    title: "Pikkit Betslip",
    subtitle: "Industry defining bet placing.",
    image: "assets/Betslip.png",
    span: "",
  },
  {
    title: "Achievements",
    subtitle: "Gamifying with 3D assets.",
    image: "assets/Achievements_Dark.png",
    span: "span-2",
  },
];

const projectsGrid = document.getElementById("projects");

projects.forEach((project) => {
  const card = document.createElement("article");
  card.className = `project-card reveal ${project.span}`.trim();
  card.style.backgroundColor = project.color;
  if (project.image) {
        card.style.backgroundImage = `url(${project.image})`;
  }

  const content = `
    <h3>${project.title}</h3>
    <p>${project.subtitle}</p>
  `;

  if (project.url) {
    card.innerHTML = `<a class="project-link" href="${project.url}" target="_blank" rel="noreferrer">${content}</a>`;
  } else {
    card.innerHTML = content;
  }

  projectsGrid.appendChild(card);
});

document.querySelectorAll(".reveal").forEach((element) => {
  element.addEventListener(
    "animationend",
    () => {
      element.classList.remove("reveal");
    },
    { once: true }
  );
});
