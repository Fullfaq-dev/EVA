-- Enable pg_cron for scheduling
CREATE EXTENSION IF NOT EXISTS "pg_cron";

-- Create a schema for our webhooks if it doesn't exist
CREATE SCHEMA IF NOT EXISTS webhooks;

-- Table to log reminder events that need to be sent to n8n
-- This acts as a queue for the "Database Webhooks" feature
CREATE TABLE IF NOT EXISTS webhooks.reminder_queue (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    payload JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on the queue table
ALTER TABLE webhooks.reminder_queue ENABLE ROW LEVEL SECURITY;

-- Function to check and queue all due reminders
CREATE OR REPLACE FUNCTION webhooks.check_and_queue_reminders()
RETURNS VOID AS $$
DECLARE
    reminder RECORD;
BEGIN
    -- Find reminders that are enabled and due
    FOR reminder IN
        SELECT r.*, p.full_name
        FROM reminders r
        JOIN user_profiles p ON r.user_telegram_id = p.telegram_id
        WHERE r.enabled = TRUE
        AND (r.updated_at + (r.interval_hours || ' hours')::interval) <= NOW()
    LOOP
        -- Insert into the queue table.
        -- This INSERT will trigger the "Database Webhook" you set up in the UI.
        INSERT INTO webhooks.reminder_queue (payload)
        VALUES (jsonb_build_object(
            'event', 'scheduled_reminder',
            'user_id', reminder.user_telegram_id,
            'user_name', reminder.full_name,
            'type', reminder.type,
            'interval_hours', reminder.interval_hours,
            'reminder_id', reminder.id
        ));

        -- Update updated_at to "reset" the timer for the next interval
        UPDATE reminders SET updated_at = NOW() WHERE id = reminder.id;
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Schedule the check to run every hour
-- You can change '0 * * * *' to '* * * * *' to run every minute
SELECT cron.schedule('check-reminders-every-hour', '0 * * * *', 'SELECT webhooks.check_and_queue_reminders();');

-- Comment explaining how to use this
COMMENT ON TABLE webhooks.reminder_queue IS 'Queue for reminders. Set up a Supabase Database Webhook on INSERT to this table.';
