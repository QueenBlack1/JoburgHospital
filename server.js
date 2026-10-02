
const express = require("express");
const path = require("path");
const cors = require("cors");
const mysql = require("mysql2/promise");
const bcrypt = require("bcryptjs");

const app = express();
const PORT = process.env.PORT || 5000;
const frontendPath = path.join(__dirname, "..", "frontend");

const db = mysql.createPool({
  host: "127.0.0.1",
  user: "root",
  password: "",
  database: "joburg_hospital",
  waitForConnections: true,
  connectionLimit: 10
});

async function testDatabase() {
  try {
    const conn = await db.getConnection();
    console.log("MySQL connected successfully");
    conn.release();
    return true;
  } catch (err) {
    console.error("MySQL connection failed:", err.message);
    return false;
  }
}

async function getPatientIdNumber(userId) {
  try {
    const [users] = await db.execute(
      "SELECT email, id_number FROM users WHERE user_id = ? LIMIT 1",
      [userId]
    );
    if (!users.length) return null;

    if (users[0].id_number) {
      return String(users[0].id_number).trim();
    }

    const [patients] = await db.execute(
      "SELECT id_number FROM patients WHERE email = ? LIMIT 1",
      [users[0].email]
    );
    return patients.length ? String(patients[0].id_number).trim() : null;
  } catch (err) {
    return null;
  }
}

app.use(cors());
app.use(express.json({ limit: "5mb" }));
app.use(express.static(frontendPath));

app.get("/", (req, res) => res.sendFile(path.join(frontendPath, "login.html")));
app.get("/login", (req, res) => res.sendFile(path.join(frontendPath, "login.html")));
app.get("/register", (req, res) => res.sendFile(path.join(frontendPath, "register.html")));
app.get("/index", (req, res) => res.sendFile(path.join(frontendPath, "index.html")));
app.get("/admin-dashboard", (req, res) => res.sendFile(path.join(frontendPath, "admin-dashboard.html")));
app.get("/doctor-dashboard", (req, res) => res.sendFile(path.join(frontendPath, "doctor-dashboard.html")));
app.get("/patient-dashboard", (req, res) => res.sendFile(path.join(frontendPath, "patient-dashboard.html")));
app.get("/pharmacist-dashboard", (req, res) => res.sendFile(path.join(frontendPath, "pharmacist-dashboard.html")));

app.post("/api/register", async (req, res) => {
  try {
    const { role, firstName, lastName, email, password, idNumber, phone } = req.body;

    if (!role || !firstName || !lastName || !email || !password) {
      return res.status(400).json({ success: false, message: "All fields are required." });
    }

    const cleanRole = String(role).toLowerCase().trim();
    const allowed = ["patient", "doctor", "administrator", "admin", "pharmacist"];
    if (!allowed.includes(cleanRole)) {
      return res.status(400).json({ success: false, message: "Invalid role." });
    }

    if (cleanRole === "patient" && (!idNumber || String(idNumber).trim().length < 6)) {
      return res.status(400).json({ success: false, message: "A valid ID number is required for patient registration." });
    }

    const cleanEmail = email.toLowerCase().trim();
    const cleanId = idNumber ? String(idNumber).trim() : null;

    const [existingEmail] = await db.execute("SELECT user_id FROM users WHERE email = ?", [cleanEmail]);
    if (existingEmail.length > 0) {
      return res.status(409).json({ success: false, message: "Email already registered." });
    }

    if (cleanId) {
      try {
        const [existingId] = await db.execute("SELECT id_number FROM patients WHERE id_number = ?", [cleanId]);
        if (existingId.length > 0) {
          return res.status(409).json({ success: false, message: "This ID number is already registered." });
        }
      } catch (_) {}
    }

    let dbRole = "Patient";
    if (cleanRole === "doctor") dbRole = "Doctor";
    else if (cleanRole === "administrator" || cleanRole === "admin") dbRole = "Administrator";
    else if (cleanRole === "pharmacist") dbRole = "Pharmacist";

    const hashed = await bcrypt.hash(password, 10);
    const fullName = firstName.trim() + " " + lastName.trim();

    let userId;
    try {
      const [result] = await db.execute(
        `INSERT INTO users (full_name, email, password, phone, id_number, role) VALUES (?, ?, ?, ?, ?, ?)`,
        [fullName, cleanEmail, hashed, phone || null, cleanId, dbRole]
      );
      userId = result.insertId;
    } catch (e) {
      const [result] = await db.execute(
        `INSERT INTO users (full_name, email, password, phone, role) VALUES (?, ?, ?, ?, ?)`,
        [fullName, cleanEmail, hashed, phone || null, dbRole]
      );
      userId = result.insertId;
    }

    if (dbRole === "Patient") {
      await db.execute(
        `INSERT INTO patients (id_number, first_name, last_name, email, phone) VALUES (?, ?, ?, ?, ?)`,
        [cleanId, firstName.trim(), lastName.trim(), cleanEmail, phone || null]
      );
    } else if (dbRole === "Doctor") {
      await db.execute(
        `INSERT INTO doctors (user_id, first_name, last_name, full_name, email, availability_status)
         VALUES (?, ?, ?, ?, ?, 'Available')`,
        [userId, firstName.trim(), lastName.trim(), fullName, cleanEmail]
      );
    } else if (dbRole === "Administrator") {
      await db.execute(
        `INSERT INTO administrators (user_id, first_name, last_name, email) VALUES (?, ?, ?, ?)`,
        [userId, firstName.trim(), lastName.trim(), cleanEmail]
      );
    } else if (dbRole === "Pharmacist") {
      await db.execute(
        `INSERT INTO pharmacists (user_id, first_name, last_name, full_name, email, duty_status)
         VALUES (?, ?, ?, ?, ?, 'On Duty')`,
        [userId, firstName.trim(), lastName.trim(), fullName, cleanEmail]
      );
    }

    res.status(201).json({ success: true, message: "Account created successfully. Please login." });
  } catch (err) {
    console.error("Register error:", err);
    res.status(500).json({ success: false, message: "Registration failed.", error: err.message });
  }
});

