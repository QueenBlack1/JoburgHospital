
CREATE DATABASE IF NOT EXISTS joburg_hospital
CHARACTER SET utf8mb4
COLLATE utf8mb4_unicode_ci;

USE joburg_hospital;

CREATE TABLE IF NOT EXISTS users (
  user_id INT AUTO_INCREMENT PRIMARY KEY,
  full_name VARCHAR(150) NOT NULL,
  email VARCHAR(150) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  phone VARCHAR(30),
  id_number VARCHAR(50) NULL,
  role ENUM('Administrator', 'Doctor', 'Patient', 'Pharmacist') NOT NULL DEFAULT 'Patient',
  status ENUM('Active', 'Inactive', 'Suspended') NOT NULL DEFAULT 'Active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_users_email (email),
  INDEX idx_users_role (role),
  INDEX idx_users_status (status)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS administrators (
  administrator_id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  first_name VARCHAR(75) NOT NULL,
  last_name VARCHAR(75) NOT NULL,
  employee_number VARCHAR(50) UNIQUE,
  department VARCHAR(100),
  phone VARCHAR(30),
  email VARCHAR(150),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_administrator_user
    FOREIGN KEY (user_id) REFERENCES users(user_id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  INDEX idx_administrator_name (last_name, first_name)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS doctors (
  doctor_id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  first_name VARCHAR(75) NOT NULL,
  last_name VARCHAR(75) NOT NULL,
  full_name VARCHAR(150) NOT NULL,
  email VARCHAR(150) UNIQUE,
  phone VARCHAR(30),
  specialization VARCHAR(150),
  qualification VARCHAR(200),
  `registration_no.` VARCHAR(100) UNIQUE,
  consultation_fee_first_visit DECIMAL(10,2) DEFAULT 0.00,
  consultation_fee_follow_up DECIMAL(10,2) DEFAULT 0.00,
  availability_status ENUM('Available', 'Unavailable', 'On Leave') DEFAULT 'Available',
  signature_data LONGTEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_doctor_user
    FOREIGN KEY (user_id) REFERENCES users(user_id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  INDEX idx_doctor_name (last_name, first_name),
  INDEX idx_doctor_specialization (specialization),
  INDEX idx_doctor_availability (availability_status)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS patients (
  patient_id INT AUTO_INCREMENT PRIMARY KEY,
  id_number VARCHAR(50) NOT NULL UNIQUE,
  first_name VARCHAR(75) NOT NULL,
  last_name VARCHAR(75) NOT NULL,
  date_of_birth DATE,
  gender ENUM('Male', 'Female', 'Other'),
  phone VARCHAR(30),
  email VARCHAR(150),
  address VARCHAR(255),
  emergency_contact_name VARCHAR(150),
  emergency_contact_phone VARCHAR(30),
  blood_group VARCHAR(10),
  allergies TEXT,
  medical_history TEXT,
  payment_method VARCHAR(50),
  payment_responsible VARCHAR(150),
  payment_relationship VARCHAR(100),
  medical_aid_name VARCHAR(150),
  medical_aid_number VARCHAR(100),
  medical_aid_plan VARCHAR(100),
  medical_aid_member VARCHAR(150),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_patient_name (last_name, first_name),
  INDEX idx_patient_email (email)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS pharmacists (
  pharmacist_id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  first_name VARCHAR(75) NOT NULL,
  last_name VARCHAR(75) NOT NULL,
  full_name VARCHAR(150) NOT NULL,
  email VARCHAR(150) UNIQUE,
  phone VARCHAR(30),
  registration_number VARCHAR(100) UNIQUE,
  qualification VARCHAR(200),
  pharmacy_department VARCHAR(150),
  duty_status ENUM('On Duty', 'Off Duty', 'On Leave') DEFAULT 'On Duty',
  signature_data LONGTEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_pharmacist_user
    FOREIGN KEY (user_id) REFERENCES users(user_id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  INDEX idx_pharmacist_name (last_name, first_name)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS appointments (
  appointment_id INT AUTO_INCREMENT PRIMARY KEY,
  id_number VARCHAR(50) NOT NULL,
  doctor_id INT NOT NULL,
  appointment_date DATE NOT NULL,
  appointment_time TIME NOT NULL,
  reason TEXT,
  status ENUM('Pending', 'Confirmed', 'Completed', 'Cancelled', 'No Show') DEFAULT 'Pending',
  visit_type VARCHAR(50),
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_appointment_patient
    FOREIGN KEY (id_number) REFERENCES patients(id_number)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_appointment_doctor
    FOREIGN KEY (doctor_id) REFERENCES doctors(doctor_id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  INDEX idx_appointment_patient (id_number),
  INDEX idx_appointment_doctor (doctor_id),
  INDEX idx_appointment_date (appointment_date),
  INDEX idx_appointment_status (status)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS medicines (
  medicine_id INT AUTO_INCREMENT PRIMARY KEY,
  medicine_name VARCHAR(150) NOT NULL,
  generic_name VARCHAR(150),
  category VARCHAR(100),
  description TEXT,
  dosage VARCHAR(100),
  quantity INT DEFAULT 0,
  reorder_level INT DEFAULT 10,
  unit_price DECIMAL(10,2) DEFAULT 0.00,
  expiry_date DATE,
  supplier_name VARCHAR(150),
  batch_number VARCHAR(100),
  status ENUM('Available', 'In Stock', 'Low Stock', 'Out of Stock', 'Expired') DEFAULT 'Available',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_medicine_name (medicine_name),
  INDEX idx_medicine_status (status)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS prescriptions (
  prescription_id INT AUTO_INCREMENT PRIMARY KEY,
  id_number VARCHAR(50) NOT NULL,
  doctor_id INT NOT NULL,
  prescription_date DATE,
  status ENUM('Pending', 'Processing', 'Ready', 'Dispensed', 'Cancelled') DEFAULT 'Pending',
  notes TEXT,
  doctor_signature LONGTEXT,
  dispenser_signature LONGTEXT,
  dispensed_by INT NULL,
  dispensed_at DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_prescription_patient
    FOREIGN KEY (id_number) REFERENCES patients(id_number)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_prescription_doctor
    FOREIGN KEY (doctor_id) REFERENCES doctors(doctor_id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_prescription_dispenser
    FOREIGN KEY (dispensed_by) REFERENCES pharmacists(pharmacist_id)
    ON DELETE SET NULL ON UPDATE CASCADE,
  INDEX idx_prescription_patient (id_number),
  INDEX idx_prescription_doctor (doctor_id),
  INDEX idx_prescription_status (status)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS prescription_items (
  prescription_item_id INT AUTO_INCREMENT PRIMARY KEY,
  prescription_id INT NOT NULL,
  medicine_id INT NOT NULL,
  dosage VARCHAR(100),
  frequency VARCHAR(100),
  duration VARCHAR(100),
  quantity INT NOT NULL DEFAULT 1,
  instructions TEXT,
  CONSTRAINT fk_prescription_item_prescription
    FOREIGN KEY (prescription_id) REFERENCES prescriptions(prescription_id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_prescription_item_medicine
    FOREIGN KEY (medicine_id) REFERENCES medicines(medicine_id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  INDEX idx_prescription_item_prescription (prescription_id),
  INDEX idx_prescription_item_medicine (medicine_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS pharmacy_sales (
  sale_id INT AUTO_INCREMENT PRIMARY KEY,
  patient_name VARCHAR(150),
  id_number VARCHAR(50),
  pharmacy_fee DECIMAL(10,2) DEFAULT 0.00,
  total_amount DECIMAL(10,2) DEFAULT 0.00,
  payment_method VARCHAR(50) DEFAULT 'Cash',
  payment_status ENUM('Pending', 'Paid', 'Cancelled') DEFAULT 'Pending',
  sale_date DATETIME DEFAULT CURRENT_TIMESTAMP,
  pharmacist_id INT NULL,
  pharmacist_name VARCHAR(150),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_sale_id_number (id_number),
  INDEX idx_sale_pharmacist (pharmacist_id),
  INDEX idx_sale_date (sale_date)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS pharmacy_sale_items (
  sale_item_id INT AUTO_INCREMENT PRIMARY KEY,
  sale_id INT NOT NULL,
  medicine_id INT NOT NULL,
  quantity INT NOT NULL,
  unit_price DECIMAL(10,2) NOT NULL,
  subtotal DECIMAL(10,2) NOT NULL,
  CONSTRAINT fk_sale_item_sale
    FOREIGN KEY (sale_id) REFERENCES pharmacy_sales(sale_id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_sale_item_medicine
    FOREIGN KEY (medicine_id) REFERENCES medicines(medicine_id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  INDEX idx_sale_item_sale (sale_id),
  INDEX idx_sale_item_medicine (medicine_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS bills (
  bill_id INT AUTO_INCREMENT PRIMARY KEY,
  id_number VARCHAR(50) NOT NULL,
  appointment_id INT NULL,
  visit_type VARCHAR(50),
  consultation_fee DECIMAL(10,2) DEFAULT 0.00,
  pharmacy_fee DECIMAL(10,2) DEFAULT 0.00,
  other_charges DECIMAL(10,2) DEFAULT 0.00,
  total_amount DECIMAL(10,2) DEFAULT 0.00,
  payment_method VARCHAR(50) DEFAULT 'Cash',
  payment_status ENUM('Pending', 'Paid', 'Partially Paid', 'Cancelled') DEFAULT 'Pending',
  bill_date DATE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_bill_patient
    FOREIGN KEY (id_number) REFERENCES patients(id_number)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_bill_appointment
    FOREIGN KEY (appointment_id) REFERENCES appointments(appointment_id)
    ON DELETE SET NULL ON UPDATE CASCADE,
  INDEX idx_bill_patient (id_number),
  INDEX idx_bill_status (payment_status),
  INDEX idx_bill_date (bill_date)
) ENGINE=InnoDB;