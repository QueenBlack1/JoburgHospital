
document.addEventListener("DOMContentLoaded", () => {
  const stored = localStorage.getItem("joburg_current_user");
  const user = stored ? JSON.parse(stored) : null;

  if (!user || !user.id) {
    window.location.href = "/login";
    return;
  }

  if ((user.role || "").toLowerCase() !== "pharmacist") {
    window.location.href = "/login";
    return;
  }

  const nameEl = document.getElementById("userName");
  if (nameEl) nameEl.textContent = user.name || "Pharmacist";

  const initialsEl = document.getElementById("userInitials");
  if (initialsEl && user.name) {
    const parts = user.name.trim().split(" ");
    initialsEl.textContent =
      ((parts[0]?.[0] || "") + (parts[1]?.[0] || "")).toUpperCase() || "Ph";
  }

  let profile = {
    first_name: "",
    last_name: "",
    email: user.email || "",
    phone: "",
    license_number: "",
    duty_status: "On Duty",
    signature_data: null
  };

  let currentRxId = null;

  function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value || "—";
  }

  function setVal(id, value) {
    const el = document.getElementById(id);
    if (el) el.value = value || "";
  }

  function getVal(id) {
    const el = document.getElementById(id);
    return el ? el.value.trim() : "";
  }

  function openModal(id) {
    document.getElementById(id)?.classList.add("show");
  }

  function closeModal(id) {
    document.getElementById(id)?.classList.remove("show");
  }

  function setupSignaturePad(canvasId) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return null;

    const ctx = canvas.getContext("2d");
    let drawing = false;
    let hasInk = false;

    function pos(e) {
      const rect = canvas.getBoundingClientRect();
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      return {
        x: (clientX - rect.left) * (canvas.width / rect.width),
        y: (clientY - rect.top) * (canvas.height / rect.height)
      };
    }

    function start(e) {
      e.preventDefault();
      drawing = true;
      const p = pos(e);
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
    }

    function move(e) {
      if (!drawing) return;
      e.preventDefault();
      const p = pos(e);
      ctx.lineWidth = 2;
      ctx.lineCap = "round";
      ctx.strokeStyle = "#0F172A";
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
      hasInk = true;
    }

    function end() {
      drawing = false;
    }

    canvas.addEventListener("mousedown", start);
    canvas.addEventListener("mousemove", move);
    canvas.addEventListener("mouseup", end);
    canvas.addEventListener("mouseleave", end);
    canvas.addEventListener("touchstart", start, { passive: false });
    canvas.addEventListener("touchmove", move, { passive: false });
    canvas.addEventListener("touchend", end);

    return {
      clear() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        hasInk = false;
      },
      isEmpty() {
        return !hasInk;
      },
      toDataURL() {
        return canvas.toDataURL("image/png");
      },
      drawImage(dataUrl) {
        if (!dataUrl) return;
        const img = new Image();
        img.onload = () => {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          hasInk = true;
        };
        img.src = dataUrl;
      }
    };
  }

  const profilePad = setupSignaturePad("signatureCanvas");
  const dispensePad = setupSignaturePad("dispenseCanvas");

  function showSignaturePreview(imgId, emptyId, dataUrl) {
    const img = document.getElementById(imgId);
    const empty = emptyId ? document.getElementById(emptyId) : null;
    if (dataUrl) {
      if (img) {
        img.src = dataUrl;
        img.style.display = "block";
      }
      if (empty) empty.style.display = "none";
    } else {
      if (img) img.style.display = "none";
      if (empty) empty.style.display = "block";
    }
  }

  function renderProfileView() {
    const fullName = (profile.first_name + " " + profile.last_name).trim() || user.name || "—";
    setText("viewFullName", fullName);
    setText("viewEmail", profile.email || user.email);
    setText("viewPhone", profile.phone);
    setText("viewLicense", profile.license_number);
    setText("viewDuty", profile.duty_status);

    const dutyStat = document.getElementById("statDuty");
    if (dutyStat) dutyStat.textContent = profile.duty_status || "—";

    showSignaturePreview("viewSignature", "noSignatureText", profile.signature_data);
  }

  async function loadPharmacistProfile() {
    try {
      const res = await fetch("/api/profile/" + user.id);
      const data = await res.json();

      if (data.success) {
        const p = data.profile || {};
        const u = data.user || {};

        let first = p.first_name || "";
        let last = p.last_name || "";
        if (!first && !last && (u.full_name || user.name)) {
          const parts = (u.full_name || user.name).trim().split(" ");
          first = parts[0] || "";
          last = parts.slice(1).join(" ") || "";
        }

        profile = {
          first_name: first,
          last_name: last,
          email: u.email || p.email || user.email || "",
          phone: p.phone || u.phone || "",
          license_number: p.registration_number || p.license_number || "",
          duty_status: p.duty_status || "On Duty",
          signature_data: p.signature_data || null
        };
      }
      renderProfileView();
    } catch (err) {
      console.error(err);
      renderProfileView();
    }
  }

  const profileView = document.getElementById("profileView");
  const profileEdit = document.getElementById("profileEdit");
  const editBtn = document.getElementById("editProfileBtn");
  const cancelBtn = document.getElementById("cancelProfileBtn");

  editBtn?.addEventListener("click", () => {
    setVal("editFirstName", profile.first_name);
    setVal("editLastName", profile.last_name);
    setVal("editPhone", profile.phone);
    setVal("editLicense", profile.license_number);
    setVal("editDuty", profile.duty_status || "On Duty");

    if (profilePad) {
      profilePad.clear();
      if (profile.signature_data) profilePad.drawImage(profile.signature_data);
    }

    if (profileView) profileView.style.display = "none";
    if (profileEdit) profileEdit.style.display = "block";
    if (editBtn) editBtn.style.display = "none";
  });

  cancelBtn?.addEventListener("click", () => {
    if (profileView) profileView.style.display = "block";
    if (profileEdit) profileEdit.style.display = "none";
    if (editBtn) editBtn.style.display = "inline-flex";
  });

  document.getElementById("clearSignatureBtn")?.addEventListener("click", () => {
    profilePad?.clear();
  });

  document.getElementById("saveSignatureBtn")?.addEventListener("click", async () => {
    if (!profilePad || profilePad.isEmpty()) {
      alert("Please draw your signature first.");
      return;
    }

    const signature = profilePad.toDataURL();
    try {
      const res = await fetch("/api/pharmacists/signature/" + user.id, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signature })
      });
      const data = await res.json();
      if (data.success) {
        profile.signature_data = signature;
        showSignaturePreview("viewSignature", "noSignatureText", signature);
        alert("Signature saved.");
      } else {
        alert(data.message || "Could not save signature.");
      }
    } catch (err) {
      console.error(err);
      alert("Network error while saving signature.");
    }
  });

  document.getElementById("profileForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();

    const payload = {
      first_name: getVal("editFirstName"),
      last_name: getVal("editLastName"),
      phone: getVal("editPhone"),
      registration_number: getVal("editLicense"),
      duty_status: getVal("editDuty") || "On Duty"
    };

    try {
      const res = await fetch("/api/users/profile/" + user.id, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (data.success) {
        profile.first_name = payload.first_name;
        profile.last_name = payload.last_name;
        profile.phone = payload.phone;
        profile.license_number = payload.registration_number;
        profile.duty_status = payload.duty_status;

        const fullName = (payload.first_name + " " + payload.last_name).trim();
        if (fullName && nameEl) nameEl.textContent = fullName;

        renderProfileView();
        if (profileView) profileView.style.display = "block";
        if (profileEdit) profileEdit.style.display = "none";
        if (editBtn) editBtn.style.display = "inline-flex";
        alert("Profile saved.");
      } else {
        alert(data.message || "Failed to save profile.");
      }
    } catch (err) {
      console.error(err);
      alert("Network error.");
    }
  });

  const titles = {
    overview: "Dashboard",
    profile: "My Profile",
    prescriptions: "Pending Prescriptions",
    dispensed: "Dispensed",
    medicines: "Medicines",
    sales: "Pharmacy Sales"
  };

  function showSection(id) {
    document.querySelectorAll(".dash-section").forEach(s => s.classList.remove("active-section"));
    document.getElementById("section-" + id)?.classList.add("active-section");

    document.querySelectorAll(".nav-item").forEach(link => {
      link.classList.toggle("active", link.dataset.section === id);
    });

    const pageTitle = document.getElementById("pageTitle");
    if (pageTitle) pageTitle.textContent = titles[id] || "Dashboard";

    document.getElementById("sidebar")?.classList.remove("active");
    document.getElementById("sidebarOverlay")?.classList.remove("active");

    if (id === "prescriptions") renderPending();
    if (id === "dispensed") renderDispensed();
    if (id === "medicines") renderMedicines();
    if (id === "sales") renderPharmacySales();
    if (id === "profile") loadPharmacistProfile();
    if (id === "overview") {
      updateStats();
      loadCssCharts();
    }
  }

  document.querySelectorAll(".nav-item").forEach(link => {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      if (link.dataset.section) showSection(link.dataset.section);
    });
  });

  document.querySelectorAll("[data-goto]").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      if (btn.dataset.goto) showSection(btn.dataset.goto);
    });
  });

  document.getElementById("menuBtn")?.addEventListener("click", () => {
    document.getElementById("sidebar")?.classList.toggle("active");
    document.getElementById("sidebarOverlay")?.classList.toggle("active");
  });

  document.getElementById("sidebarOverlay")?.addEventListener("click", () => {
    document.getElementById("sidebar")?.classList.remove("active");
    document.getElementById("sidebarOverlay")?.classList.remove("active");
  });

  document.getElementById("logoutBtn")?.addEventListener("click", () => {
    localStorage.removeItem("joburg_current_user");
    window.location.href = "/login";
  });

  function closeRxModal() {
    closeModal("rxModal");
    currentRxId = null;
    dispensePad?.clear();
  }

  document.getElementById("closeRxModal")?.addEventListener("click", closeRxModal);
  document.getElementById("cancelRxModal")?.addEventListener("click", closeRxModal);
  document.getElementById("clearDispenseSigBtn")?.addEventListener("click", () => {
    dispensePad?.clear();
  });

  async function viewPrescription(id, mode) {
    currentRxId = id;
    try {
      const res = await fetch("/api/prescriptions/" + id);
      const data = await res.json();

      if (!data.success) {
        alert(data.message || "Could not load prescription.");
        return;
      }

      const rx = data.prescription;
      const items = data.items || [];

      setText("rxId", "#" + rx.prescription_id);
      setText("rxStatus", rx.status);
      setText("rxPatient", rx.patient_name);
      setText("rxIdNumber", rx.id_number);
      setText("rxDoctor", rx.doctor_name);
      setText("rxDate", rx.prescription_date);
      setText("rxNotes", rx.notes || "None");

      const itemsBody = document.getElementById("rxItemsBody");
      if (itemsBody) {
        itemsBody.innerHTML = items.length
          ? items.map(item => `
              <tr>
                <td>${item.medicine_name || "—"}</td>
                <td>${item.dosage || "—"}</td>
                <td>${item.frequency || "—"}</td>
                <td>${item.duration || "—"}</td>
                <td>${item.quantity || "—"}</td>
              </tr>
            `).join("")
          : `<tr><td colspan="5" style="text-align:center;color:#64748B;">No items</td></tr>`;
      }

      showSignaturePreview("rxDoctorSignature", "rxNoDoctorSig", rx.doctor_signature);

      const dispenseSection = document.getElementById("dispenseSection");
      const dispensedInfo = document.getElementById("dispensedInfo");
      const confirmBtn = document.getElementById("confirmDispenseBtn");

      if (mode === "dispense" && rx.status !== "Dispensed") {
        if (dispenseSection) dispenseSection.style.display = "block";
        if (dispensedInfo) dispensedInfo.style.display = "none";
        if (confirmBtn) confirmBtn.style.display = "inline-flex";
        if (dispensePad) {
          dispensePad.clear();
          if (profile.signature_data) dispensePad.drawImage(profile.signature_data);
        }
      } else {
        if (dispenseSection) dispenseSection.style.display = "none";
        if (confirmBtn) confirmBtn.style.display = "none";
        if (rx.status === "Dispensed") {
          if (dispensedInfo) dispensedInfo.style.display = "block";
          setText("rxDispensedBy", rx.dispensed_by_name || "—");
          setText("rxDispensedAt", rx.dispensed_at || "—");
          showSignaturePreview("rxDispenserSignature", null, rx.dispenser_signature);
        } else if (dispensedInfo) {
          dispensedInfo.style.display = "none";
        }
      }

      openModal("rxModal");
    } catch (err) {
      console.error(err);
      alert("Network error while loading prescription.");
    }
  }

  document.getElementById("confirmDispenseBtn")?.addEventListener("click", async () => {
    if (!currentRxId) return;

    const duty = (profile.duty_status || "").toLowerCase();
    if (duty === "off" || duty === "off duty") {
      alert("You are marked off duty. Update your duty status in My Profile first.");
      closeRxModal();
      showSection("profile");
      return;
    }

    let signature = null;
    if (dispensePad && !dispensePad.isEmpty()) {
      signature = dispensePad.toDataURL();
    } else if (profile.signature_data) {
      signature = profile.signature_data;
    } else {
      alert("Please sign before dispensing.");
      return;
    }

    const btn = document.getElementById("confirmDispenseBtn");
    const oldText = btn?.innerHTML || "";
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = "Dispensing...";
    }

    try {
      const res = await fetch("/api/prescriptions/" + currentRxId + "/dispense", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, signature })
      });
      const data = await res.json();

      if (data.success) {
        alert("Prescription dispensed successfully.");
        closeRxModal();
        renderPending();
        renderDispensed();
        renderPharmacySales();
        updateStats();
        loadCssCharts();
      } else {
        alert(data.message || "Failed to dispense.");
      }
    } catch (err) {
      console.error(err);
      alert("Network error.");
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = oldText;
      }
    }
  });

  async function renderPending() {
    const tbody = document.getElementById("pendingRxBody");
    if (!tbody) return;

    try {
      const res = await fetch("/api/prescriptions?status=Pending");
      const data = await res.json();
      const list = data.success ? data.prescriptions : [];

      setText("statPending", String(list.length));

      if (!list.length) {
        tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;color:#64748B;">No pending prescriptions</td></tr>`;
        return;
      }

      tbody.innerHTML = list.map(r => `
        <tr>
          <td>#${r.prescription_id}</td>
          <td>${r.patient_name || "—"}</td>
          <td>${r.id_number || "—"}</td>
          <td>${r.doctor_name || "—"}</td>
          <td>${r.medication || "—"}</td>
          <td>${r.dosage || "—"}</td>
          <td>${r.quantity || "—"}</td>
          <td><span class="status-pill status-pending">${r.status || "Pending"}</span></td>
          <td>
            <button class="btn btn-outline btn-sm btn-view" data-id="${r.prescription_id}">View</button>
            <button class="btn btn-primary btn-sm btn-dispense" data-id="${r.prescription_id}">Dispense</button>
          </td>
        </tr>
      `).join("");

      tbody.querySelectorAll(".btn-view").forEach(btn => {
        btn.addEventListener("click", () => viewPrescription(btn.dataset.id, "view"));
      });
      tbody.querySelectorAll(".btn-dispense").forEach(btn => {
        btn.addEventListener("click", () => viewPrescription(btn.dataset.id, "dispense"));
      });
    } catch (err) {
      console.error(err);
      tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;color:#ef4444;">Failed to load</td></tr>`;
    }
  }

  async function renderDispensed() {
    const tbody = document.getElementById("dispensedRxBody");
    if (!tbody) return;

    try {
      const res = await fetch("/api/prescriptions?status=Dispensed");
      const data = await res.json();
      const list = data.success ? data.prescriptions : [];

      setText("statDispensed", String(list.length));

      if (!list.length) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:#64748B;">Nothing dispensed yet</td></tr>`;
        return;
      }

      tbody.innerHTML = list.map(r => `
        <tr>
          <td>#${r.prescription_id}</td>
          <td>${r.patient_name || "—"}</td>
          <td>${r.medication || "—"}</td>
          <td>${r.doctor_name || "—"}</td>
          <td>${r.dispensed_by_name || "—"}</td>
          <td>${r.dispensed_at || r.prescription_date || "—"}</td>
          <td>
            <button class="btn btn-outline btn-sm btn-view-dispensed" data-id="${r.prescription_id}">View</button>
          </td>
        </tr>
      `).join("");

      tbody.querySelectorAll(".btn-view-dispensed").forEach(btn => {
        btn.addEventListener("click", () => viewPrescription(btn.dataset.id, "view"));
      });
    } catch (err) {
      console.error(err);
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:#ef4444;">Failed to load</td></tr>`;
    }
  }

  async function renderMedicines() {
    const tbody = document.getElementById("medicinesBody");
    if (!tbody) return;

    try {
      const res = await fetch("/api/medicines");
      const data = await res.json();
      const list = data.success ? data.medicines : [];

      setText("statMedicines", String(list.length));

      if (!list.length) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:#64748B;">No medicines in stock</td></tr>`;
        return;
      }

      tbody.innerHTML = list.map(m => {
        const stock = Number(m.quantity || 0);
        const reorder = Number(m.reorder_level || 10);
        const low = stock <= reorder;
        return `
          <tr>
            <td>${m.medicine_name || "—"}</td>
            <td>${m.category || "—"}</td>
            <td>${stock}</td>
            <td>${reorder}</td>
            <td><span class="status-pill ${low ? "status-off" : "status-on-duty"}">${low ? "Low stock" : "OK"}</span></td>
          </tr>
        `;
      }).join("");
    } catch (err) {
      console.error(err);
      tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:#ef4444;">Failed to load medicines</td></tr>`;
    }
  }

  async function renderPharmacySales() {
    const tbody = document.getElementById("pharmacySalesBody");
    if (!tbody) return;

    try {
      const res = await fetch("/api/pharmacy-sales");
      const data = await res.json();
      const list = data.success ? data.sales : [];

      if (!list.length) {
        tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;color:#64748B;">No sales yet</td></tr>`;
        return;
      }

      tbody.innerHTML = list.map(s => `
        <tr>
          <td>#${s.sale_id}</td>
          <td>${s.patient_name || "—"}</td>
          <td>${s.id_number || "—"}</td>
          <td>R ${Number(s.pharmacy_fee || 0).toFixed(2)}</td>
          <td>R ${Number(s.total_amount || 0).toFixed(2)}</td>
          <td>${s.payment_method || "—"}</td>
          <td>${s.payment_status || "Pending"}</td>
          <td>${s.sale_date || "—"}</td>
          <td>${s.pharmacist_name || "—"}</td>
        </tr>
      `).join("");
    } catch (err) {
      console.error(err);
      tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;color:#ef4444;">Failed to load sales</td></tr>`;
    }
  }

  async function updateStats() {
    try {
      const [pendingRes, dispensedRes, medRes] = await Promise.all([
        fetch("/api/prescriptions?status=Pending"),
        fetch("/api/prescriptions?status=Dispensed"),
        fetch("/api/medicines")
      ]);

      const pendingData = await pendingRes.json();
      const dispensedData = await dispensedRes.json();
      const medData = await medRes.json();

      setText("statPending", pendingData.success ? String(pendingData.prescriptions.length) : "0");
      setText("statDispensed", dispensedData.success ? String(dispensedData.prescriptions.length) : "0");
      setText("statMedicines", medData.success ? String(medData.medicines.length) : "0");
    } catch (e) {
      console.error(e);
    }
    renderProfileView();
  }

  function last7DayLabels() {
    const labels = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      labels.push(["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d.getDay()]);
    }
    return labels;
  }

  function countByDay(items, fieldName) {
    const counts = { Sun: 0, Mon: 0, Tue: 0, Wed: 0, Thu: 0, Fri: 0, Sat: 0 };
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    const weekStart = new Date(today);
    weekStart.setDate(weekStart.getDate() - 6);
    weekStart.setHours(0, 0, 0, 0);

    (items || []).forEach((item) => {
      const raw = item[fieldName];
      if (!raw) return;
      const d = new Date(raw);
      if (isNaN(d.getTime())) return;
      if (d >= weekStart && d <= today) {
        const key = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d.getDay()];
        counts[key] += 1;
      }
    });

    return last7DayLabels().map((label) => counts[label] || 0);
  }

  async function loadCssCharts() {
    const labels = last7DayLabels();
    labels.forEach((label, index) => {
      const el = document.querySelector('[data-day-label="' + index + '"]');
      if (el) el.textContent = label;
    });

    let values = [0, 0, 0, 0, 0, 0, 0];
    try {
      const res = await fetch("/api/prescriptions?status=Dispensed");
      const data = await res.json();
      const list = data.success ? data.prescriptions : [];
      values = countByDay(list, "dispensed_at");
      if (values.every((v) => v === 0)) {
        values = countByDay(list, "prescription_date");
      }
    } catch (err) {
      console.error("Dispensed chart error:", err);
    }

    const maxValue = Math.max(...values, 1);
    values.forEach((value, index) => {
      const fill = document.querySelector('.bar-fill[data-day="' + index + '"]');
      const text = document.querySelector('.bar-value[data-day="' + index + '"]');
      const percent = value === 0 ? 0 : Math.max(8, Math.round((value / maxValue) * 100));
      if (fill) {
        fill.style.height = percent + "%";
        fill.style.background = "#0B6E4F";
      }
      if (text) text.textContent = String(value);
    });

    let inStock = 0, lowStock = 0, outStock = 0;
    try {
      const res = await fetch("/api/medicines");
      const data = await res.json();
      const list = data.success ? data.medicines : [];
      list.forEach((m) => {
        const qty = Number(m.quantity || 0);
        const reorder = Number(m.reorder_level || 10);
        if (qty <= 0) outStock += 1;
        else if (qty <= reorder) lowStock += 1;
        else inStock += 1;
      });
    } catch (err) {
      console.error("Stock chart error:", err);
    }

    const total = Math.max(inStock + lowStock + outStock, 1);

    const inBar = document.getElementById("inStockBar");
    const lowBar = document.getElementById("lowStockBar");
    const outBar = document.getElementById("outStockBar");

    if (inBar) {
      inBar.style.width = (inStock / total) * 100 + "%";
      inBar.style.background = "#10B981";
    }
    if (lowBar) {
      lowBar.style.width = (lowStock / total) * 100 + "%";
      lowBar.style.background = "#F59E0B";
    }
    if (outBar) {
      outBar.style.width = (outStock / total) * 100 + "%";
      outBar.style.background = "#EF4444";
    }

    setText("inStockCount", String(inStock));
    setText("lowStockCount", String(lowStock));
    setText("outStockCount", String(outStock));
  }

  loadPharmacistProfile().then(() => {
    updateStats();
    loadCssCharts();
    showSection("overview");
  });
});