(() => {
  const DEFAULT_TITLE = "Kebaikan kecilmu, harapan besar untuk mereka.";
  const DEFAULT_SUBTITLE = "Mari hadirkan manfaat yang nyata bagi saudara kita di Kabupaten Batu Bara. Bersama, setiap kebaikan menemukan jalannya.";
  const DEFAULT_HERO_IMAGE = document.getElementById("hero-image").src;
  const CONTENT_KEY = "lazismu-batubara-content-v1";
  const DOCUMENTATION_KEY = "lazismu-batubara-documentation-v1";
  const titleElement = document.getElementById("hero-title");
  const subtitleElement = document.getElementById("hero-subtitle");
  const heroImageElement = document.getElementById("hero-image");
  const donationModal = document.getElementById("donation-modal");
  const adminModal = document.getElementById("admin-modal");
  const loginModal = document.getElementById("login-modal");
  const adminToken = () => sessionStorage.getItem("lazismu-admin-token");
  const searchInput = document.getElementById("search-input");
  const campaignCards = Array.from(document.querySelectorAll(".campaign-card"));
  const toast = document.getElementById("toast");
  let toastTimer;
  let selectedCategory = "Semua";

  function showToast(message) {
    toast.textContent = message;
    toast.classList.add("show");
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toast.classList.remove("show"), 3200);
  }

  function readStored(key, fallback) {
    try {
      const value = localStorage.getItem(key);
      return value ? JSON.parse(value) : fallback;
    } catch (error) {
      return fallback;
    }
  }

  function saveStored(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      showToast("Penyimpanan browser penuh. Coba foto yang lebih kecil.");
      return false;
    }
  }

  function renderTitle(value) {
    titleElement.replaceChildren();
    const commaIndex = value.indexOf(",");
    if (commaIndex < 0) {
      titleElement.textContent = value;
      return;
    }
    const firstLine = value.slice(0, commaIndex + 1).trim();
    const remainder = value.slice(commaIndex + 1).trim();
    titleElement.append(document.createTextNode(firstLine));
    titleElement.append(document.createElement("br"));
    const highlight = document.createElement("span");
    highlight.textContent = remainder;
    titleElement.append(highlight);
  }

  async function applyContent() {
    let content = readStored(CONTENT_KEY, {});
    try {
      const response = await fetch("/config.json", { cache: "no-store" });
      if (response.ok) content = await response.json();
    } catch (error) {
      // Browser storage remains available when served as a local static file.
    }
    renderTitle(typeof content.title === "string" ? content.title : DEFAULT_TITLE);
    subtitleElement.textContent = typeof content.subtitle === "string" ? content.subtitle : DEFAULT_SUBTITLE;
    heroImageElement.src = typeof content.heroImage === "string" ? content.heroImage : DEFAULT_HERO_IMAGE;
  }

  function compressImage(file, maxDimension = 1300) {
    return new Promise((resolve, reject) => {
      if (!file || !file.type.startsWith("image/")) {
        reject(new Error("Pilih file gambar yang valid."));
        return;
      }
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("Foto tidak dapat dibaca."));
      reader.onload = () => {
        const image = new Image();
        image.onerror = () => reject(new Error("Foto tidak dapat dibuka."));
        image.onload = () => {
          const ratio = Math.min(1, maxDimension / Math.max(image.naturalWidth, image.naturalHeight));
          const canvas = document.createElement("canvas");
          canvas.width = Math.max(1, Math.round(image.naturalWidth * ratio));
          canvas.height = Math.max(1, Math.round(image.naturalHeight * ratio));
          const context = canvas.getContext("2d");
          if (!context) {
            reject(new Error("Browser tidak dapat memproses foto."));
            return;
          }
          context.drawImage(image, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL("image/jpeg", 0.78));
        };
        image.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  function openModal(modal) {
    if (!modal.open) modal.showModal();
  }

  document.querySelectorAll("[data-close]").forEach((button) => {
    button.addEventListener("click", () => button.closest("dialog").close());
  });
  [donationModal, adminModal, loginModal].forEach((modal) => {
    modal.addEventListener("click", (event) => {
      if (event.target === modal) modal.close();
    });
  });
  document.querySelectorAll("[data-donate]").forEach((button) => {
    button.addEventListener("click", () => {
      const program = button.dataset.program;
      document.getElementById("donation-program-name").textContent = program
        ? `Dukungan Anda dapat membantu program “${program}”.`
        : "Pilih nominal dan niatkan kebaikan hari ini.";
      document.getElementById("donation-message").hidden = true;
      document.getElementById("donation-amount").value = "";
      document.querySelectorAll(".amount-grid button").forEach((choice) => choice.classList.remove("selected"));
      openModal(donationModal);
    });
  });

  document.querySelectorAll(".amount-grid button").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll(".amount-grid button").forEach((choice) => choice.classList.remove("selected"));
      button.classList.add("selected");
      document.getElementById("donation-amount").value = button.dataset.amount;
    });
  });
  document.getElementById("donation-continue").addEventListener("click", () => {
    const amount = Number(document.getElementById("donation-amount").value);
    const message = document.getElementById("donation-message");
    if (!Number.isFinite(amount) || amount < 1000) {
      message.textContent = "Masukkan nominal donasi minimal Rp1.000.";
      message.hidden = false;
      return;
    }
    message.textContent = `Terima kasih atas niat baik sebesar Rp${amount.toLocaleString("id-ID")}. Halaman ini tidak memproses pembayaran; silakan konfirmasi rekening resmi langsung kepada kantor Lazismu Kabupaten Batu Bara sebelum transfer.`;
    message.hidden = false;
  });

  function updateCampaigns() {
    const query = searchInput.value.trim().toLocaleLowerCase("id");
    let visibleCount = 0;
    campaignCards.forEach((card) => {
      const categoryMatches = selectedCategory === "Semua" || card.dataset.category === selectedCategory;
      const searchableText = `${card.dataset.search} ${card.querySelector("h3").textContent}`.toLocaleLowerCase("id");
      const searchMatches = !query || searchableText.includes(query);
      const visible = categoryMatches && searchMatches;
      card.hidden = !visible;
      if (visible) visibleCount += 1;
    });
    document.getElementById("empty-state").hidden = visibleCount > 0;
    document.getElementById("result-label").textContent = `${visibleCount} program`;
  }

  document.querySelectorAll(".category-card").forEach((button) => {
    button.addEventListener("click", () => {
      selectedCategory = button.dataset.category;
      document.querySelectorAll(".category-card").forEach((card) => card.classList.toggle("active", card === button));
      updateCampaigns();
      document.getElementById("program-list").scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });
  searchInput.addEventListener("input", updateCampaigns);
  document.getElementById("search-form").addEventListener("submit", (event) => {
    event.preventDefault();
    updateCampaigns();
    document.getElementById("program-list").scrollIntoView({ behavior: "smooth", block: "start" });
  });
  document.getElementById("clear-search").addEventListener("click", () => {
    searchInput.value = "";
    selectedCategory = "Semua";
    document.querySelectorAll(".category-card").forEach((card) => card.classList.toggle("active", card.dataset.category === "Semua"));
    updateCampaigns();
  });

  document.querySelectorAll(".save-button").forEach((button) => {
    button.addEventListener("click", () => {
      const saved = button.classList.toggle("saved");
      button.textContent = saved ? "♥" : "♡";
      showToast(saved ? "Program disimpan di sesi ini." : "Program dihapus dari simpanan sesi ini.");
    });
  });

  async function renderDocumentation() {
    const grid = document.getElementById("gallery-grid");
    const uploadTile = grid.querySelector(".upload-tile");
    grid.querySelectorAll(".user-gallery-item").forEach((item) => item.remove());
    let items = readStored(DOCUMENTATION_KEY, []);
    try {
      const response = await fetch("/api/documentation", { cache: "no-store" });
      if (response.ok) items = await response.json();
    } catch (error) {
      // Keep browser-local documentation as a fallback.
    }
    if (!Array.isArray(items)) return;
    items.forEach((item) => {
      if (!item || typeof item.image !== "string" || typeof item.caption !== "string") return;
      const card = document.createElement("article");
      card.className = "gallery-card user-gallery-item";
      const image = document.createElement("img");
      image.src = item.image;
      image.alt = item.caption;
      const label = document.createElement("span");
      label.className = "gallery-label";
      label.textContent = "Dokumentasi";
      const overlay = document.createElement("div");
      overlay.className = "gallery-overlay";
      const category = document.createElement("span");
      category.textContent = "CERITA DARI KOMUNITAS";
      const caption = document.createElement("strong");
      caption.textContent = item.caption;
      overlay.append(category, caption);
      card.append(image, label, overlay);
      grid.insertBefore(card, uploadTile);
    });
  }

  const documentationInput = document.getElementById("documentation-image");
  documentationInput.addEventListener("change", () => {
    document.getElementById("documentation-file-name").textContent = documentationInput.files[0]
      ? documentationInput.files[0].name
      : "Belum ada foto dipilih";
  });
  document.getElementById("upload-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!adminToken()) {
      showToast("Login pengurus diperlukan untuk mengunggah dokumentasi.");
      openModal(loginModal);
      return;
    }
    const file = documentationInput.files[0];
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      showToast("Gunakan foto JPG, PNG, atau WebP.");
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      showToast("Ukuran foto maksimal 4 MB.");
      return;
    }
    const submit = event.currentTarget.querySelector("button[type=submit]");
    submit.disabled = true;
    submit.textContent = "Memproses foto...";
    try {
      const image = await compressImage(file, 1000);
      const items = readStored(DOCUMENTATION_KEY, []);
      const updated = (Array.isArray(items) ? items : []).concat({
        caption: document.getElementById("documentation-caption").value.trim(),
        image
      }).slice(-6);
      if (!saveStored(DOCUMENTATION_KEY, updated)) return;
      try {
        await fetch("/api/documentation", {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Admin-Token": adminToken() },
          body: JSON.stringify(updated[updated.length - 1])
        });
      } catch (error) {
        // Browser storage already saved the documentation locally.
      }
      renderDocumentation();
      event.currentTarget.reset();
      document.getElementById("documentation-file-name").textContent = "Belum ada foto dipilih";
      showToast("Dokumentasi berhasil ditambahkan ke galeri browser ini.");
    } catch (error) {
      showToast(error.message || "Foto gagal diproses.");
    } finally {
      submit.disabled = false;
      submit.innerHTML = 'Tambahkan dokumentasi <span>↗</span>';
    }
  });
  document.querySelector("[data-focus-upload]").addEventListener("click", () => {
    document.getElementById("upload-panel").scrollIntoView({ behavior: "smooth", block: "center" });
    window.setTimeout(() => documentationInput.focus(), 450);
  });

  document.querySelectorAll("[data-admin]").forEach((button) => {
    button.addEventListener("click", () => {
      if (!adminToken()) {
        openModal(loginModal);
        return;
      }
      const content = readStored(CONTENT_KEY, {});
      document.getElementById("edit-title").value = typeof content.title === "string" ? content.title : DEFAULT_TITLE;
      document.getElementById("edit-subtitle").value = typeof content.subtitle === "string" ? content.subtitle : DEFAULT_SUBTITLE;
      document.getElementById("edit-hero-image").value = "";
      document.getElementById("admin-message").hidden = true;
      openModal(adminModal);
    });
  });
  document.getElementById("admin-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const title = document.getElementById("edit-title").value.trim();
    const subtitle = document.getElementById("edit-subtitle").value.trim();
    const imageFile = document.getElementById("edit-hero-image").files[0];
    const message = document.getElementById("admin-message");
    if (imageFile && (!["image/jpeg", "image/png", "image/webp"].includes(imageFile.type) || imageFile.size > 4 * 1024 * 1024)) {
      message.textContent = "Gunakan foto JPG, PNG, atau WebP dengan ukuran maksimal 4 MB.";
      message.hidden = false;
      return;
    }
    const submit = event.currentTarget.querySelector('button[type="submit"]');
    submit.disabled = true;
    try {
      const oldContent = readStored(CONTENT_KEY, {});
      const nextContent = { title, subtitle, heroImage: oldContent.heroImage || DEFAULT_HERO_IMAGE };
      if (imageFile) nextContent.heroImage = await compressImage(imageFile, 1300);
      if (!saveStored(CONTENT_KEY, nextContent)) return;
      try {
        await fetch("/api/content", {
          method: "POST",
            headers: { "Content-Type": "application/json", "X-Admin-Token": adminToken() },
          body: JSON.stringify(nextContent)
        });
      } catch (error) {
        // Browser storage already saved the content locally.
      }
      applyContent();
      message.textContent = "Perubahan tersimpan di browser ini.";
      message.hidden = false;
      showToast("Konten berhasil diperbarui.");
    } catch (error) {
      message.textContent = error.message || "Perubahan belum berhasil disimpan.";
      message.hidden = false;
    } finally {
      submit.disabled = false;
    }
  });
  document.getElementById("reset-content").addEventListener("click", async () => {
    try {
      localStorage.removeItem(CONTENT_KEY);
      document.getElementById("edit-title").value = DEFAULT_TITLE;
      document.getElementById("edit-subtitle").value = DEFAULT_SUBTITLE;
      document.getElementById("edit-hero-image").value = "";
      await fetch("/api/content", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Admin-Token": adminToken() },
        body: JSON.stringify({ title: DEFAULT_TITLE, subtitle: DEFAULT_SUBTITLE, heroImage: DEFAULT_HERO_IMAGE })
      });
      applyContent();
      const message = document.getElementById("admin-message");
      message.textContent = "Konten bawaan dipulihkan.";
      message.hidden = false;
      showToast("Konten bawaan berhasil dipulihkan.");
    } catch (error) {
      showToast("Browser tidak dapat memulihkan konten saat ini.");
    }
  });

  document.querySelectorAll("[data-login]").forEach((button) => {
    button.addEventListener("click", () => {
      if (adminToken()) {
        openModal(adminModal);
      } else {
        document.getElementById("login-id").value = "";
        document.getElementById("login-password").value = "";
        document.getElementById("login-message").hidden = true;
        openModal(loginModal);
      }
    });
  });

  document.getElementById("login-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const id = document.getElementById("login-id").value.trim();
    const password = document.getElementById("login-password").value;
    const message = document.getElementById("login-message");
    try {
      const response = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, password })
      });
      const result = await response.json();
      if (!response.ok || !result.ok) {
        message.textContent = result.error || "Login gagal.";
        message.hidden = false;
        return;
      }
      sessionStorage.setItem("lazismu-admin-token", result.token);
      loginModal.close();
      showToast("Login pengurus berhasil.");
      document.querySelector(".upload-tile").innerHTML =
        '<div class="upload-tile-icon">＋</div><strong>Ada cerita kebaikan?</strong><span>Siap untuk dokumentasi</span><button class="text-link" type="button" data-focus-upload>Unggah foto <span>↗</span></button>';
      document.querySelector(".upload-tile [data-focus-upload]").addEventListener("click", () => {
        document.getElementById("upload-panel").scrollIntoView({ behavior: "smooth", block: "center" });
      });
      openModal(adminModal);
    } catch (error) {
      message.textContent = "Server belum dapat memeriksa login. Pastikan website dijalankan melalui server.";
      message.hidden = false;
    }
  });

  document.getElementById("current-year").textContent = new Date().getFullYear();
  applyContent();
  renderDocumentation();
  updateCampaigns();
})();
