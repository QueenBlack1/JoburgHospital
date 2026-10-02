
document.addEventListener("DOMContentLoaded", () => {
  const stored = localStorage.getItem("joburg_current_user");
  const user = stored ? JSON.parse(stored) : null;

  if (!user?.id) {
    window.location.href = "/login";
    return;
  }
  if ((user.role || "").toLowerCase() !== "patient") {
    window.location.href = "/login";
    return;
  }

  const nameEl = document.getElementById("userName");
  if (nameEl) nameEl.textContent = user.name || "Patient";

  const initialsEl = document.getElementById("userInitials");
  if (initialsEl && user.name) {
    const parts = user.name.trim().split(" ");
    initialsEl.textContent = ((parts[0]?.[0] || "") + (parts[1]?.[0] || "")).toUpperCase();
  }

  const setText = (id, v) => {
    const el = document.getElementById(id);
    if (el) el.textContent = v || "—";
  };
  const setVal = (id, v) => {
    const el = document.getElementById(id);
    if (el) el.value = v || "";
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

  const titles = {
    overview: "Dashboard",
    profile: "My Profile",
    book: "Book Appointment",
    appointments: "My Appointments",
    prescriptions: "Prescriptions",
    bills: "Bills"
  };

  function showSection(id) {
    document.querySelectorAll(".dash-section").forEach((s) => s.classList.remove("active-section"));
    const target = document.getElementById("section-" + id);
    if (target) target.classList.add("active-section");

    document.querySelectorAll(".nav-item").forEach((a) => {
      a.classList.toggle("active", a.dataset.section === id);
    });

    const title = document.getElementById("pageTitle");
    if (title) title.textContent = titles[id] || "Dashboard";

    document.getElementById("sidebar")?.classList.remove("active");
    document.getElementById("sidebarOverlay")?.classList.remove("active");

    if (id === "appointments") renderAppointments();
    if (id === "prescriptions") renderPatientPrescriptions();
    if (id === "bills") renderPatientBills();
    if (id === "profile") loadPatientProfileFromServer();
  }

  document.querySelectorAll(".nav-item").forEach((link) => {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      showSection(link.dataset.section);
    });
  });

  document.querySelectorAll("[data-goto]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      showSection(btn.dataset.goto);
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

  let profile = {
    id_number: "",
    first_name: "",
    last_name: "",
    email: user.email || "",
    phone: "",
    date_of_birth: "",
    gender: "",
    address: "",
    emergency_contact_name: "",
    emergency_contact_phone: "",
    blood_group: "",
    allergies: "",
    payment_method: "",
    payment_responsible: "",
    payment_relationship: "",
    medical_aid_name: "",
    medical_aid_number: "",
    medical_aid_plan: "",
    medical_aid_member: ""
  };

  function paymentDetailsText() {
    if (profile.payment_method === "Cash") {
      return (profile.payment_responsible || "—") +
        " (" + (profile.payment_relationship || "—") + ")";
    }
    if (profile.payment_method === "Medical Aid") {
      return [
        profile.medical_aid_name,
        profile.medical_aid_number ? "#" + profile.medical_aid_number : "",
        profile.medical_aid_plan,
        profile.medical_aid_member ? "Member: " + profile.medical_aid_member : ""
      ]
        .filter(Boolean)
        .join(" · ");
    }
    return "";
  }

  function renderView() {
    const full =
      (profile.first_name + " " + profile.last_name).trim() || user.name || "—";
    setText("viewIdNumber", profile.id_number);
    setText("viewFullName", full);
    setText("viewEmail", profile.email || user.email);
    setText("viewPhone", profile.phone);
    setText("viewDob", profile.date_of_birth);
    setText("viewGender", profile.gender);
    setText("viewAddress", profile.address);
    setText(
      "viewEmergency",
      profile.emergency_contact_name
        ? profile.emergency_contact_name +
            " (" +
            (profile.emergency_contact_phone || "N/A") +
            ")"
        : ""
    );
    setText("viewBloodGroup", profile.blood_group);
    setText("viewAllergies", profile.allergies || "None");
    setText("viewPaymentMethod", profile.payment_method);
    setText("viewPaymentDetails", paymentDetailsText());

    const statProfile = document.getElementById("statProfile");
    if (statProfile) {
      const complete =
        profile.id_number &&
        profile.phone &&
        profile.address &&
        profile.payment_method;
      statProfile.textContent = complete ? "Complete" : "Incomplete";
    }
  }

  function togglePaymentFields() {
    const method = document.getElementById("editPaymentMethod")?.value;
    document.getElementById("cashFields")?.classList.toggle("show", method === "Cash");
    document
      .getElementById("medicalAidFields")
      ?.classList.toggle("show", method === "Medical Aid");
  }

  function fillForm() {
    setVal("editIdNumber", profile.id_number);
    setVal("editFirstName", profile.first_name);
    setVal("editLastName", profile.last_name);
    setVal("editPhone", profile.phone);
    setVal("editDob", profile.date_of_birth);
    setVal("editGender", profile.gender);
    setVal("editAddress", profile.address);
    setVal("editEmergencyName", profile.emergency_contact_name);
    setVal("editEmergencyPhone", profile.emergency_contact_phone);
    setVal("editBloodGroup", profile.blood_group);
    setVal("editAllergies", profile.allergies);
    setVal("editPaymentMethod", profile.payment_method);
    setVal("editPaymentResponsible", profile.payment_responsible);
    setVal("editPaymentRelationship", profile.payment_relationship);
    setVal("editMedicalAidName", profile.medical_aid_name);
    setVal("editMedicalAidNumber", profile.medical_aid_number);
    setVal("editMedicalAidPlan", profile.medical_aid_plan);
    setVal("editMedicalAidMember", profile.medical_aid_member);
    togglePaymentFields();
  }

  const profileView = document.getElementById("profileView");
  const profileEdit = document.getElementById("profileEdit");
  const editBtn = document.getElementById("editProfileBtn");
  const cancelBtn = document.getElementById("cancelProfileBtn");
  const profileForm = document.getElementById("profileForm");

  async function loadPatientProfileFromServer() {
    const data = await fetchJson("/api/profile/" + user.id);

    if (!data.success) {
      renderView();
      return;
    }

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
      id_number: p.id_number || u.id_number || "",
      first_name: first,
      last_name: last,
      email: u.email || p.email || user.email || "",
      phone: p.phone || u.phone || "",
      date_of_birth: p.date_of_birth || "",
      gender: p.gender || "",
      address: p.address || "",
      emergency_contact_name: p.emergency_contact_name || "",
      emergency_contact_phone: p.emergency_contact_phone || "",
      blood_group: p.blood_group || "",
      allergies: p.allergies || "",
      payment_method: p.payment_method || "",
      payment_responsible: p.payment_responsible || "",
      payment_relationship: p.payment_relationship || "",
      medical_aid_name: p.medical_aid_name || "",
      medical_aid_number: p.medical_aid_number || "",
      medical_aid_plan: p.medical_aid_plan || "",
      medical_aid_member: p.medical_aid_member || ""
    };

    renderView();
  }

  loadPatientProfileFromServer();

  editBtn?.addEventListener("click", () => {
    fillForm();
    if (profileView) profileView.style.display = "none";
    if (profileEdit) profileEdit.style.display = "block";
    if (editBtn) editBtn.style.display = "none";
  });

  cancelBtn?.addEventListener("click", () => {
    if (profileView) profileView.style.display = "block";
    if (profileEdit) profileEdit.style.display = "none";
    if (editBtn) editBtn.style.display = "inline-flex";
  });

  document
    .getElementById("editPaymentMethod")
    ?.addEventListener("change", togglePaymentFields);

  profileForm?.addEventListener("submit", async (e) => {
    e.preventDefault();

    const method = getVal("editPaymentMethod");

    if (method === "Cash") {
      if (!getVal("editPaymentResponsible") || !getVal("editPaymentRelationship")) {
        alert("Please enter who is responsible for payment and their relationship.");
        return;
      }
    }
    if (method === "Medical Aid") {
      if (!getVal("editMedicalAidName") || !getVal("editMedicalAidNumber")) {
        alert("Please enter medical aid name and member number.");
        return;
      }
    }

    const payload = {
      first_name: getVal("editFirstName"),
      last_name: getVal("editLastName"),
      phone: getVal("editPhone"),
      address: getVal("editAddress") || null,
      date_of_birth: getVal("editDob") || null,
      gender: getVal("editGender") || null,
      blood_group: getVal("editBloodGroup") || null,
      emergency_contact_name: getVal("editEmergencyName") || null,
      emergency_contact_phone: getVal("editEmergencyPhone") || null,
      allergies: getVal("editAllergies") || null,
      payment_method: method || null,
      payment_responsible: getVal("editPaymentResponsible") || null,
      payment_relationship: getVal("editPaymentRelationship") || null,
      medical_aid_name: getVal("editMedicalAidName") || null,
      medical_aid_number: getVal("editMedicalAidNumber") || null,
      medical_aid_plan: getVal("editMedicalAidPlan") || null,
      medical_aid_member: getVal("editMedicalAidMember") || null
    };

    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalText = submitBtn ? submitBtn.innerHTML : "Save";
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = "Saving...";
    }

    const data = await fetchJson("/api/patients/profile/" + user.id, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (data.success) {
      profile = {
        ...profile,
        first_name: payload.first_name,
        last_name: payload.last_name,
        phone: payload.phone || "",
        date_of_birth: payload.date_of_birth || "",
        gender: payload.gender || "",
        address: payload.address || "",
        emergency_contact_name: payload.emergency_contact_name || "",
        emergency_contact_phone: payload.emergency_contact_phone || "",
        blood_group: payload.blood_group || "",
        allergies: payload.allergies || "",
        payment_method: payload.payment_method || "",
        payment_responsible: payload.payment_responsible || "",
        payment_relationship: payload.payment_relationship || "",
        medical_aid_name: payload.medical_aid_name || "",
        medical_aid_number: payload.medical_aid_number || "",
        medical_aid_plan: payload.medical_aid_plan || "",
        medical_aid_member: payload.medical_aid_member || ""
      };

      const fullName = (payload.first_name + " " + payload.last_name).trim();
      if (fullName && nameEl) nameEl.textContent = fullName;
      if (initialsEl && fullName) {
        const parts = fullName.split(" ");
        initialsEl.textContent = (
          (parts[0] && parts[0][0] ? parts[0][0] : "") +
          (parts[1] && parts[1][0] ? parts[1][0] : "")
        ).toUpperCase();
      }

      renderView();
      if (profileView) profileView.style.display = "block";
      if (profileEdit) profileEdit.style.display = "none";
      if (editBtn) editBtn.style.display = "inline-flex";

      alert("Profile saved successfully!");
    } else {
      alert(data.message || "Failed to save profile.");
    }

    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalText;
    }
  });

  let doctorsCache = [];

  async function populateDoctors() {
    const sel = document.getElementById("bookDoctor");
    if (!sel) return;

    const data = await fetchJson("/api/doctors");

    if (data.success && data.doctors?.length) {
      doctorsCache = data.doctors;

      sel.innerHTML =
        '<option value="">Select a doctor</option>' +
        data.doctors
          .map((d) => {
            const avail = (d.availability || d.availability_status || "Available").trim();
            const label =
              avail.toLowerCase() === "available"
                ? `${d.full_name} — ${d.specialization || "General"}`
                : `${d.full_name} — ${d.specialization || "General"} (${avail})`;
            return `<option value="${d.doctor_id}" data-availability="${avail}">${label}</option>`;
          })
          .join("");
    } else {
      sel.innerHTML = '<option value="">No doctors available</option>';
    }
  }
  populateDoctors();

  document.getElementById("bookDoctor")?.addEventListener("change", function () {
    const option = this.options[this.selectedIndex];
    const availability = (option?.dataset?.availability || "Available").trim().toLowerCase();

    if (availability !== "available") {
      alert(
        "Please note the doctor selected is currently unavailable, kindly contact Joburg Hospital for available doctors"
      );
      this.value = "";
      const timeSel = document.getElementById("bookTime");
      if (timeSel) timeSel.innerHTML = '<option value="">Select date first</option>';
      return;
    }

    if (document.getElementById("bookDate")?.value) {
      populateAvailableTimes();
    }
  });

  function buildTimeSlots() {
    const slots = [];
    for (let h = 8; h <= 17; h++) {
      for (const m of [0, 30]) {
        if (h === 17 && m === 30) break;
        slots.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
      }
    }
    return slots;
  }

  async function populateAvailableTimes() {
    const timeSel = document.getElementById("bookTime");
    const doctorId = document.getElementById("bookDoctor")?.value;
    const date = document.getElementById("bookDate")?.value;

    if (!timeSel) return;

    if (!doctorId || !date) {
      timeSel.innerHTML = '<option value="">Select doctor and date first</option>';
      return;
    }

    const doctor = doctorsCache.find((d) => String(d.doctor_id) === String(doctorId));
    const avail = (doctor?.availability || doctor?.availability_status || "Available")
      .trim()
      .toLowerCase();
    if (avail !== "available") {
      alert(
        "Please note the doctor selected is currently unavailable, kindly contact Joburg Hospital for available doctors"
      );
      timeSel.innerHTML = '<option value="">Doctor unavailable</option>';
      return;
    }

    timeSel.innerHTML = '<option value="">Loading available times...</option>';

    const data = await fetchJson(`/api/appointments/taken?doctorId=${doctorId}&date=${date}`);

    const taken = new Set((data.takenTimes || []).map((t) => String(t).substring(0, 5)));

    const allSlots = buildTimeSlots();
    const freeSlots = allSlots.filter((slot) => !taken.has(slot));

    if (freeSlots.length === 0) {
      timeSel.innerHTML = '<option value="">No available times on this date</option>';
    } else {
      timeSel.innerHTML =
        '<option value="">Select time</option>' +
        freeSlots.map((t) => `<option value="${t}">${t}</option>`).join("");
    }
  }

  const bookDate = document.getElementById("bookDate");
  if (bookDate) {
    bookDate.min = new Date().toISOString().split("T")[0];
    bookDate.addEventListener("change", populateAvailableTimes);
  }

  document.getElementById("bookDoctor")?.addEventListener("change", function () {
    if (this.value && bookDate?.value) {
      populateAvailableTimes();
    }
  });

  async function renderAppointments() {
    const tbody = document.getElementById("appointmentsTableBody");
    if (!tbody) return;

    const data = await fetchJson(`/api/appointments/my?userId=${user.id}&role=patient`);
    const list = data.success ? (data.appointments || []) : [];

    const statEl = document.getElementById("statAppointments");
    if (statEl) statEl.textContent = String(list.length);

    if (!list.length) {
      tbody.innerHTML =
        '<tr><td colspan="6" style="text-align:center;color:#64748B;">No appointments yet</td></tr>';
      return;
    }

    tbody.innerHTML = list
      .map((a) => {
        const st = (a.status || "Pending").toLowerCase();
        const badge =
          st === "confirmed" || st === "completed"
            ? "confirmed"
            : st === "cancelled"
            ? "cancelled"
            : "pending";

        return `<tr>
          <td>${a.doctor_name || "—"}</td>
          <td>${a.specialization || "—"}</td>
          <td>${a.appointment_date || "—"}</td>
          <td>${a.appointment_time || "—"}</td>
          <td><span class="badge-status ${badge}">${a.status || "Pending"}</span></td>
          <td>${a.reason || "—"}</td>
        </tr>`;
      })
      .join("");
  }

  document.getElementById("bookForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();

    if (!profile.id_number) {
      alert("Please complete your profile (ID number) before booking.");
      showSection("profile");
      return;
    }

    const doctorId = document.getElementById("bookDoctor")?.value;
    const date = getVal("bookDate");
    const time = getVal("bookTime");
    const reason = getVal("bookReason");

    if (!doctorId || !date || !time) {
      alert("Please select doctor, date and time.");
      return;
    }

    const selectedOption = document.getElementById("bookDoctor")?.selectedOptions[0];
    const availability = (selectedOption?.dataset?.availability || "Available")
      .trim()
      .toLowerCase();
    if (availability !== "available") {
      alert(
        "Please note the doctor selected is currently unavailable, kindly contact Joburg Hospital for available doctors"
      );
      return;
    }

    const btn = e.target.querySelector('button[type="submit"]');
    const originalText = btn ? btn.innerHTML : "Book Appointment";
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Booking...';
    }

    const data = await fetchJson("/api/appointments/book", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: user.id,
        doctorId: Number(doctorId),
        appointmentDate: date,
        appointmentTime: time,
        reason: reason || null
      })
    });

    if (data.success) {
      alert("Appointment booked successfully!");
      document.getElementById("bookForm").reset();
      const timeSel = document.getElementById("bookTime");
      if (timeSel) timeSel.innerHTML = '<option value="">Select date first</option>';
      await renderAppointments();
      showSection("appointments");
    } else {
      alert(data.message || "Failed to book appointment.");
      populateAvailableTimes();
    }

    if (btn) {
      btn.disabled = false;
      btn.innerHTML = originalText;
    }
  });

  async function renderPatientPrescriptions() {
    const tbody = document.getElementById("prescriptionsTableBody");
    if (!tbody) return;

    const data = await fetchJson("/api/prescriptions");
    let list = data.success ? (data.prescriptions || []) : [];

    if (profile.id_number) {
      list = list.filter((r) => String(r.id_number) === String(profile.id_number));
    }

    const statEl = document.getElementById("statPrescriptions");
    if (statEl) statEl.textContent = String(list.length);

    if (!list.length) {
      tbody.innerHTML =
        '<tr><td colspan="5" style="text-align:center;color:#64748B;">No prescriptions yet</td></tr>';
      return;
    }

    tbody.innerHTML = list
      .map((r) => {
        const status = (r.status || "Pending").toLowerCase();
        const badge = status === "dispensed" ? "confirmed" : "pending";

        return `<tr>
          <td>#${r.prescription_id}</td>
          <td>${r.doctor_name || "—"}</td>
          <td>${r.medication || "—"}</td>
          <td>${r.quantity || "—"}</td>
          <td><span class="badge-status ${badge}">${r.status || "Pending"}</span></td>
        </tr>`;
      })
      .join("");
  }

  async function renderPatientBills() {
    const tbody = document.getElementById("billsTableBody");
    if (!tbody) return;

    const url = profile.id_number
      ? `/api/bills/patient?id_number=${encodeURIComponent(profile.id_number)}`
      : `/api/bills/patient/${user.id}`;

    const data = await fetchJson(url);
    const list = data.success ? (data.bills || []) : [];

    const statEl = document.getElementById("statBills");
    if (statEl) {
      const open = list.filter((b) => (b.payment_status || "").toLowerCase() !== "paid");
      statEl.textContent = String(open.length);
    }

    if (!list.length) {
      tbody.innerHTML =
        '<tr><td colspan="5" style="text-align:center;color:#64748B;">No bills yet</td></tr>';
      return;
    }

    tbody.innerHTML = list
      .map((b) => {
        const status = b.payment_status || "Pending";
        const badge =
          status === "Paid" ? "confirmed" : status === "Rejected" ? "cancelled" : "pending";

        return `<tr>
          <td>#${b.bill_id}</td>
          <td>R ${Number(b.total_amount || 0).toFixed(2)}</td>
          <td>${b.payment_method || "—"}</td>
          <td>${b.bill_date || b.created_at || "—"}</td>
          <td><span class="badge-status ${badge}">${status}</span></td>
        </tr>`;
      })
      .join("");
  }

  renderAppointments();
  renderPatientPrescriptions();
  renderPatientBills();
  showSection("overview");
});