app.post("/api/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const [rows] = await db.execute(
      "SELECT user_id, full_name, email, password, role, status FROM users WHERE email = ?",
      [String(email || "").toLowerCase().trim()]
    );

    if (rows.length === 0) {
      return res.status(401).json({ success: false, message: "Invalid email or password." });
    }

    const user = rows[0];
    if (user.status && user.status !== "Active") {
      return res.status(403).json({ success: false, message: "Account is not active." });
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(401).json({ success: false, message: "Invalid email or password." });
    }

    let role = (user.role || "").toLowerCase();
    if (role === "administrator") role = "admin";

    res.json({
      success: true,
      message: "Login successful",
      user: {
        id: user.user_id,
        name: user.full_name,
        email: user.email,
        role
      }
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ success: false, message: "Login failed." });
  }
});

app.get("/api/profile/:userId", async (req, res) => {
  try {
    const userId = Number(req.params.userId);
    const [users] = await db.execute("SELECT * FROM users WHERE user_id = ?", [userId]);
    if (!users.length) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const user = users[0];
    let profile = {};
    const role = user.role;

    if (role === "Patient") {
      try {
        const [rows] = await db.execute(
          "SELECT * FROM patients WHERE email = ? OR id_number = ? LIMIT 1",
          [user.email, user.id_number || ""]
        );
        profile = rows[0] || {};
      } catch (_) {}
    } else if (role === "Doctor") {
      const [rows] = await db.execute("SELECT * FROM doctors WHERE user_id = ?", [userId]);
      profile = rows[0] || {};
    } else if (role === "Administrator") {
      const [rows] = await db.execute("SELECT * FROM administrators WHERE user_id = ?", [userId]);
      profile = rows[0] || {};
    } else if (role === "Pharmacist") {
      const [rows] = await db.execute("SELECT * FROM pharmacists WHERE user_id = ?", [userId]);
      profile = rows[0] || {};
    }

    res.json({ success: true, user, profile });
  } catch (err) {
    console.error("Get profile error:", err);
    res.status(500).json({ success: false, message: "Failed to load profile" });
  }
});

app.get("/api/doctors", async (req, res) => {
  try {
    const [doctors] = await db.execute(
      `SELECT 
         doctor_id, user_id,
         COALESCE(full_name, CONCAT(first_name, ' ', last_name)) AS full_name,
         specialization,
         consultation_fee_first_visit,
         consultation_fee_follow_up,
         COALESCE(availability_status, 'Available') AS availability,
         COALESCE(availability_status, 'Available') AS availability_status,
         phone, email, signature_data
       FROM doctors
       ORDER BY full_name`
    );
    res.json({ success: true, doctors });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, doctors: [], message: err.message });
  }
});

app.get("/api/patients", async (req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT 
         p.id_number, p.first_name, p.last_name,
         CONCAT(p.first_name, ' ', p.last_name) AS full_name,
         p.email, p.phone, p.address, p.date_of_birth, p.gender,
         p.blood_group, p.emergency_contact_name, p.emergency_contact_phone,
         p.allergies, p.payment_method, p.payment_responsible,
         p.payment_relationship, p.medical_aid_name, p.medical_aid_number,
         p.medical_aid_plan, p.medical_aid_member
       FROM patients p
       ORDER BY p.last_name, p.first_name`
    );
    res.json({ success: true, patients: rows });
  } catch (err) {
    console.error("Get patients error:", err);
    res.status(500).json({ success: false, patients: [], message: err.message });
  }
});

app.get("/api/pharmacists", async (req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT 
         pharmacist_id, user_id,
         COALESCE(full_name, CONCAT(IFNULL(first_name,''), ' ', IFNULL(last_name,''))) AS full_name,
         email, phone, registration_number, pharmacy_department,
         COALESCE(duty_status, 'On Duty') AS duty_status, signature_data
       FROM pharmacists
       ORDER BY full_name`
    );
    res.json({ success: true, pharmacists: rows });
  } catch (err) {
    console.error("Get pharmacists error:", err);
    res.status(500).json({ success: false, pharmacists: [], message: err.message });
  }
});

