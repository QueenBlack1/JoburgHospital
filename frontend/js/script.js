
document.addEventListener("DOMContentLoaded", () => {
  const navLinks = document.querySelectorAll(".nav-link[data-page]");
  const footerLinks = document.querySelectorAll(".footer a[data-page]");
  const pages = document.querySelectorAll(".page-section");
  const menuBtn = document.getElementById("menuBtn");
  const navMenu = document.getElementById("navMenu");
  const logo = document.querySelector(".logo[data-page]");

  function showPage(pageId) {
    pages.forEach(page => page.classList.remove("active-page"));

    const selectedPage = document.getElementById(pageId);
    if (selectedPage) {
      selectedPage.classList.add("active-page");
    }

    navLinks.forEach(link => {
      link.classList.toggle("active", link.dataset.page === pageId);
    });

    window.scrollTo({ top: 0, behavior: "smooth" });

    if (navMenu) navMenu.classList.remove("active");

    if (menuBtn) {
      const icon = menuBtn.querySelector("i");
      if (icon) {
        icon.classList.remove("fa-xmark", "fa-times");
        icon.classList.add("fa-bars");
      }
    }
  }

  function handleNavClick(event) {
    const link = event.currentTarget;
    const pageId = link.dataset.page;
    if (!pageId) return;

    event.preventDefault();
    showPage(pageId);
    history.pushState(null, "", "#" + pageId);
  }

  navLinks.forEach(link => link.addEventListener("click", handleNavClick));
  footerLinks.forEach(link => link.addEventListener("click", handleNavClick));

  if (logo) {
    logo.addEventListener("click", (e) => {
      e.preventDefault();
      showPage("home");
      history.pushState(null, "", "#home");
    });
  }

  if (menuBtn && navMenu) {
    menuBtn.addEventListener("click", () => {
      navMenu.classList.toggle("active");
      const icon = menuBtn.querySelector("i");
      if (!icon) return;

      if (navMenu.classList.contains("active")) {
        icon.classList.remove("fa-bars");
        icon.classList.add("fa-xmark");
      } else {
        icon.classList.remove("fa-xmark");
        icon.classList.add("fa-bars");
      }
    });
  }

  const hash = window.location.hash.replace("#", "");
  const startPage = hash && document.getElementById(hash) ? hash : "home";
  showPage(startPage);
});

document.addEventListener("DOMContentLoaded", () => {
  const contactForm = document.getElementById("contactForm");

  if (contactForm) {
    contactForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const full_name = document.getElementById("contactName").value.trim();
      const email = document.getElementById("contactEmail").value.trim();
      const subject = document.getElementById("contactSubject").value.trim();
      const message = document.getElementById("contactMessage").value.trim();

      if (!full_name || !email || !subject || !message) {
        alert("Please fill in all fields.");
        return;
      }

      const btn = contactForm.querySelector('button[type="submit"]');
      const oldText = btn ? btn.innerHTML : "";
      if (btn) {
        btn.disabled = true;
        btn.innerHTML = "Sending...";
      }

      try {
        const res = await fetch("/api/contact", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ full_name, email, subject, message })
        });

        const data = await res.json();

        if (data.success) {
          alert("Thank you. Your message was sent to the administrator.");
          contactForm.reset();
        } else {
          alert(data.message || "Could not send message.");
        }
      } catch (err) {
        console.error(err);
        alert("Network error. Please try again.");
      } finally {
        if (btn) {
          btn.disabled = false;
          btn.innerHTML = oldText;
        }
      }
    });
  }
});