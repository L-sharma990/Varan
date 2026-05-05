USE seat_allocation_v2_db;

-- 1. Reset System Configuration back to Round 1
UPDATE system_config 
SET is_registration_open = TRUE, 
    is_choice_filling_open = TRUE, 
    is_result_published = FALSE, 
    current_round = 1 
WHERE id = 1;

-- 2. Clear all Allocation History (Audit Logs)
DELETE FROM audit_logs;

-- 3. Reset all Students to "Unallocated" state (Keeps their accounts and choices!)
UPDATE users 
SET currentSeatID = NULL, 
    isExited = FALSE, 
    isFrozen = FALSE;

-- 4. Restore Branch Capacities back to full
UPDATE branches 
SET remaining_capacity = total_capacity;

SELECT 'Demonstration Reset Successful! System is back to Round 1.' AS status;