app.put("/api/doctors/profile/:userId", async (req, res) => {
  try {
    const userId = Number(req.params.userId);
    const {
      first_name, last_name, phone, specialization, qualification,
      registration_number, consultation_fee_first_visit,
      consultation_fee_follow_up, availability
    } = req.body;

    let fullName = null;
    if (first_name || last_name) {
      fullName = ((first_name || "").trim() + " " + (last_name || "").trim()).trim();
    }

    const availabilityStatus = availability || "Available";

    const [result] = await db.execute(
      `UPDATE doctors SET
        first_name = COALESCE(?, first_name),
        last_name = COALESCE(?, last_name),
        full_name = COALESCE(?, full_name),
        phone = COALESCE(?, phone),
        specialization = COALESCE(?, specialization),
        qualification = COALESCE(?, qualification),
        \`registration_no.\` = COALESCE(?, \`registration_no.\`),
        consultation_fee_first_visit = COALESCE(?, consultation_fee_first_visit),
        consultation_fee_follow_up = COALESCE(?, consultation_fee_follow_up),
        availability_status = ?
      WHERE user_id = ?`,
      [
        first_name || null, last_name || null, fullName || null, phone || null,
        specialization || null, qualification || null, registration_number || null,
        consultation_fee_first_visit || null, consultation_fee_follow_up || null,
        availabilityStatus, userId
      ]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: "Doctor profile not found." });
    }

    if (fullName) {
      await db.execute("UPDATE users SET full_name = ? WHERE user_id = ?", [fullName, userId]);
    }

    res.json({ success: true, message: "Doctor profile updated successfully.", availability: availabilityStatus });
  } catch (err) {
    console.error("Update doctor profile error:", err);
    res.status(500).json({ success: false, message: "Failed to update doctor profile.", error: err.message });
  }
});

app.put("/api/doctors/signature/:userId", async (req, res) => {
  try {
    const userId = Number(req.params.userId);
    const { signature } = req.body;

    if (!signature) {
      return res.status(400).json({ success: false, message: "Signature is required." });
    }

    const [result] = await db.execute(
      "UPDATE doctors SET signature_data = ? WHERE user_id = ?",
      [signature, userId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: "Doctor not found." });
    }

    res.json({ success: true, message: "Signature saved successfully." });
  } catch (err) {
    console.error("Save doctor signature error:", err);
    res.status(500).json({ success: false, message: "Failed to save signature." });
  }
});

app.put("/api/patients/profile/:userId", async (req, res) => {
  try {
    const userId = Number(req.params.userId);
    const body = req.body;

    const idNumber = await getPatientIdNumber(userId);
    if (!idNumber) {
      return res.status(404).json({ success: false, message: "Patient profile not found." });
    }

    await db.execute(
      `UPDATE patients SET
         first_name = COALESCE(?, first_name),
         last_name = COALESCE(?, last_name),
         phone = COALESCE(?, phone),
         address = COALESCE(?, address),
         date_of_birth = COALESCE(?, date_of_birth),
         gender = COALESCE(?, gender),
         blood_group = COALESCE(?, blood_group),
         emergency_contact_name = COALESCE(?, emergency_contact_name),
         emergency_contact_phone = COALESCE(?, emergency_contact_phone),
         allergies = COALESCE(?, allergies),
         payment_method = COALESCE(?, payment_method),
         payment_responsible = COALESCE(?, payment_responsible),
         payment_relationship = COALESCE(?, payment_relationship),
         medical_aid_name = COALESCE(?, medical_aid_name),
         medical_aid_number = COALESCE(?, medical_aid_number),
         medical_aid_plan = COALESCE(?, medical_aid_plan),
         medical_aid_member = COALESCE(?, medical_aid_member)
       WHERE id_number = ?`,
      [
        body.first_name || null, body.last_name || null, body.phone || null,
        body.address || null, body.date_of_birth || null, body.gender || null,
        body.blood_group || null, body.emergency_contact_name || null,
        body.emergency_contact_phone || null, body.allergies || null,
        body.payment_method || null, body.payment_responsible || null,
        body.payment_relationship || null, body.medical_aid_name || null,
        body.medical_aid_number || null, body.medical_aid_plan || null,
        body.medical_aid_member || null, idNumber
      ]
    );

    const fullName = body.first_name || body.last_name
      ? ((body.first_name || "").trim() + " " + (body.last_name || "").trim()).trim()
      : null;

    if (fullName || body.phone) {
      await db.execute(
        `UPDATE users SET full_name = COALESCE(?, full_name), phone = COALESCE(?, phone) WHERE user_id = ?`,
        [fullName, body.phone || null, userId]
      );
    }

    res.json({ success: true, message: "Patient profile updated successfully." });
  } catch (err) {
    console.error("Update patient profile error:", err);
    res.status(500).json({ success: false, message: "Failed to update patient profile.", error: err.message });
  }
});

