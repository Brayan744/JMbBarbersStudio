const homeBtn = document.getElementById("homeBtn");
const brandLink = document.getElementById("brandLink");

function redirectHome() {
  const currentUser = JSON.parse(localStorage.getItem("currentUser") || "{}");
  if (currentUser.role === "barber") {
    window.location.href = "admin.html";
  } else {
    window.location.href = "booking.html";
  }
}

if (homeBtn) {
  homeBtn.addEventListener("click", (e) => {
    e.preventDefault();
    redirectHome();
  });

  const currentUser = JSON.parse(localStorage.getItem("currentUser") || "{}");
  if (currentUser.role === "barber") {
    homeBtn.textContent = "Volver al panel";
  }
}

if (brandLink) {
  brandLink.addEventListener("click", (e) => {
    e.preventDefault();
    redirectHome();
  });
}
