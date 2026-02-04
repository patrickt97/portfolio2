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
    image: "assets/Achievements_dark.png",
    span: "span-2",
  },
];

const projectsGrid = document.getElementById("projects");
const showComingSoon = (event) => {
  const card = event.currentTarget;
  if (!card) {
    return;
  }

  const existing = card.querySelector(".coming-soon");
  if (existing) {
    existing.remove();
  }

  const notice = document.createElement("div");
  notice.className = "coming-soon";
  notice.textContent = "Project details coming soon!";
  card.appendChild(notice);

  requestAnimationFrame(() => {
    notice.classList.add("is-visible");
  });

  if (card._noticeTimeout) {
    window.clearTimeout(card._noticeTimeout);
  }
  card._noticeTimeout = window.setTimeout(() => {
    notice.classList.remove("is-visible");
    card._noticeTimeout = null;
  }, 2000);
};

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
    card.classList.add("project-empty");
    card.addEventListener("click", showComingSoon);
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
