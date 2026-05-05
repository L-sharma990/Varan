USE seat_allocation_v2_db;

DROP PROCEDURE IF EXISTS process_allocation_round;

DELIMITER $$

CREATE PROCEDURE process_allocation_round()
BEGIN
    DECLARE v_roundNo INT;
    DECLARE v_user_id INT;
    DECLARE v_currentSeatID INT;
    
    DECLARE v_done_users INT DEFAULT FALSE;
    DECLARE v_seatAllocatedThisRound BOOLEAN;
    DECLARE v_existing_log INT;

    -- Cursor for users
    DECLARE cur_users CURSOR FOR 
        SELECT u.id, u.currentSeatID
        FROM users u
        JOIN user_exam_details e ON u.id = e.user_id
        WHERE u.isExited = FALSE AND u.isFrozen = FALSE
        ORDER BY e.jee_rank ASC;

    DECLARE CONTINUE HANDLER FOR NOT FOUND SET v_done_users = TRUE;

    -- Get current round
    SELECT current_round INTO v_roundNo FROM system_config LIMIT 1;

    OPEN cur_users;
    
    user_loop: LOOP
        FETCH cur_users INTO v_user_id, v_currentSeatID;
        IF v_done_users THEN
            LEAVE user_loop;
        END IF;
        
        SET v_seatAllocatedThisRound = FALSE;
        
        -- Inner block for choices
        BEGIN
            DECLARE v_choice_branch_id INT;
            DECLARE v_done_choices INT DEFAULT FALSE;
            DECLARE v_remaining_capacity INT;
            
            DECLARE cur_choices CURSOR FOR 
                SELECT branch_id 
                FROM user_choices 
                WHERE user_id = v_user_id 
                ORDER BY preference_no ASC;
                
            DECLARE CONTINUE HANDLER FOR NOT FOUND SET v_done_choices = TRUE;
            
            OPEN cur_choices;
            
            choice_loop: LOOP
                FETCH cur_choices INTO v_choice_branch_id;
                IF v_done_choices THEN
                    LEAVE choice_loop;
                END IF;
                
                IF v_currentSeatID = v_choice_branch_id THEN
                    -- Reached their current seat, stop searching
                    LEAVE choice_loop;
                END IF;
                
                -- Check capacity
                SELECT remaining_capacity INTO v_remaining_capacity 
                FROM branches 
                WHERE branch_id = v_choice_branch_id 
                FOR UPDATE;
                
                IF v_remaining_capacity > 0 THEN
                    -- Allocate new seat
                    UPDATE branches SET remaining_capacity = remaining_capacity - 1 WHERE branch_id = v_choice_branch_id;
                    UPDATE users SET currentSeatID = v_choice_branch_id WHERE id = v_user_id;
                    
                    IF v_currentSeatID IS NOT NULL THEN
                        -- Release old seat
                        UPDATE branches SET remaining_capacity = remaining_capacity + 1 WHERE branch_id = v_currentSeatID;
                        INSERT INTO audit_logs (user_id, round_no, action, branch_id) VALUES (v_user_id, v_roundNo, 'Upgraded', v_choice_branch_id);
                    ELSE
                        INSERT INTO audit_logs (user_id, round_no, action, branch_id) VALUES (v_user_id, v_roundNo, 'Allocated', v_choice_branch_id);
                    END IF;
                    
                    SET v_seatAllocatedThisRound = TRUE;
                    LEAVE choice_loop;
                END IF;
                
            END LOOP choice_loop;
            CLOSE cur_choices;
        END; -- End of inner block
        
        -- If they didn't get a new seat, they retain their current seat
        IF NOT v_seatAllocatedThisRound AND v_currentSeatID IS NOT NULL THEN
            SELECT COUNT(*) INTO v_existing_log 
            FROM audit_logs 
            WHERE user_id = v_user_id AND round_no = v_roundNo AND action = 'Retained';
            
            IF v_existing_log = 0 THEN
                INSERT INTO audit_logs (user_id, round_no, action, branch_id) VALUES (v_user_id, v_roundNo, 'Retained', v_currentSeatID);
            END IF;
        END IF;

    END LOOP user_loop;
    
    CLOSE cur_users;
END$$

DELIMITER ;
