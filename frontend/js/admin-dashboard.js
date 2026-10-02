
document.addEventListener("DOMContentLoaded", () => {
  const stored = localStorage.getItem("joburg_current_user");
  const user = stored ? JSON.parse(stored) : null;

  if (!user || !user.id) {
    window.location.href = "/login";
    return;
  }

  const role = (user.role || "").toLowerCase();
  if (role !== "admin" && role !== "administrator") {
    window.location.href = "/login";
    return;
  }

  const nameEl = document.getElementById("userName");
  if (nameEl) nameEl.textContent = user.name || "Admin";

  const initialsEl = document.getElementById("userInitials");
  if (initialsEl && user.name) {
    const parts = user.name.trim().split(" ");
    initialsEl.textContent =
      ((parts[0]?.[0] || "") + (parts[1]?.[0] || "")).toUpperCase() || "A";
  }

  const setText = (id, v) => {
    const el = document.getElementById(id);
    if (el) el.textContent = v ?? "—";
  };

  const setVal = (id, v) => {
    const el = document.getElementById(id);
    if (el) el.value = v ?? "";
  };

  const getVal = (id) => document.getElementById(id)?.value.trim() || "";

  async function fetchJson(url, options = {}) {
    try {
      const res = await fetch(url, options);
      const contentType = res.headers.get("content-type") || "";

      if (!res.ok) {
        console.warn(`[API] ${res.status} ${res.statusText} → ${url}`);
        return { success: false, message: `Server error ${res.status}`, status: res.status };
      }

      if (!contentType.includes("application/json")) {
        const text = await res.text();
        console.warn(`[API] Expected JSON but got:`, text.slice(0, 120));
        return { success: false, message: "Invalid response from server" };
      }

      return await res.json();
    } catch (err) {
      console.error(`[API] Network error for ${url}:`, err);
      return { success: false, message: "Network error" };
    }
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

  async function loadAdminCharts() {
    let apptValues = [0, 0, 0, 0, 0, 0, 0];

    const apptData = await fetchJson(`/api/appointments/my?userId=${user.id}&role=admin`);
    if (apptData.success) {
      apptValues = countByDay(apptData.appointments || [], "appointment_date");
    }

    const apptCanvas = document.getElementById("appointmentsChart");
    if (apptCanvas && typeof Chart !== "undefined") {
      if (apptCanvas._chartInstance) apptCanvas._chartInstance.destroy();
      apptCanvas._chartInstance = new Chart(apptCanvas, {
        type: "line",
        data: {
          labels: last7DayLabels(),
          datasets: [{
            label: "Appointments",
            data: apptValues,
            borderColor: "#0B6E4F",
            backgroundColor: "rgba(11, 110, 79, 0.1)",
            borderWidth: 2.5,
            fill: true,
            tension: 0.4,
            pointBackgroundColor: "#0B6E4F",
            pointRadius: 4
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            y: { beginAtZero: true, ticks: { stepSize: 1 } },
            x: { grid: { display: false } }
          }
        }
      });
    }

    let deptLabels = [];
    let deptValues = [];

    const docData = await fetchJson("/api/doctors");
    if (docData.success) {
      const map = {};
      (docData.doctors || []).forEach((d) => {
        const key = d.specialization || "General";
        map[key] = (map[key] || 0) + 1;
      });
      deptLabels = Object.keys(map);
      deptValues = Object.values(map);
    }

    const deptCanvas = document.getElementById("departmentsChart");
    if (deptCanvas && typeof Chart !== "undefined") {
      if (deptCanvas._chartInstance) deptCanvas._chartInstance.destroy();
      const colors = ["#0B6E4F", "#0D9488", "#2563EB", "#7C3AED", "#EA580C", "#DC2626"];
      deptCanvas._chartInstance = new Chart(deptCanvas, {
        type: "doughnut",
        data: {
          labels: deptLabels.length ? deptLabels : ["No data"],
          datasets: [{
            data: deptValues.length ? deptValues : [1],
            backgroundColor: colors.slice(0, Math.max(deptLabels.length, 1)),
            borderWidth: 0,
            hoverOffset: 8
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: "65%",
          plugins: {
            legend: { position: "bottom", labels: { usePointStyle: true } }
          }
        }
      });
    }
  }

  const profileKey = "joburg_admin_profile_" + user.id;
  let profile = {
    first_name: "",
    last_name: "",
    email: user.email || "",
    phone: "",
    department: "Administration",
    employee_number: ""
  };

  function renderProfileView() {
    setText("viewFullName", (profile.first_name + " " + profile.last_name).trim() || user.name);
    setText("viewEmail", profile.email || user.email);
    setText("viewPhone", profile.phone);
    setText("viewDepartment", profile.department);
    setText("viewEmployeeNo", profile.employee_number);
  }

  async function loadAdminProfileFromServer() {
    const data = await fetchJson("/api/profile/" + user.id);

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
        department: p.department || "Administration",
        employee_number: p.employee_number || ""
      };

      localStorage.setItem(profileKey, JSON.stringify(profile));
    }
    renderProfileView();
  }

  const profileView = document.getElementById("profileView");
  const profileEdit = document.getElementById("profileEdit");
  const editBtn = document.getElementById("editProfileBtn");
  const cancelBtn = document.getElementById("cancelProfileBtn");

  editBtn?.addEventListener("click", () => {
    setVal("editFirstName", profile.first_name);
    setVal("editLastName", profile.last_name);
    setVal("editPhone", profile.phone);
    setVal("editDepartment", profile.department);
    setVal("editEmployeeNo", profile.employee_number);
    if (profileView) profileView.style.display = "none";
    if (profileEdit) profileEdit.style.display = "block";
    if (editBtn) editBtn.style.display = "none";
  });

  cancelBtn?.addEventListener("click", () => {
    if (profileView) profileView.style.display = "block";
    if (profileEdit) profileEdit.style.display = "none";
    if (editBtn) editBtn.style.display = "inline-flex";
  });

  document.getElementById("profileForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();

    const payload = {
      first_name: getVal("editFirstName"),
      last_name: getVal("editLastName"),
      phone: getVal("editPhone"),
      department: getVal("editDepartment"),
      employee_number: getVal("editEmployeeNo")
    };

    const data = await fetchJson("/api/users/profile/" + user.id, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (data.success) {
      profile = { ...profile, ...payload };
      localStorage.setItem(profileKey, JSON.stringify(profile));

      const fullName = (payload.first_name + " " + payload.last_name).trim();
      if (fullName && nameEl) nameEl.textContent = fullName;

      renderProfileView();
      if (profileView) profileView.style.display = "block";
      if (profileEdit) profileEdit.style.display = "none";
      if (editBtn) editBtn.style.display = "inline-flex";
      alert("Profile saved successfully.");
    } else {
      alert(data.message || "Failed to save profile.");
    }
  });

  const titles = {
    overview: "Dashboard",
    profile: "My Profile",
    messages: "Messages",
    doctors: "Doctors",
    pharmacists: "Pharmacists",
    patients: "Patients",
    appointments: "Appointments",
    invoices: "Invoices"
  };

  function showSection(id) {
    document.querySelectorAll(".dash-section").forEach((s) => s.classList.remove("active-section"));
    document.getElementById("section-" + id)?.classList.add("active-section");

    document.querySelectorAll(".nav-item").forEach((a) => {
      a.classList.toggle("active", a.dataset.section === id);
    });

    const title = document.getElementById("pageTitle");
    if (title) title.textContent = titles[id] || "Dashboard";

    document.getElementById("sidebar")?.classList.remove("active");
    document.getElementById("sidebarOverlay")?.classList.remove("active");

    if (id === "messages") renderMessages();
    if (id === "doctors") renderDoctors();
    if (id === "pharmacists") renderPharmacists();
    if (id === "patients") renderPatients();
    if (id === "appointments") renderAppointments();
    if (id === "invoices") renderInvoices();
    if (id === "profile") loadAdminProfileFromServer();
    if (id === "overview") {
      renderDoctors();
      renderPharmacists();
      renderPatients();
      renderAppointments();
      loadAdminCharts();
    }
  }

  document.querySelectorAll(".nav-item").forEach((link) => {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      if (link.dataset.section) showSection(link.dataset.section);
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

  let currentMessageId = null;

  function openMsgModal() {
    document.getElementById("msgModal").style.display = "flex";
  }

  function closeMsgModal() {
    document.getElementById("msgModal").style.display = "none";
    currentMessageId = null;
    document.getElementById("adminReplyText").value = "";
  }

  document.getElementById("closeMsgModal")?.addEventListener("click", closeMsgModal);
  document.getElementById("cancelMsgModal")?.addEventListener("click", closeMsgModal);

  async function viewMessage(id) {
    currentMessageId = id;
    const data = await fetchJson("/api/contact/messages/" + id);
    if (!data.success) return alert(data.message || "Could not load message.");

    const m = data.message;
    setText("msgFrom", m.full_name);
    setText("msgEmail", m.email);
    setText("msgSubject", m.subject);
    setText("msgDate", m.created_at ? String(m.created_at).slice(0, 19).replace("T", " ") : "—");
    document.getElementById("msgBody").textContent = m.message || "—";

    const replyBox = document.getElementById("existingReplyBox");
    if (m.admin_reply) {
      replyBox.style.display = "block";
      document.getElementById("existingReply").textContent = m.admin_reply;
    } else {
      replyBox.style.display = "none";
    }

    openMsgModal();
  }

  document.getElementById("sendReplyBtn")?.addEventListener("click", async () => {
    if (!currentMessageId) return;
    const reply = document.getElementById("adminReplyText")?.value.trim();
    if (!reply) return alert("Please type a reply.");

    const data = await fetchJson("/api/contact/messages/" + currentMessageId + "/reply", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reply, adminUserId: user.id })
    });

    if (data.success) {
      alert("Reply sent successfully.");
      closeMsgModal();
      renderMessages();
    } else {
      alert(data.message || "Failed to send reply.");
    }
  });

  async function renderMessages() {
    const tbody = document.getElementById("messagesBody");
    if (!tbody) return;

    const data = await fetchJson("/api/contact/messages");
    const list = data.success ? (data.messages || []) : [];

    if (!list.length) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:#64748B;">No messages yet</td></tr>`;
      return;
    }

    tbody.innerHTML = list.map(m => {
      const status = m.status || "New";
      const statusClass = status === "Replied" ? "status-replied" : status === "Read" ? "status-read" : "status-new";
      return `
        <tr>
          <td>#${m.message_id}</td>
          <td>${m.full_name || "—"}</td>
          <td>${m.email || "—"}</td>
          <td>${m.subject || "—"}</td>
          <td><span class="status-pill ${statusClass}">${status}</span></td>
          <td>${m.created_at ? String(m.created_at).slice(0, 19).replace("T", " ") : "—"}</td>
          <td><button class="btn btn-primary btn-sm btn-view-msg" data-id="${m.message_id}">View / Reply</button></td>
        </tr>
      `;
    }).join("");

    tbody.querySelectorAll(".btn-view-msg").forEach(btn => {
      btn.addEventListener("click", () => viewMessage(btn.dataset.id));
    });
  }

  async function renderDoctors() {
    const tbody = document.getElementById("doctorsTableBody");
    if (!tbody) return;

    const data = await fetchJson("/api/doctors");
    const list = data.success ? (data.doctors || []) : [];

    setText("statDoctors", list.length);

    if (!list.length) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:#64748B;">No doctors found</td></tr>`;
      return;
    }

    tbody.innerHTML = list.map(d => {
      const firstFee = d.consultation_fee_first_visit != null
        ? "R " + Number(d.consultation_fee_first_visit).toFixed(2)
        : "—";

      const followUpFee = d.consultation_fee_follow_up != null
        ? "R " + Number(d.consultation_fee_follow_up).toFixed(2)
        : "—";

      const status = d.availability_status || d.availability || "Available";
      const statusClass =
        status.toLowerCase().includes("available") ? "status-available" :
        status.toLowerCase().includes("leave") ? "status-on-leave" : "status-unavailable";

      return `
        <tr>
          <td>${d.full_name || "—"}</td>
          <td>${d.specialization || "—"}</td>
          <td>${d.phone || "—"}</td>
          <td>${firstFee}</td>
          <td>${followUpFee}</td>
          <td><span class="status-pill ${statusClass}">${status}</span></td>
        </tr>
      `;
    }).join("");
  }

  async function renderPharmacists() {
    const tbody = document.getElementById("pharmacistsTableBody");
    if (!tbody) return;

    const data = await fetchJson("/api/pharmacists");
    const list = data.success ? (data.pharmacists || []) : [];

    setText("statPharmacists", list.length);

    if (!list.length) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:#64748B;">No pharmacists found</td></tr>`;
      return;
    }

    tbody.innerHTML = list.map(p => `
      <tr>
        <td>${p.full_name || "—"}</td>
        <td>${p.email || "—"}</td>
        <td>${p.phone || "—"}</td>
        <td>${p.registration_number || "—"}</td>
        <td><span class="status-pill">${p.duty_status || "On Duty"}</span></td>
      </tr>
    `).join("");
  }

  async function renderPatients() {
    const tbody = document.getElementById("patientsTableBody");
    if (!tbody) return;

    const data = await fetchJson("/api/patients");
    const list = data.success ? (data.patients || []) : [];

    setText("statPatients", list.length);

    if (!list.length) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:#64748B;">No patients found</td></tr>`;
      return;
    }

    tbody.innerHTML = list.map(p => {
      const name = p.full_name || `${p.first_name || ""} ${p.last_name || ""}`.trim() || "—";
      return `
        <tr>
          <td>${name}</td>
          <td>${p.id_number || "—"}</td>
          <td>${p.email || "—"}</td>
          <td>${p.phone || "—"}</td>
          <td>${p.payment_method || "—"}</td>
        </tr>
      `;
    }).join("");
  }

  async function renderAppointments() {
    const tbody = document.getElementById("appointmentsTableBody");
    if (!tbody) return;

    const data = await fetchJson(`/api/appointments/my?userId=${user.id}&role=admin`);
    const list = data.success ? (data.appointments || []) : [];

    setText("statAppointments", list.length);

    if (!list.length) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:#64748B;">No appointments</td></tr>`;
      return;
    }

    tbody.innerHTML = list.map(a => {
      const st = (a.status || "Pending").toLowerCase();
      const badge = st === "completed" || st === "confirmed" ? "confirmed" : st === "cancelled" ? "cancelled" : "pending";

      return `
        <tr>
          <td>${a.patient_name || "—"}</td>
          <td>${a.doctor_name || "—"}</td>
          <td>${a.appointment_date || "—"}</td>
          <td>${a.appointment_time || "—"}</td>
          <td>${a.payment_method || a.payment_status || "Cash"}</td>
          <td><span class="badge-status ${badge}">${a.status || "Pending"}</span></td>
          <td>
            <button class="btn btn-sm btn-primary create-bill-btn"
              data-appointment-id="${a.appointment_id}"
              data-id-number="${a.id_number || a.patient_id_number || ""}"
              data-patient-name="${a.patient_name || ""}">
              Create Bill
            </button>
          </td>
        </tr>
      `;
    }).join("");

    tbody.querySelectorAll(".create-bill-btn").forEach(btn => {
      btn.addEventListener("click", () => openCreateBillModal(btn.dataset));
    });
  }

  async function renderInvoices() {
    const tbody = document.getElementById("invoicesTableBody");
    if (!tbody) return;

    const data = await fetchJson("/api/bills");
    const list = data.success ? (data.bills || []) : [];

    if (!list.length) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:#64748B;">No invoices yet</td></tr>`;
      return;
    }

    tbody.innerHTML = list.map(inv => {
      const status = inv.payment_status || "Pending";
      const badge = status === "Paid" ? "confirmed" : status === "Rejected" ? "cancelled" : "pending";

      return `
        <tr>
          <td>#${inv.bill_id}</td>
          <td>${inv.patient_name || inv.id_number || "—"}</td>
          <td>R ${Number(inv.consultation_fee || 0).toFixed(2)}</td>
          <td>R ${Number(inv.pharmacy_fee || 0).toFixed(2)}</td>
          <td>R ${Number(inv.total_amount || 0).toFixed(2)}</td>
          <td><span class="badge-status ${badge}">${status}</span></td>
          <td>
            <select class="form-control bill-status" data-id="${inv.bill_id}" style="min-width:120px;padding:6px 8px;">
              <option value="Pending" ${status === "Pending" ? "selected" : ""}>Pending</option>
              <option value="Paid" ${status === "Paid" ? "selected" : ""}>Paid</option>
              <option value="Rejected" ${status === "Rejected" ? "selected" : ""}>Rejected</option>
            </select>
          </td>
        </tr>
      `;
    }).join("");

    tbody.querySelectorAll(".bill-status").forEach(sel => {
      sel.addEventListener("change", async () => {
        const result = await fetchJson("/api/bills/" + sel.dataset.id + "/status", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: sel.value })
        });

        if (result.success) {
          alert("Bill status updated");
          renderInvoices();
        } else {
          alert(result.message || "Failed to update");
        }
      });
    });
  }

  let selectedAppointment = null;

  async function openCreateBillModal(data) {
    selectedAppointment = {
      appointmentId: data.appointmentId,
      idNumber: data.idNumber,
      patientName: data.patientName
    };

    const modal = document.getElementById("generateBillModal");
    if (!modal) {
      alert("Generate Bill modal not found. Please add it to the HTML.");
      return;
    }

    setText("billPatientName", data.patientName || "—");
    setText("billDoctorName", "Loading...");
    setText("billVisitType", "Loading...");
    setText("billConsultationFee", "0.00");
    setText("billPharmacyFee", "0.00");
    setText("billTotalAmount", "0.00");

    modal.style.display = "flex";

    const apptData = await fetchJson("/api/appointments/" + data.appointmentId);
    if (!apptData.success || !apptData.appointment) {
      alert("Could not load appointment");
      return;
    }

    const appt = apptData.appointment;
    const visitType = appt.visit_type || "First Visit";

    setText("billDoctorName", appt.doctor_name || "—");
    setText("billVisitType", visitType);

    let consultationFee = 0;
    const docData = await fetchJson("/api/doctors");
    if (docData.success) {
      const doctors = docData.doctors || [];
      const doctor = doctors.find(d =>
        d.doctor_id == appt.doctor_id ||
        d.full_name === appt.doctor_name
      );

      if (doctor) {
        if (visitType.toLowerCase().includes("second") || visitType.toLowerCase().includes("follow")) {
          consultationFee = Number(doctor.consultation_fee_follow_up || doctor.consultation_fee || 0);
        } else {
          consultationFee = Number(doctor.consultation_fee_first_visit || doctor.consultation_fee || 0);
        }
      }
    }

    let pharmacyFee = 0;
    const salesData = await fetchJson("/api/pharmacy-sales");
    if (salesData.success) {
      const sales = salesData.sales || [];
      const patientSale = sales.find(s =>
        s.id_number === data.idNumber &&
        (s.payment_status === "Pending" || !s.payment_status)
      ) || sales.find(s => s.id_number === data.idNumber);

      if (patientSale) {
        pharmacyFee = Number(patientSale.pharmacy_fee || patientSale.total_amount || 0);
      }
    }

    const total = consultationFee + pharmacyFee;

    setText("billConsultationFee", consultationFee.toFixed(2));
    setText("billPharmacyFee", pharmacyFee.toFixed(2));
    setText("billTotalAmount", total.toFixed(2));

    selectedAppointment.consultationFee = consultationFee;
    selectedAppointment.pharmacyFee = pharmacyFee;
    selectedAppointment.totalAmount = total;
    selectedAppointment.visitType = visitType;
  }

  document.getElementById("closeGenerateBillModal")?.addEventListener("click", () => {
    document.getElementById("generateBillModal").style.display = "none";
  });

  document.getElementById("cancelGenerateBill")?.addEventListener("click", () => {
    document.getElementById("generateBillModal").style.display = "none";
  });

  document.getElementById("confirmGenerateBillBtn")?.addEventListener("click", async () => {
    if (!selectedAppointment) return;

    const paymentMethod = document.getElementById("billPaymentMethod")?.value || "Cash";
    const btn = document.getElementById("confirmGenerateBillBtn");
    const oldText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = "Generating...";

    const result = await fetchJson("/api/bills", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id_number: selectedAppointment.idNumber,
        appointment_id: selectedAppointment.appointmentId,
        visit_type: selectedAppointment.visitType,
        consultation_fee: selectedAppointment.consultationFee,
        pharmacy_fee: selectedAppointment.pharmacyFee,
        other_charges: 0,
        total_amount: selectedAppointment.totalAmount,
        payment_method: paymentMethod,
        payment_status: "Pending"
      })
    });

    if (result.success) {
      alert("Invoice generated successfully!");
      document.getElementById("generateBillModal").style.display = "none";
      renderInvoices();
      showSection("invoices");
    } else {
      alert(result.message || "Failed to generate invoice");
    }

    btn.disabled = false;
    btn.innerHTML = oldText;
  });

  loadAdminProfileFromServer();
  renderDoctors();
  renderPharmacists();
  renderPatients();
  renderAppointments();
  renderInvoices();
  loadAdminCharts();
  showSection("overview");
});