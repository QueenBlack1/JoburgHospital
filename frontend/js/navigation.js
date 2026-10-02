document.addEventListener('DOMContentLoaded', function () {
  const links = document.querySelectorAll('.nav-link');
  const sections = document.querySelectorAll('.section');

  function showSection(id) {
    sections.forEach(function (section) {
      section.classList.remove('active-section');
    });

    const target = document.getElementById(id);
    if (target) {
      target.classList.add('active-section');
    }

    links.forEach(function (link) {
      link.classList.remove('active');
      if (link.getAttribute('data-section') === id) {
        link.classList.add('active');
      }
    });

    const nav = document.getElementById('navLinks');
    if (nav) {
      nav.classList.remove('active');
    }
  }

  links.forEach(function (link) {
    link.addEventListener('click', function (e) {
      e.preventDefault();
      const sectionId = this.getAttribute('data-section');
      showSection(sectionId);
      history.pushState(null, null, '#' + sectionId);
    });
  });

  const hash = window.location.hash.replace('#', '') || 'home';
  showSection(hash);

  window.addEventListener('popstate', function () {
    const hash = window.location.hash.replace('#', '') || 'home';
    showSection(hash);
  });
});