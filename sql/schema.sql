USE seat_allocation_v2_db;

SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS results;
DROP TABLE IF EXISTS audit_logs;
DROP TABLE IF EXISTS user_choices;
DROP TABLE IF EXISTS branches;
DROP TABLE IF EXISTS system_config;
DROP TABLE IF EXISTS user_exam_details;
DROP TABLE IF EXISTS user_parents;
DROP TABLE IF EXISTS users;
SET FOREIGN_KEY_CHECKS = 1;

CREATE TABLE IF NOT EXISTS system_config (
    id INT PRIMARY KEY AUTO_INCREMENT,
    is_registration_open BOOLEAN DEFAULT TRUE,
    is_choice_filling_open BOOLEAN DEFAULT TRUE,
    is_result_published BOOLEAN DEFAULT FALSE,
    current_round INT DEFAULT 1
);

INSERT INTO system_config (id, is_registration_open, is_choice_filling_open, is_result_published, current_round) 
VALUES (1, TRUE, TRUE, FALSE, 1) ON DUPLICATE KEY UPDATE id=1;

CREATE TABLE IF NOT EXISTS branches (
    branch_id INT PRIMARY KEY AUTO_INCREMENT,
    branch_name VARCHAR(150) NOT NULL,
    total_capacity INT NOT NULL DEFAULT 1,
    remaining_capacity INT NOT NULL DEFAULT 1
);

-- Pre-populate default branches (S1, S2, S3, S4 equivalent)
INSERT INTO branches (branch_name, total_capacity, remaining_capacity) VALUES
('Computer Science and Engineering', 1, 1),
('Electronics and Communication Engineering', 1, 1),
('Mechanical Engineering', 1, 1),
('Electrical Engineering', 1, 1);

CREATE TABLE IF NOT EXISTS users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    rollno VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(100) NOT NULL,
    category VARCHAR(50) DEFAULT 'OPEN',
    gender ENUM('Male', 'Female', 'Other'),
    dob DATE,
    phone VARCHAR(20),
    email VARCHAR(100),
    has_paid BOOLEAN DEFAULT FALSE,
    isExited BOOLEAN DEFAULT FALSE,
    isFrozen BOOLEAN DEFAULT FALSE,
    currentSeatID INT DEFAULT NULL,
    FOREIGN KEY (currentSeatID) REFERENCES branches(branch_id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS user_parents (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    f_name VARCHAR(100),
    m_name VARCHAR(100),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS user_exam_details (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    jee_rank INT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS user_choices (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    branch_id INT NOT NULL,
    preference_no INT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (branch_id) REFERENCES branches(branch_id) ON DELETE CASCADE,
    UNIQUE (user_id, preference_no)
);

CREATE TABLE IF NOT EXISTS audit_logs (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    round_no INT NOT NULL,
    action VARCHAR(50) NOT NULL, -- 'Allocated', 'Upgraded', 'Exited', 'Frozen', 'Floated', 'Retained'
    branch_id INT DEFAULT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (branch_id) REFERENCES branches(branch_id) ON DELETE SET NULL
);
