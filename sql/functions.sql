USE seat_allocation_v2_db;

-- =============================================
-- FUNCTIONS
-- =============================================

DROP FUNCTION IF EXISTS get_student_status;
DROP FUNCTION IF EXISTS get_available_seats;
DROP FUNCTION IF EXISTS is_eligible_for_allocation;

DELIMITER $$

-- Function 1: Returns the current allocation status of a student
CREATE FUNCTION get_student_status(p_user_id INT)
RETURNS VARCHAR(20)
DETERMINISTIC
READS SQL DATA
BEGIN
    DECLARE v_isExited BOOLEAN;
    DECLARE v_isFrozen BOOLEAN;
    DECLARE v_currentSeatID INT;

    SELECT isExited, isFrozen, currentSeatID
    INTO v_isExited, v_isFrozen, v_currentSeatID
    FROM users WHERE id = p_user_id;

    IF v_isExited THEN
        RETURN 'Exited';
    ELSEIF v_isFrozen THEN
        RETURN 'Frozen';
    ELSEIF v_currentSeatID IS NOT NULL THEN
        RETURN 'Allocated';
    ELSE
        RETURN 'Unallocated';
    END IF;
END$$

-- Function 2: Returns remaining seat capacity for a branch
CREATE FUNCTION get_available_seats(p_branch_id INT)
RETURNS INT
DETERMINISTIC
READS SQL DATA
BEGIN
    DECLARE v_capacity INT DEFAULT 0;
    SELECT remaining_capacity INTO v_capacity
    FROM branches WHERE branch_id = p_branch_id;
    RETURN v_capacity;
END$$

-- Function 3: Checks if a student is eligible for seat allocation
CREATE FUNCTION is_eligible_for_allocation(p_user_id INT)
RETURNS BOOLEAN
DETERMINISTIC
READS SQL DATA
BEGIN
    DECLARE v_count INT DEFAULT 0;
    SELECT COUNT(*) INTO v_count
    FROM users
    WHERE id = p_user_id
      AND isExited = FALSE
      AND isFrozen = FALSE
      AND has_paid = TRUE;
    RETURN v_count > 0;
END$$

DELIMITER ;