app.put("/api/users/profile/:userId", async (req, res) => {
  try {
    const userId = Number(req.params.userId);
    const { first_name, last_name, phone, department, employee_number, registration_number, duty_status } = req.body;

    const fullName = first_name || last_name
      ? ((first_name || "").trim() + " " + (last_name || "").trim()).trim()
      : null;

    await db.execute(
      `UPDATE users SET full_name = COALESCE(?, full_name), phone = COALESCE(?, phone) WHERE user_id = ?`,
      [fullName, phone || null, userId]
    );

    const [users] = await db.execute("SELECT role FROM users WHERE user_id = ?", [userId]);
    if (users.length) {
      const role = users[0].role;

      if (role === "Administrator") {
        await db.execute(
          `UPDATE administrators SET
             first_name = COALESCE(?, first_name), last_name = COALESCE(?, last_name),
             phone = COALESCE(?, phone), department = COALESCE(?, department),
             employee_number = COALESCE(?, employee_number)
           WHERE user_id = ?`,
          [first_name || null, last_name || null, phone || null, department || null, employee_number || null, userId]
        );
      } else if (role === "Pharmacist") {
        await db.execute(
          `UPDATE pharmacists SET
             first_name = COALESCE(?, first_name), last_name = COALESCE(?, last_name),
             full_name = COALESCE(?, full_name), phone = COALESCE(?, phone),
             registration_number = COALESCE(?, registration_number),
             duty_status = COALESCE(?, duty_status)
           WHERE user_id = ?`,
          [first_name || null, last_name || null, fullName, phone || null, registration_number || null, duty_status || "On Duty", userId]
        );
      }
    }

    res.json({ success: true, message: "Profile updated successfully." });
  } catch (err) {
    console.error("Update user profile error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get("/api/medicines", async (req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT medicine_id, medicine_name, generic_name, category, dosage,
              quantity, reorder_level, unit_price, status, expiry_date
       FROM medicines ORDER BY medicine_name ASC`
    );
    res.json({ success: true, medicines: rows });
  } catch (err) {
    console.error("Get medicines error:", err);
    res.status(500).json({ success: false, medicines: [], message: err.message });
  }
});

app.post("/api/medicines", async (req, res) => {
  try {
    const { medicine_name, generic_name, category, description, dosage, quantity, reorder_level, unit_price, expiry_date, supplier_name, batch_number } = req.body;

    if (!medicine_name || !medicine_name.trim()) {
      return res.status(400).json({ success: false, message: "Medicine name is required." });
    }

    const [result] = await db.execute(
      `INSERT INTO medicines 
        (medicine_name, generic_name, category, description, dosage, quantity, 
         reorder_level, unit_price, expiry_date, supplier_name, batch_number, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'In Stock')`,
      [
        medicine_name.trim(), generic_name || null, category || "General", description || null,
        dosage || null, Number(quantity) || 0, Number(reorder_level) || 10,
        Number(unit_price) || 0, expiry_date || null, supplier_name || null, batch_number || null
      ]
    );

    res.status(201).json({ success: true, message: "Medicine added successfully.", medicineId: result.insertId });
  } catch (err) {
    console.error("Add medicine error:", err);
    res.status(500).json({ success: false, message: "Failed to add medicine.", error: err.message });
  }
});

app.post("/api/prescriptions", async (req, res) => {
  try {
    const { id_number, doctor_id, notes, instructions, items, doctor_signature } = req.body;

    if (!id_number || !doctor_id || !items || !items.length) {
      return res.status(400).json({ success: false, message: "Patient ID number, doctor and at least one medicine are required." });
    }

    let signatureToSave = doctor_signature || null;
    if (!signatureToSave) {
      const [docRows] = await db.execute("SELECT signature_data FROM doctors WHERE doctor_id = ? LIMIT 1", [doctor_id]);
      if (docRows.length && docRows[0].signature_data) signatureToSave = docRows[0].signature_data;
    }

    const [result] = await db.execute(
      `INSERT INTO prescriptions (id_number, doctor_id, prescription_date, status, notes, doctor_signature)
       VALUES (?, ?, CURDATE(), 'Pending', ?, ?)`,
      [id_number, doctor_id, notes || instructions || null, signatureToSave]
    );

    const prescriptionId = result.insertId;

    for (const item of items) {
      await db.execute(
        `INSERT INTO prescription_items (prescription_id, medicine_id, dosage, frequency, duration, quantity, instructions)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [prescriptionId, item.medicine_id, item.dosage || null, item.frequency || null, item.duration || null, item.quantity || 1, item.instructions || null]
      );
    }

    res.status(201).json({ success: true, message: "Prescription created successfully.", prescriptionId });
  } catch (err) {
    console.error("Create prescription error:", err);
    res.status(500).json({ success: false, message: "Failed to create prescription.", error: err.message });
  }
});

