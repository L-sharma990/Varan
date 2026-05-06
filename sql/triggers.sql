USE seat_allocation_v2_db;

-- =============================================
-- TRIGGERS
-- =============================================

DROP TRIGGER IF EXISTS trg_before_user_exit;
DROP TRIGGER IF EXISTS trg_after_registration;
DROP TRIGGER IF EXISTS trg_prevent_branch_delete;

DELIMITER $$

-- Trigger 1: Auto-releases seat capacity and logs when a student exits
CREATE TRIGGER trg_before_user_exit
BEFORE UPDATE ON users
FOR EACH ROW
BEGIN
    IF NEW.isExited = TRUE AND OLD.isExited = FALSE THEN
        -- Auto-release seat capacity
        IF OLD.currentSeatID IS NOT NULL THEN
            UPDATE branches SET remaining_capacity = remaining_capacity + 1
            WHERE branch_id = OLD.currentSeatID;
            SET NEW.currentSeatID = NULL;
        END IF;

        -- Auto-insert audit log
        INSERT INTO audit_logs (user_id, round_no, action, branch_id)
        VALUES (NEW.id, (SELECT current_round FROM system_config LIMIT 1), 'Exited', NULL);
    END IF;
END$$

-- Trigger 2: Auto-logs a new student registration in audit_logs
CREATE TRIGGER trg_after_registration
AFTER INSERT ON users
FOR EACH ROW
BEGIN
    INSERT INTO audit_logs (user_id, round_no, action, branch_id)
    VALUES (NEW.id, (SELECT current_round FROM system_config LIMIT 1), 'Registered', NULL);
END$$

-- Trigger 3: Prevents deletion of a branch if students are allocated to it
CREATE TRIGGER trg_prevent_branch_delete
BEFORE DELETE ON branches
FOR EACH ROW
BEGIN
    DECLARE v_count INT;
    SELECT COUNT(*) INTO v_count FROM users WHERE currentSeatID = OLD.branch_id;
    IF v_count > 0 THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Cannot delete branch: students are currently allocated to it.';
    END IF;
END$$

DELIMITER ;
