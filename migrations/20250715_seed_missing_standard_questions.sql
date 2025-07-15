-- Seed missing standard questions for existing appointment types
-- This addresses the 404 errors for questions 5, 6, 7

DO $$
DECLARE
    appointment_type_rec RECORD;
    question_count INTEGER;
BEGIN
    -- Loop through all appointment types
    FOR appointment_type_rec IN SELECT id, name FROM appointment_types LOOP
        -- Check how many standard questions this appointment type has
        SELECT COUNT(*) INTO question_count 
        FROM standard_questions 
        WHERE appointment_type_id = appointment_type_rec.id;
        
        RAISE NOTICE 'Appointment type % (%) has % standard questions', 
            appointment_type_rec.id, appointment_type_rec.name, question_count;
        
        -- If it has fewer than 12 questions, seed the complete set
        IF question_count < 12 THEN
            -- Delete existing questions to avoid duplicates
            DELETE FROM standard_questions WHERE appointment_type_id = appointment_type_rec.id;
            
            -- Insert the complete set of 12 standard questions
            INSERT INTO standard_questions (appointment_type_id, field_key, label, field_type, included, required, order_position) VALUES
            (appointment_type_rec.id, 'customerName', 'Customer Name', 'text', true, true, 1),
            (appointment_type_rec.id, 'carrierName', 'Carrier Name', 'text', true, true, 2),
            (appointment_type_rec.id, 'mcNumber', 'Carrier MC #', 'text', true, true, 3),
            (appointment_type_rec.id, 'driverEmail', 'Driver/Dispatcher Email', 'email', true, true, 4),
            (appointment_type_rec.id, 'driverPhone', 'Driver/Dispatcher Phone Number', 'text', true, false, 5),
            (appointment_type_rec.id, 'driverLicense', 'Driver''s License Number', 'text', true, false, 6),
            (appointment_type_rec.id, 'bolDoc', 'BOL Doc', 'file', true, false, 7),
            (appointment_type_rec.id, 'bolNumber', 'BOL Number', 'text', true, true, 8),
            (appointment_type_rec.id, 'truckNumber', 'Truck Number', 'text', true, true, 9),
            (appointment_type_rec.id, 'trailerNumber', 'Trailer Number', 'text', true, false, 10),
            (appointment_type_rec.id, 'driverName', 'Driver''s Name', 'text', true, false, 11),
            (appointment_type_rec.id, 'itemDescription', 'Item Description/Quantity', 'textarea', true, false, 12);
            
            RAISE NOTICE 'Seeded 12 standard questions for appointment type % (%)', 
                appointment_type_rec.id, appointment_type_rec.name;
        ELSE
            RAISE NOTICE 'Skipping appointment type % (%) - already has % questions', 
                appointment_type_rec.id, appointment_type_rec.name, question_count;
        END IF;
    END LOOP;
    
    RAISE NOTICE 'Standard questions seeding completed';
EXCEPTION
    WHEN others THEN
        RAISE NOTICE 'Error seeding standard questions: %', SQLERRM;
END $$; 