app.get("/api/prescriptions", async (req, res) => {
  try {
    const { status } = req.query;

    let sql = `
      SELECT pr.prescription_id, pr.id_number, pr.doctor_id, pr.prescription_date, pr.status,
             pr.notes, pr.doctor_signature, pr.dispenser_signature, pr.dispensed_by, pr.dispensed_at,
             CONCAT(p.first_name, ' ', p.last_name) AS patient_name,
             COALESCE(d.full_name, CONCAT(d.first_name, ' ', d.last_name)) AS doctor_name,
             COALESCE(ph.full_name, CONCAT(IFNULL(ph.first_name,''), ' ', IFNULL(ph.last_name,''))) AS dispensed_by_name,
             (SELECT GROUP_CONCAT(m.medicine_name SEPARATOR ', ') FROM prescription_items pi JOIN medicines m ON pi.medicine_id = m.medicine_id WHERE pi.prescription_id = pr.prescription_id) AS medication,
             (SELECT GROUP_CONCAT(IFNULL(pi.dosage, '') SEPARATOR ', ') FROM prescription_items pi WHERE pi.prescription_id = pr.prescription_id) AS dosage,
             (SELECT GROUP_CONCAT(pi.quantity SEPARATOR ', ') FROM prescription_items pi WHERE pi.prescription_id = pr.prescription_id) AS quantity
      FROM prescriptions pr
      LEFT JOIN patients p ON pr.id_number = p.id_number
      LEFT JOIN doctors d ON pr.doctor_id = d.doctor_id
      LEFT JOIN pharmacists ph ON pr.dispensed_by = ph.pharmacist_id
    `;

    const params = [];
    if (status) {
      sql += " WHERE pr.status = ?";
      params.push(status);
    }
    sql += " ORDER BY pr.prescription_date DESC, pr.prescription_id DESC";

    const [rows] = await db.execute(sql, params);
    res.json({ success: true, prescriptions: rows });
  } catch (err) {
    console.error("Get prescriptions error:", err);
    res.status(500).json({ success: false, prescriptions: [], message: err.message });
  }
});

