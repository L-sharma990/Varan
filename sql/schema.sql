USE seat_allocation_v2_db;

SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS results;
DROP TABLE IF EXISTS user_choices;
DROP TABLE IF EXISTS courses;
DROP TABLE IF EXISTS institutes;
SET FOREIGN_KEY_CHECKS = 1;

CREATE TABLE IF NOT EXISTS system_config (
    id INT PRIMARY KEY AUTO_INCREMENT,
    is_registration_open BOOLEAN DEFAULT TRUE,
    is_choice_filling_open BOOLEAN DEFAULT TRUE,
    is_allocation_run BOOLEAN DEFAULT FALSE,
    is_result_published BOOLEAN DEFAULT FALSE
);

INSERT INTO system_config (id, is_registration_open) VALUES (1, TRUE) ON DUPLICATE KEY UPDATE id=1;

CREATE TABLE IF NOT EXISTS users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    rollno VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(100) NOT NULL,
    category VARCHAR(50) DEFAULT 'OPEN',
    gender ENUM('Male', 'Female', 'Other'),
    dob DATE,
    phone VARCHAR(20),
    email VARCHAR(100)
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
    jee_adv_rollno VARCHAR(50) DEFAULT NULL,
    jee_adv_rank INT DEFAULT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);


CREATE TABLE IF NOT EXISTS courses (
    id INT PRIMARY KEY AUTO_INCREMENT,
    course_name VARCHAR(150) NOT NULL,
    total_seats INT NOT NULL DEFAULT 3,
    available_seats INT NOT NULL DEFAULT 3
);

SET FOREIGN_KEY_CHECKS = 0;
TRUNCATE TABLE courses;
SET FOREIGN_KEY_CHECKS = 1;

INSERT INTO courses (course_name, total_seats, available_seats) VALUES
('Computer Science and Engineering', 3, 3),
('Electronics and Communication Engineering', 3, 3),
('Mechanical Engineering', 3, 3),
('Data Science and Artificial Intelligence', 3, 3),
('Electrical Engineering', 3, 3),
('Civil Engineering', 3, 3);

CREATE TABLE IF NOT EXISTS user_choices (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    course_id INT NOT NULL,
    preference_no INT NOT NULL,
    is_locked BOOLEAN DEFAULT FALSE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
    UNIQUE (user_id, preference_no)
);

CREATE TABLE IF NOT EXISTS results (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL UNIQUE,
    course_id INT NOT NULL,
    status ENUM('Pending Payment', 'Paid') DEFAULT 'Pending Payment',
    allocated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
);
