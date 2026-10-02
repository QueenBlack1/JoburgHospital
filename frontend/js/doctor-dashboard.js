document.addEventListener("DOMContentLoaded", () => {
  const stored = localStorage.getItem("joburg_current_user");
  const user = stored ? JSON.parse(stored) : null;

  if (!user || !user.id) {
    window.location.href = "/login";
    return;
  }

  if ((user.role || "").toLowerCase() !== "doctor") {
    window.location.href = "/login";
    return;
  }

  const nameEl = document.getElementById("userName");
  if (nameEl) nameEl.textContent = user.name || "Doctor";

  const initialsEl = document.getElementById("userInitials");
  if (initialsEl && user.name) {
    const parts = user.name.trim().split(" ");
    initialsEl.textContent =
      ((parts[0] && parts[0][0] ? parts[0][0] : "") +
        (parts[1] && parts[1][0] ? parts[1][0] : "")).toUpperCase() || "Dr";
  }

  let profile = {
    first_name: "",
    last_name: "",
    email: user.email || "",
    phone: "",
    specialization: "",
    qualification: "",
    registration_number: "",
    consultation_fee: "",
    availability: "Available",
    signature_data: null,
    doctor_id: null
  };

  let pendingAppointmentId = null;
  let medicinesCache = [];
  let myAppointments = [];

  function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value || "—";
  }

  function setVal(id, value) {
    const el = document.getElementById(id);
    if (el) el.value = value != null ? value : "";
  }

  function getVal(id) {
    const el = document.getElementById(id);
    return el ? el.value.trim() : "";
  }

  function openModal(id) {
    document.getElementById(id)?.classList.add("open");
  }

  function closeModal(id) {
    document.getElementById(id)?.classList.remove("open");
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
        img.onload = function () {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          hasInk = true;
        };
        img.src = dataUrl;
      }
    };
  }

  const signaturePad = setupSignaturePad("doctorSignatureCanvas");

  function showSignaturePreview(dataUrl) {
    const img = document.getElementById("viewSignature");
    const empty = document.getElementById("noSignatureText");
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

  document.getElementById("clearDoctorSignatureBtn")?.addEventListener("click", () => {
    if (signaturePad) signaturePad.clear();
  });

  document.getElementById("saveDoctorSignatureBtn")?.addEventListener("click", async () => {
    if (!signaturePad) {
      alert("Signature pad not found.");
      return;
    }

    if (signaturePad.isEmpty()) {
      alert("Please draw your signature first.");
      return;
    }

    const signatureData = signaturePad.toDataURL();

    try {
      const res = await fetch("/api/doctors/signature/" + user.id, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signature: signatureData })
      });

      const data = await res.json();

      if (data.success) {
        profile.signature_data = signatureData;
        showSignaturePreview(signatureData);
        alert("Signature saved successfully.");
      } else {
        alert(data.message || "Failed to save signature.");
      }
    } catch (err) {
      console.error(err);
      alert("Network error while saving signature.");
    }
  });

  const profileView = document.getElementById("profileView");
  const profileEdit = document.getElementById("profileEdit");
  const editBtn = document.getElementById("editProfileBtn");
  const cancelBtn = document.getElementById("cancelProfileBtn");

  function renderProfileView() {
    const fullName =
      (profile.first_name + " " + profile.last_name).trim() || user.name || "—";
    setText("viewFullName", fullName);
    setText("viewEmail", profile.email || user.email);
    setText("viewPhone", profile.phone);
    setText("viewSpecialization", profile.specialization);
    setText("viewQualification", profile.qualification || "—");
    setText("viewRegNumber", profile.registration_number || "—");

    setText(
      "viewFeeFirst",
      profile.consultation_fee_first_visit !== "" && profile.consultation_fee_first_visit != null
        ? Number(profile.consultation_fee_first_visit).toFixed(2)
        : "—"
    );
    setText(
      "viewFeeFollowUp",
      profile.consultation_fee_follow_up !== "" && profile.consultation_fee_follow_up != null
        ? Number(profile.consultation_fee_follow_up).toFixed(2)
        : "—"
    );

    setText("viewAvailability", profile.availability);
    showSignaturePreview(profile.signature_data);
  }

  async function loadDoctorProfile() {
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
          specialization: p.specialization || "",
          qualification: p.qualification || "",
          registration_number: p["registration_no."] || p.registration_no || p.registration_number || p.reg_number || "",
          consultation_fee_first_visit: p.consultation_fee_first_visit != null ? p.consultation_fee_first_visit : "",
          consultation_fee_follow_up: p.consultation_fee_follow_up != null ? p.consultation_fee_follow_up : "",
          availability: p.availability_status || p.availability || "Available",
          signature_data: p.signature_data || null,
          doctor_id: p.doctor_id || null
        };
      }

      renderProfileView();
    } catch (err) {
      console.error("Profile load error:", err);
      renderProfileView();
    }
  }

  if (editBtn) {
    editBtn.addEventListener("click", () => {
      setVal("editFirstName", profile.first_name);
      setVal("editLastName", profile.last_name);
      setVal("editPhone", profile.phone);
      setVal("editSpecialization", profile.specialization);
      setVal("editQualification", profile.qualification);
      setVal("editRegNumber", profile.registration_number);
      setVal("editFeeFirst", profile.consultation_fee_first_visit);
      setVal("editFeeFollowUp", profile.consultation_fee_follow_up);
      setVal("editAvailability", profile.availability || "Available");

      if (signaturePad) {
        signaturePad.clear();
        if (profile.signature_data) signaturePad.drawImage(profile.signature_data);
      }

      if (profileView) profileView.style.display = "none";
      if (profileEdit) profileEdit.style.display = "block";
      editBtn.style.display = "none";
    });
  }

  if (cancelBtn) {
    cancelBtn.addEventListener("click", () => {
      if (profileView) profileView.style.display = "block";
      if (profileEdit) profileEdit.style.display = "none";
      if (editBtn) editBtn.style.display = "inline-flex";
    });
  }

  document.getElementById("profileForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();

    const payload = {
      first_name: getVal("editFirstName"),
      last_name: getVal("editLastName"),
      phone: getVal("editPhone"),
      specialization: getVal("editSpecialization"),
      qualification: getVal("editQualification"),
      registration_number: getVal("editRegNumber"),
      consultation_fee_first_visit: getVal("editFeeFirst") ? Number(getVal("editFeeFirst")) : null,
      consultation_fee_follow_up: getVal("editFeeFollowUp") ? Number(getVal("editFeeFollowUp")) : null,
      availability: getVal("editAvailability") || "Available"
    };

    try {
      const res = await fetch("/api/doctors/profile/" + user.id, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (data.success) {
        profile.first_name = payload.first_name;
        profile.last_name = payload.last_name;
        profile.phone = payload.phone;
        profile.specialization = payload.specialization;
        profile.qualification = payload.qualification;
        profile.registration_number = payload.registration_number;
        profile.consultation_fee_first_visit = payload.consultation_fee_first_visit;
        profile.consultation_fee_follow_up = payload.consultation_fee_follow_up;
        profile.availability = payload.availability;

        const fullName = (payload.first_name + " " + payload.last_name).trim();
        if (fullName && document.getElementById("userName")) {
          document.getElementById("userName").textContent = fullName;
        }

        renderProfileView();
        if (profileView) profileView.style.display = "block";
        if (profileEdit) profileEdit.style.display = "none";
        if (editBtn) editBtn.style.display = "inline-flex";
        alert("Profile saved successfully.");
      } else {
        alert(data.message || "Failed to save profile.");
      }
    } catch (err) {
      console.error(err);
      alert("Network error. Please try again.");
    }
  });

  const titles = {
    overview: "Dashboard",
    profile: "My Profile",
    appointments: "Appointments",
    patients: "My Patients",
    prescriptions: "Prescriptions",
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

    if (id === "appointments") renderAppointments();
    if (id === "patients") renderPatients();
    if (id === "prescriptions") renderPrescriptions();
    if (id === "invoices") renderInvoices();
    if (id === "profile") loadDoctorProfile();
    if (id === "overview") loadOverview();
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

  function openVisitModal(appointmentId) {
    pendingAppointmentId = appointmentId;
    openModal("visitModal");
  }

  function closeVisitModal() {
    pendingAppointmentId = null;
    closeModal("visitModal");
  }

  document.getElementById("btnCancelVisit")?.addEventListener("click", closeVisitModal);
  document.getElementById("btnCancelVisitFooter")?.addEventListener("click", closeVisitModal);

  async function completeAppointment(visitType) {
    if (!pendingAppointmentId) return;

    try {
      const res = await fetch("/api/appointments/" + pendingAppointmentId + "/status", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "Completed",
          visit_type: visitType
        })
      });
      const data = await res.json();

      if (data.success) {
        alert("Appointment completed (" + visitType + ").");
        closeVisitModal();
        renderAppointments();
        loadOverview();
      } else {
        alert(data.message || "Failed to update appointment.");
      }
    } catch (err) {
      console.error(err);
      alert("Network error. Check if visit_type column exists in appointments table.");
    }
  }

  document.getElementById("btnFirstVisit")?.addEventListener("click", () => {
    completeAppointment("First Visit");
  });

  document.getElementById("btnSecondVisit")?.addEventListener("click", () => {
    completeAppointment("Second Visit");
  });

  async function renderAppointments() {
    const tbody = document.getElementById("appointmentsTableBody");
    if (!tbody) return;

    try {
      const res = await fetch(
        "/api/appointments/my?userId=" + encodeURIComponent(user.id) + "&role=doctor"
      );
      const data = await res.json();
      myAppointments = data.success ? data.appointments || [] : [];

      if (!myAppointments.length) {
        tbody.innerHTML =
          '<tr><td colspan="8" style="text-align:center;color:#64748B;">No appointments</td></tr>';
        return;
      }

      tbody.innerHTML = myAppointments
        .map((a) => {
          const status = a.status || "Pending";
          const statusClass =
            status === "Completed"
              ? "status-completed"
              : status === "Confirmed"
                ? "status-confirmed"
                : status === "Cancelled"
                  ? "status-cancelled"
                  : "status-pending";

          const canComplete = status !== "Completed" && status !== "Cancelled";

          return (
            "<tr>" +
            "<td>" + (a.patient_name || "—") + "</td>" +
            "<td>" + (a.patient_id_number || a.id_number || "—") + "</td>" +
            "<td>" + (a.appointment_date || "—") + "</td>" +
            "<td>" + (a.appointment_time || "—") + "</td>" +
            "<td>" + (a.reason || "—") + "</td>" +
            "<td>" + (a.visit_type || "—") + "</td>" +
            '<td><span class="status-pill ' + statusClass + '">' + status + "</span></td>" +
            "<td style='white-space:nowrap;'>" +
            (canComplete
              ? '<button type="button" class="btn btn-primary btn-sm btn-complete" data-id="' +
                a.appointment_id +
                '">Complete</button> '
              : "") +
            '<button type="button" class="btn btn-outline btn-sm btn-notes" data-id="' +
            a.appointment_id +
            '" data-patient="' +
            (a.patient_name || "") +
            '">Notes</button>' +
            "</td>" +
            "</tr>"
          );
        })
        .join("");

      tbody.querySelectorAll(".btn-complete").forEach((btn) => {
        btn.addEventListener("click", () => openVisitModal(btn.dataset.id));
      });

      tbody.querySelectorAll(".btn-notes").forEach((btn) => {
        btn.addEventListener("click", () => openClinicalNotes(btn.dataset.id, btn.dataset.patient));
      });
    } catch (err) {
      console.error("Appointments error:", err);
      tbody.innerHTML =
        '<tr><td colspan="8" style="text-align:center;color:#ef4444;">Failed to load appointments</td></tr>';
    }
  }

  async function renderPatients() {
    const tbody = document.getElementById("patientsTableBody");
    if (!tbody) return;

    try {
      if (!myAppointments.length) {
        const res = await fetch(
          "/api/appointments/my?userId=" + encodeURIComponent(user.id) + "&role=doctor"
        );
        const data = await res.json();
        myAppointments = data.success ? data.appointments || [] : [];
      }

      const map = {};
      myAppointments.forEach((a) => {
        const key = a.patient_id_number || a.id_number || a.patient_name;
        if (!key) return;
        if (!map[key]) {
          map[key] = {
            name: a.patient_name || "—",
            id_number: a.patient_id_number || a.id_number || "—",
            phone: a.patient_phone || "—",
            email: a.patient_email || "—",
            payment_method: a.payment_method || "Cash",
            visits: 0
          };
        }
        map[key].visits += 1;
      });

      const list = Object.values(map);
      setText("statPatients", String(list.length));

      if (!list.length) {
        tbody.innerHTML =
          '<tr><td colspan="6" style="text-align:center;color:#64748B;">No patients yet</td></tr>';
        return;
      }

      tbody.innerHTML = list
        .map((p) => {
          return (
            "<tr>" +
            "<td>" + p.name + "</td>" +
            "<td>" + p.id_number + "</td>" +
            "<td>" + p.phone + "</td>" +
            "<td>" + p.email + "</td>" +
            "<td>" + p.payment_method + "</td>" +
            "<td>" + p.visits + "</td>" +
            "</tr>"
          );
        })
        .join("");
    } catch (err) {
      console.error(err);
      tbody.innerHTML =
        '<tr><td colspan="6" style="text-align:center;color:#ef4444;">Failed to load patients</td></tr>';
    }
  }

  async function renderPrescriptions() {
    const tbody = document.getElementById("rxTableBody");
    if (!tbody) return;

    try {
      const res = await fetch("/api/prescriptions");
      const data = await res.json();
      let list = data.success ? data.prescriptions || [] : [];

      if (profile.doctor_id) {
        list = list.filter((r) => String(r.doctor_id) === String(profile.doctor_id));
      }

      setText("statRx", String(list.length));

      if (!list.length) {
        tbody.innerHTML =
          '<tr><td colspan="6" style="text-align:center;color:#64748B;">No prescriptions issued</td></tr>';
        return;
      }

      tbody.innerHTML = list
        .map((r) => {
          return (
            "<tr>" +
            "<td>#" + r.prescription_id + "</td>" +
            "<td>" + (r.patient_name || "—") + "</td>" +
            "<td>" + (r.medication || "—") + "</td>" +
            "<td>" + (r.dosage || "—") + "</td>" +
            "<td>" + (r.status || "Pending") + "</td>" +
            "<td>" + (r.prescription_date || "—") + "</td>" +
            "</tr>"
          );
        })
        .join("");
    } catch (err) {
      console.error(err);
      tbody.innerHTML =
        '<tr><td colspan="6" style="text-align:center;color:#ef4444;">Failed to load prescriptions</td></tr>';
    }
  }

  async function loadMedicines() {
    try {
      const res = await fetch("/api/medicines");
      const data = await res.json();
      medicinesCache = data.success ? data.medicines || [] : [];
    } catch (err) {
      medicinesCache = [];
    }
  }

  function medicineOptionsHtml() {
    return (
      '<option value="">Select medicine</option>' +
      medicinesCache
        .map(
          (m) =>
            '<option value="' +
            m.medicine_id +
            '">' +
            (m.medicine_name || "Medicine") +
            "</option>"
        )
        .join("")
    );
  }

  function fillPatientSelect() {
    const select = document.getElementById("rxPatient");
    if (!select) return;

    const map = {};
    myAppointments.forEach((a) => {
      const idNum = a.patient_id_number || a.id_number;
      if (!idNum) return;
      if (!map[idNum]) {
        map[idNum] = a.patient_name || idNum;
      }
    });

    select.innerHTML =
      '<option value="">Select patient</option>' +
      Object.keys(map)
        .map(
          (id) =>
            '<option value="' + id + '">' + map[id] + " (" + id + ")</option>"
        )
        .join("");
  }

  function createMedicationRow() {
    const row = document.createElement("div");
    row.className = "medication-row";
    row.innerHTML =
      "<div><select class=\"form-control med-name\" required>" +
      medicineOptionsHtml() +
      "</select></div>" +
      '<div><input type="text" class="form-control med-dosage" placeholder="Dosage" required></div>' +
      '<div><input type="text" class="form-control med-frequency" placeholder="Frequency" required></div>' +
      '<div><input type="text" class="form-control med-duration" placeholder="Duration" required></div>' +
      '<div><input type="text" class="form-control med-qty" placeholder="Qty" required></div>' +
      '<div><button type="button" class="btn btn-outline btn-sm remove-med-row"><i class="fas fa-trash"></i></button></div>';

    row.querySelector(".remove-med-row").addEventListener("click", () => row.remove());
    return row;
  }

  function refreshFirstMedicationSelect() {
    const first = document.querySelector("#medicationsContainer .med-name");
    if (first) first.innerHTML = medicineOptionsHtml();
  }

  document.getElementById("openRxModal")?.addEventListener("click", async () => {
    if (!profile.doctor_id) await loadDoctorProfile();
    if (!myAppointments.length) await renderAppointments();
    await loadMedicines();
    fillPatientSelect();
    refreshFirstMedicationSelect();
    openModal("rxModal");
  });

  document.getElementById("closeRxModal")?.addEventListener("click", () => closeModal("rxModal"));
  document.getElementById("cancelRxModal")?.addEventListener("click", () => closeModal("rxModal"));

  document.getElementById("addMedicationRow")?.addEventListener("click", () => {
    document.getElementById("medicationsContainer")?.appendChild(createMedicationRow());
  });

  document.getElementById("rxForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();

    const idNumber = getVal("rxPatient");
    const instructions = getVal("rxInstructions");

    if (!idNumber) {
      alert("Select a patient.");
      return;
    }
    if (!profile.doctor_id) {
      alert("Doctor profile not linked. Check doctors.user_id in database.");
      return;
    }

    const rows = document.querySelectorAll("#medicationsContainer .medication-row");
    const items = [];

    rows.forEach((row) => {
      const medicineId = row.querySelector(".med-name")?.value;
      if (!medicineId) return;
      items.push({
        medicine_id: Number(medicineId),
        dosage: row.querySelector(".med-dosage")?.value.trim() || null,
        frequency: row.querySelector(".med-frequency")?.value.trim() || null,
        duration: row.querySelector(".med-duration")?.value.trim() || null,
        quantity: Number(row.querySelector(".med-qty")?.value) || 1
      });
    });

    if (!items.length) {
      alert("Add at least one medicine.");
      return;
    }

    try {
      const res = await fetch("/api/prescriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id_number: idNumber,
          doctor_id: profile.doctor_id,
          notes: instructions,
          instructions: instructions,
          items: items,
          doctor_signature: profile.signature_data || null
        })
      });
      const data = await res.json();

      if (data.success) {
        alert("Prescription issued.");
        closeModal("rxModal");
        renderPrescriptions();
      } else {
        alert(data.message || "Failed to issue prescription.");
      }
    } catch (err) {
      console.error(err);
      alert("Network error.");
    }
  });

  async function openClinicalNotes(appointmentId, patientName) {
    setVal("clinicalAppointmentId", appointmentId);
    setText("clinicalNotesPatient", patientName || "");
    setVal("assessmentDiagnosis", "");
    setVal("investigations", "");
    setVal("encounterMedications", "");
    setVal("managementPlan", "");

    try {
      const res = await fetch("/api/appointments/" + appointmentId + "/notes");
      const data = await res.json();
      if (data.success && data.notes) {
        setVal("assessmentDiagnosis", data.notes.assessment || "");
        setVal("investigations", data.notes.investigations || "");
        setVal("encounterMedications", data.notes.medications || "");
        setVal("managementPlan", data.notes.management_plan || "");
      }
    } catch (err) {
      console.error(err);
    }

    openModal("clinicalNotesModal");
  }

  document.getElementById("closeClinicalNotesModal")?.addEventListener("click", () => {
    closeModal("clinicalNotesModal");
  });
  document.getElementById("cancelClinicalNotes")?.addEventListener("click", () => {
    closeModal("clinicalNotesModal");
  });

  document.getElementById("clinicalNotesForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const appointmentId = getVal("clinicalAppointmentId");
    if (!appointmentId) return;

    try {
      const res = await fetch("/api/appointments/" + appointmentId + "/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assessment: getVal("assessmentDiagnosis"),
          investigations: getVal("investigations"),
          medications: getVal("encounterMedications"),
          management_plan: getVal("managementPlan")
        })
      });
      const data = await res.json();
      if (data.success) {
        alert("Notes saved.");
        closeModal("clinicalNotesModal");
      } else {
        alert(data.message || "Failed to save notes.");
      }
    } catch (err) {
      console.error(err);
      alert("Network error.");
    }
  });

  async function renderInvoices() {
    const tbody = document.getElementById("invoicesTableBody");
    if (!tbody) return;

    try {
      const res = await fetch("/api/bills/doctor/" + user.id);
      const data = await res.json();
      const list = data.success ? data.bills || [] : [];

      setText("statInvoices", String(list.length));

      if (!list.length) {
        tbody.innerHTML =
          '<tr><td colspan="6" style="text-align:center;color:#64748B;">No invoices yet</td></tr>';
        return;
      }

      tbody.innerHTML = list
        .map((b) => {
          const status = b.payment_status || "Pending";
          const amount = Number(b.consultation_fee || 0).toFixed(2);

          return (
            "<tr>" +
            "<td>#" + b.bill_id + "</td>" +
            "<td>" + (b.patient_name || b.id_number || "—") + "</td>" +
            "<td>" + (b.bill_date || "—") + "</td>" +
            "<td>R " + amount + "</td>" +
            "<td>" + (b.payment_method || "—") + "</td>" +
            "<td>" + status + "</td>" +
            "</tr>"
          );
        })
        .join("");
    } catch (err) {
      console.error(err);
      tbody.innerHTML =
        '<tr><td colspan="6" style="text-align:center;color:#ef4444;">Failed to load invoices</td></tr>';
    }
  }

  async function loadOverview() {
    await renderAppointments();
    await renderPatients();
    await renderPrescriptions();
    await renderInvoices();

    const today = new Date().toISOString().slice(0, 10);
    const todayCount = myAppointments.filter((a) => {
      const d = String(a.appointment_date || "").slice(0, 10);
      return d === today;
    }).length;

    setText("statToday", String(todayCount));
  }

  loadDoctorProfile().then(() => {
    loadOverview();
    showSection("overview");
  });
});