app.get("/api/prescriptions/:id", async (req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT pr.*, CONCAT(p.first_name, ' ', p.last_name) AS patient_name,
              COALESCE(d.full_name, CONCAT(d.first_name, ' ', d.last_name)) AS doctor_name,
              COALESCE(ph.full_name, CONCAT(IFNULL(ph.first_name,''), ' ', IFNULL(ph.last_name,''))) AS dispensed_by_name
       FROM prescriptions pr
       LEFT JOIN patients p ON pr.id_number = p.id_number
       LEFT JOIN doctors d ON pr.doctor_id = d.doctor_id
       LEFT JOIN pharmacists ph ON pr.dispensed_by = ph.pharmacist_id
       WHERE pr.prescription_id = ?`,
      [req.params.id]
    );

    if (!rows.length) return res.status(404).json({ success: false, message: "Prescription not found." });

    const [items] = await db.execute(
      `SELECT pi.*, m.medicine_name, m.unit_price FROM prescription_items pi
       JOIN medicines m ON pi.medicine_id = m.medicine_id WHERE pi.prescription_id = ?`,
      [req.params.id]
    );

    res.json({ success: true, prescription: rows[0], items });
  } catch (err) {
    console.error("Get prescription error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

app.put("/api/prescriptions/:id/dispense", async (req, res) => {
  try {
    const prescriptionId = req.params.id;
    const { userId, signature } = req.body;

    if (!userId) return res.status(400).json({ success: false, message: "Pharmacist userId is required." });

    const [pharmRows] = await db.execute(
      `SELECT pharmacist_id, full_name, first_name, last_name, signature_data FROM pharmacists WHERE user_id = ? LIMIT 1`,
      [userId]
    );
    if (!pharmRows.length) return res.status(404).json({ success: false, message: "Pharmacist profile not found." });

    const pharmacist = pharmRows[0];
    const pharmacistId = pharmacist.pharmacist_id;
    const dispenserSignature = signature || pharmacist.signature_data || null;

    const [prescriptionRows] = await db.execute("SELECT * FROM prescriptions WHERE prescription_id = ?", [prescriptionId]);
    if (!prescriptionRows.length) return res.status(404).json({ success: false, message: "Prescription not found." });
    if (prescriptionRows[0].status === "Dispensed") return res.status(400).json({ success: false, message: "Prescription already dispensed." });

    await db.execute(
      `UPDATE prescriptions SET status = 'Dispensed', dispensed_by = ?, dispensed_at = NOW(), dispenser_signature = ? WHERE prescription_id = ?`,
      [pharmacistId, dispenserSignature, prescriptionId]
    );

    const [items] = await db.execute(
      `SELECT pi.*, m.unit_price FROM prescription_items pi JOIN medicines m ON pi.medicine_id = m.medicine_id WHERE pi.prescription_id = ?`,
      [prescriptionId]
    );

    let pharmacyFee = 0;
    items.forEach(item => { pharmacyFee += Number(item.quantity || 0) * Number(item.unit_price || 0); });
    pharmacyFee = Math.round(pharmacyFee * 100) / 100;

    const [patientRows] = await db.execute("SELECT first_name, last_name FROM patients WHERE id_number = ?", [prescriptionRows[0].id_number]);
    const patientName = patientRows.length ? `${patientRows[0].first_name || ""} ${patientRows[0].last_name || ""}`.trim() : null;
    const pharmacistName = pharmacist.full_name || `${pharmacist.first_name || ""} ${pharmacist.last_name || ""}`.trim();

    const [saleResult] = await db.execute(
      `INSERT INTO pharmacy_sales
        (patient_name, id_number, pharmacy_fee, total_amount, payment_method, payment_status, sale_date, pharmacist_id, pharmacist_name)
       VALUES (?, ?, ?, ?, 'Cash', 'Pending', NOW(), ?, ?)`,
      [patientName, prescriptionRows[0].id_number, pharmacyFee, pharmacyFee, pharmacistId, pharmacistName]
    );

    const saleId = saleResult.insertId;

    for (const item of items) {
      const subtotal = Number(item.quantity) * Number(item.unit_price || 0);
      await db.execute(
        `INSERT INTO pharmacy_sale_items (sale_id, medicine_id, quantity, unit_price, subtotal) VALUES (?, ?, ?, ?, ?)`,
        [saleId, item.medicine_id, item.quantity, item.unit_price || 0, subtotal]
      );
      await db.execute("UPDATE medicines SET quantity = GREATEST(0, quantity - ?) WHERE medicine_id = ?", [item.quantity, item.medicine_id]);
    }

    res.json({ success: true, message: "Prescription dispensed successfully.", dispensed_by: pharmacistName, pharmacy_fee: pharmacyFee });
  } catch (err) {
    console.error("Dispense error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get("/api/pharmacy-sales", async (req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT sale_id, patient_name, id_number, pharmacy_fee, total_amount,
              payment_method, payment_status, sale_date, pharmacist_name
       FROM pharmacy_sales 
       ORDER BY sale_date DESC, sale_id DESC`
    );
    res.json({ success: true, sales: rows });
  } catch (err) {
    console.error("Get pharmacy sales error:", err);
    res.status(500).json({ success: false, sales: [], message: err.message });
  }
});

