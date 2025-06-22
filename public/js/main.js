document.addEventListener("DOMContentLoaded", () => {
  const hamburger = document.getElementById("hamburger");
  const sidebar = document.getElementById("sidebar");
  const overlay = document.getElementById("overlay");

  if (hamburger && sidebar && overlay) {
    hamburger.addEventListener("click", () => {
      sidebar.classList.toggle("active");
      overlay.classList.toggle("active");
    });

    overlay.addEventListener("click", () => {
      sidebar.classList.remove("active");
      overlay.classList.remove("active");
    });
  }

  // Auto-close sidebar when clicking a link
  document.querySelectorAll("#sidebar-links a").forEach(link => {
    link.addEventListener("click", () => {
      sidebar.classList.remove("active");
      overlay.classList.remove("active");
    });
  });

  // Dropdown toggle inside sidebar
  document.querySelectorAll('.dropdown-toggle').forEach((toggle) => {
    toggle.addEventListener('click', () => {
      toggle.classList.toggle('active');
      const dropdown = toggle.nextElementSibling;
      if (dropdown) {
        dropdown.classList.toggle('show');
      }
    });
  });

  lucide.createIcons(); // render icons
});
document.addEventListener("DOMContentLoaded", () => {
  // Join Modal
  const joinBtn = document.getElementById("joinBtn");
  const joinModal = document.getElementById("joinModal");

  if (joinBtn && joinModal) {
    joinBtn.addEventListener("click", () => {
      joinModal.classList.add("active");
    });

    document.addEventListener("click", (e) => {
      if (e.target.classList.contains("modal-overlay")) {
        e.target.classList.remove("active");
      }
    });
  }

  // Modal Close Button
  const closeButtons = document.querySelectorAll(".close-button");
  closeButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      joinModal.classList.remove("active");
    });
  });

  // Password Rules
  const passwordInput = document.getElementById("password");
  if (passwordInput) {
    const ruleLength = document.getElementById("rule-length");
    const ruleNumber = document.getElementById("rule-number");
    const ruleUppercase = document.getElementById("rule-uppercase");
    const ruleSpecial = document.getElementById("rule-special");

    passwordInput.addEventListener("input", () => {
      const value = passwordInput.value;

      ruleLength.textContent = (value.length >= 8 ? "✅" : "❌") + " At least 8 characters";
      ruleNumber.textContent = (/\d/.test(value) ? "✅" : "❌") + " Includes a number";
      ruleUppercase.textContent = (/[A-Z]/.test(value) ? "✅" : "❌") + " Includes an uppercase letter";
      ruleSpecial.textContent = (/[^A-Za-z0-9]/.test(value) ? "✅" : "❌") + " Includes a special character";
    });
  }

  // Profile Picture Preview
  const profileInput = document.getElementById("profilePicture");
  const profilePreview = document.getElementById("profilePreview");

  if (profileInput && profilePreview) {
    profileInput.addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = function (event) {
          profilePreview.src = event.target.result;
        };
        reader.readAsDataURL(file);
      }
    });
  }

  // AOS Disable on Mobile
  if (window.innerWidth <= 768) {
    document.querySelectorAll('[data-aos]').forEach(el => el.removeAttribute('data-aos'));
  }

  // Create Job Validation
  const form = document.querySelector(".create-job form");
  if (form) {
    form.addEventListener("submit", (e) => {
      const title = form.querySelector('input[name="title"]').value.trim();
      const description = form.querySelector('textarea[name="description"]').value.trim();

      if (!title || !description) {
        e.preventDefault();
        alert("Please fill in all required fields.");
      }
    });
  }
});

// For external use (HTML onclick)
function openJoinModal() {
  
  const joinModal = document.getElementById("joinModal");
  if (joinModal) {
    joinModal.classList.add("active");
  }
}
function switchModalTab(tab) {
  const signInForm = document.getElementById('signInForm');
  const signUpForm = document.getElementById('signUpForm');
  const signInTab = document.getElementById('signInTab');
  const signUpTab = document.getElementById('signUpTab');

  if (tab === 'signin') {
    signInForm.style.display = 'block';
    signUpForm.style.display = 'none';
    signInTab.classList.add('active');
    signUpTab.classList.remove('active');
  } else {
    signInForm.style.display = 'none';
    signUpForm.style.display = 'block';
    signInTab.classList.remove('active');
    signUpTab.classList.add('active');
  }
}

event.preventDefault();