app.put("/api/pharmacy-sales/:id/status", async (req, res) => {
  try {
    const { payment_status, payment_method } = req.body;
    if (!["Pending", "Paid", "Cancelled"].includes(payment_status)) {
      return res.status(400).json({ success: false, message: "Invalid payment status" });
    }

    const [result] = await db.execute(
      `UPDATE pharmacy_sales SET payment_status = ?, payment_method = COALESCE(?, payment_method), updated_at = NOW() WHERE sale_id = ?`,
      [payment_status, payment_method || null, req.params.id]
    );

    if (result.affectedRows === 0) return res.status(404).json({ success: false, message: "Sale not found" });
    res.json({ success: true, message: "Payment status updated successfully" });
  } catch (err) {
    console.error("Update pharmacy sale status error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get("/api/appointments/my", async (req, res) => {
  try {
    const userId = Number(req.query.userId) || 0;
    const role = (req.query.role || "").toLowerCase();

    let sql = `
      SELECT 
        a.appointment_id, 
        a.id_number, 
        a.doctor_id, 
        a.appointment_date, 
        a.appointment_time,
        a.reason, 
        a.status, 
        a.visit_type,
        CONCAT(p.first_name, ' ', p.last_name) AS patient_name,
        p.phone AS patient_phone,
        p.email AS patient_email,
        COALESCE(d.full_name, CONCAT(d.first_name, ' ', d.last_name)) AS doctor_name,
        d.specialization AS specialization
      FROM appointments a
      LEFT JOIN patients p ON a.id_number = p.id_number
      LEFT JOIN doctors d ON a.doctor_id = d.doctor_id
    `;
    const params = [];

    if (role === "patient") {
      const idNumber = await getPatientIdNumber(userId);
      if (!idNumber) return res.json({ success: true, appointments: [] });
      sql += " WHERE a.id_number = ?";
      params.push(idNumber);
    } else if (role === "doctor") {
      const [docRows] = await db.execute(
        "SELECT doctor_id FROM doctors WHERE user_id = ? LIMIT 1",
        [userId]
      );
      if (!docRows.length) return res.json({ success: true, appointments: [] });
      sql += " WHERE a.doctor_id = ?";
      params.push(docRows[0].doctor_id);
    }

    sql += " ORDER BY a.appointment_date DESC, a.appointment_time DESC";

    const [rows] = await db.execute(sql, params);
    res.json({ success: true, appointments: rows });
  } catch (err) {
    console.error("Get my appointments error:", err);
    res.status(500).json({ success: false, appointments: [], message: err.message });
  }
});

app.post("/api/appointments/book", async (req, res) => {
  try {
    console.log("========== BOOK APPOINTMENT ==========");
    console.log("Received body:", req.body);
    console.log("======================================");

    const userId = req.body.userId;
    const doctor_id = req.body.doctor_id || req.body.doctorId;
    const appointment_date = req.body.appointment_date || req.body.appointmentDate;
    const appointment_time = req.body.appointment_time || req.body.appointmentTime;
    const reason = req.body.reason || null;

    if (!userId) {
      return res.status(400).json({ success: false, message: "userId is missing" });
    }
    if (!doctor_id) {
      return res.status(400).json({ success: false, message: "doctor_id / doctorId is missing" });
    }
    if (!appointment_date) {
      return res.status(400).json({ success: false, message: "appointment_date / appointmentDate is missing" });
    }
    if (!appointment_time) {
      return res.status(400).json({ success: false, message: "appointment_time / appointmentTime is missing" });
    }

    const idNumber = await getPatientIdNumber(userId);
    if (!idNumber) {
      return res.status(404).json({
        success: false,
        message: "Patient profile not found. Please complete your profile first."
      });
    }

    const [existing] = await db.execute(
      `SELECT appointment_id FROM appointments 
       WHERE doctor_id = ? AND appointment_date = ? AND appointment_time = ? 
       AND status NOT IN ('Cancelled')`,
      [doctor_id, appointment_date, appointment_time]
    );

    if (existing.length > 0) {
      return res.status(409).json({
        success: false,
        message: "This time slot is already booked. Please choose another time."
      });
    }

    const [result] = await db.execute(
      `INSERT INTO appointments 
        (id_number, doctor_id, appointment_date, appointment_time, reason, status)
       VALUES (?, ?, ?, ?, ?, 'Pending')`,
      [idNumber, doctor_id, appointment_date, appointment_time, reason]
    );

    res.status(201).json({
      success: true,
      message: "Appointment booked successfully.",
      appointmentId: result.insertId
    });
  } catch (err) {
    console.error("Book appointment error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get("/api/appointments/taken", async (req, res) => {
  try {
    const { doctorId, date } = req.query;
    if (!doctorId || !date) {
      return res.status(400).json({ success: false, times: [], message: "doctorId and date are required." });
    }

    const [rows] = await db.execute(
      `SELECT appointment_time FROM appointments 
       WHERE doctor_id = ? AND appointment_date = ? AND status NOT IN ('Cancelled')`,
      [doctorId, date]
    );
    res.json({ success: true, times: rows.map(r => r.appointment_time) });
  } catch (err) {
    console.error("Get taken times error:", err);
    res.status(500).json({ success: false, times: [], message: err.message });
  }
});

app.get("/api/appointments/:id", async (req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT a.*, CONCAT(p.first_name, ' ', p.last_name) AS patient_name,
              COALESCE(d.full_name, CONCAT(d.first_name, ' ', d.last_name)) AS doctor_name
       FROM appointments a
       LEFT JOIN patients p ON a.id_number = p.id_number
       LEFT JOIN doctors d ON a.doctor_id = d.doctor_id
       WHERE a.appointment_id = ?`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ success: false, message: "Appointment not found" });
    res.json({ success: true, appointment: rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.put("/api/appointments/:id/status", async (req, res) => {
  try {
    const { status, visit_type } = req.body;
    if (visit_type) {
      await db.execute(
        `UPDATE appointments SET status = ?, visit_type = ? WHERE appointment_id = ?`,
        [status || "Pending", visit_type, req.params.id]
      );
    } else {
      await db.execute(
        `UPDATE appointments SET status = ? WHERE appointment_id = ?`,
        [status || "Pending", req.params.id]
      );
    }
    res.json({ success: true, message: "Status updated" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get("/api/bills", async (req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT b.bill_id, b.id_number, b.appointment_id, b.consultation_fee, b.pharmacy_fee,
              b.other_charges, b.total_amount, b.payment_method, b.payment_status,
              b.bill_date, b.visit_type,
              CONCAT(p.first_name, ' ', p.last_name) AS patient_name
       FROM bills b
       LEFT JOIN patients p ON b.id_number = p.id_number
       ORDER BY b.bill_date DESC, b.bill_id DESC`
    );
    res.json({ success: true, bills: rows });
  } catch (err) {
    console.error("Get bills error:", err);
    res.status(500).json({ success: false, bills: [], message: err.message });
  }
});

app.get("/api/bills/patient", async (req, res) => {
  try {
    const idNumber = req.query.id_number;
    if (!idNumber) {
      return res.status(400).json({ success: false, bills: [], message: "id_number is required" });
    }

    const [rows] = await db.execute(
      `SELECT bill_id, consultation_fee, pharmacy_fee, other_charges, total_amount,
              payment_method, payment_status, bill_date, visit_type
       FROM bills WHERE id_number = ? ORDER BY bill_date DESC`,
      [idNumber]
    );
    res.json({ success: true, bills: rows });
  } catch (err) {
    console.error("Get patient bills error:", err);
    res.status(500).json({ success: false, bills: [], message: err.message });
  }
});

app.get("/api/bills/doctor/:userId", async (req, res) => {
  try {
    const userId = Number(req.params.userId);

    const [docRows] = await db.execute(
      "SELECT doctor_id FROM doctors WHERE user_id = ? LIMIT 1",
      [userId]
    );

    if (!docRows.length) {
      return res.json({ success: true, bills: [] });
    }

    const doctorId = docRows[0].doctor_id;

    const [rows] = await db.execute(
      `SELECT 
         b.bill_id,
         b.id_number,
         b.appointment_id,
         b.consultation_fee,
         b.total_amount,
         b.payment_method,
         b.payment_status,
         b.bill_date,
         b.visit_type,
         CONCAT(p.first_name, ' ', p.last_name) AS patient_name
       FROM bills b
       LEFT JOIN patients p ON b.id_number = p.id_number
       LEFT JOIN appointments a ON b.appointment_id = a.appointment_id
       WHERE a.doctor_id = ?
       ORDER BY b.bill_date DESC, b.bill_id DESC`,
      [doctorId]
    );

    res.json({ success: true, bills: rows });
  } catch (err) {
    console.error("Get doctor bills error:", err);
    res.status(500).json({ success: false, bills: [], message: err.message });
  }
});

app.post("/api/bills", async (req, res) => {
  try {
    const { id_number, appointment_id, visit_type, consultation_fee, pharmacy_fee, other_charges, total_amount, payment_method, payment_status } = req.body;

    if (!id_number) {
      return res.status(400).json({ success: false, message: "Patient ID number is required." });
    }

    const consult = Number(consultation_fee) || 0;
    const pharmacy = Number(pharmacy_fee) || 0;
    const other = Number(other_charges) || 0;
    const total = total_amount != null ? Number(total_amount) : consult + pharmacy + other;

    const [result] = await db.execute(
      `INSERT INTO bills 
        (id_number, appointment_id, visit_type, consultation_fee, pharmacy_fee, other_charges, total_amount, payment_method, payment_status, bill_date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURDATE())`,
      [id_number, appointment_id || null, visit_type || null, consult, pharmacy, other, total, payment_method || "Cash", payment_status || "Pending"]
    );

    res.status(201).json({ success: true, message: "Bill created successfully.", billId: result.insertId });
  } catch (err) {
    console.error("Create bill error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

app.put("/api/bills/:id/status", async (req, res) => {
  try {
    const { status } = req.body;
    if (!status) {
      return res.status(400).json({ success: false, message: "Status is required." });
    }

    const [result] = await db.execute(
      "UPDATE bills SET payment_status = ? WHERE bill_id = ?",
      [status, req.params.id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: "Bill not found." });
    }

    if (status === "Paid") {
      const [billRows] = await db.execute(
        "SELECT id_number FROM bills WHERE bill_id = ?",
        [req.params.id]
      );

      if (billRows.length > 0) {
        const idNumber = billRows[0].id_number;

        await db.execute(
          `UPDATE pharmacy_sales 
           SET payment_status = 'Paid' 
           WHERE id_number = ? AND payment_status = 'Pending'`,
          [idNumber]
        );
      }
    }

    res.json({ success: true, message: "Bill status updated." });
  } catch (err) {
    console.error("Update bill status error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

app.use((req, res) => {
  res.status(404).json({ success: false, message: "Route not found", path: req.originalUrl });
});

async function startServer() {
  const ok = await testDatabase();

  app.listen(PORT, () => {
    console.log("");
    console.log("==================================================");
    console.log("     JOBURG HOSPITAL MANAGEMENT SYSTEM");
    console.log("==================================================");
    console.log(" Database:             " + (ok ? "Connected" : "FAILED – check MySQL"));
    console.log(" Server:               http://localhost:" + PORT);
    console.log("--------------------------------------------------");
    console.log(" Login:                http://localhost:" + PORT + "/login");
    console.log(" Register:             http://localhost:" + PORT + "/register");
    console.log(" Patient Dashboard:    http://localhost:" + PORT + "/patient-dashboard");
    console.log(" Doctor Dashboard:     http://localhost:" + PORT + "/doctor-dashboard");
    console.log(" Admin Dashboard:      http://localhost:" + PORT + "/admin-dashboard");
    console.log(" Pharmacist Dashboard: http://localhost:" + PORT + "/pharmacist-dashboard");
    console.log("==================================================");
    console.log("");
  });
}

startServer();