-- ============================================================
-- BURNBOARD — Notification System Enhancements
-- Additive-only: adds indexes and RPC functions for notifications
-- ============================================================

-- Notifications: fetch by user + read state + date
CREATE INDEX IF NOT EXISTS idx_notifications_user_read_date 
  ON notifications(user_id, is_read, created_at DESC);

-- Notifications: fetch unread count efficiently
CREATE INDEX IF NOT EXISTS idx_notifications_unread_count 
  ON notifications(user_id) 
  WHERE is_read = false;

-- Notifications: cleanup old read notifications
CREATE INDEX IF NOT EXISTS idx_notifications_cleanup 
  ON notifications(user_id, is_read, created_at) 
  WHERE is_read = true;

-- RPC: Process notification queue (batch insert from queue to notifications)
CREATE OR REPLACE FUNCTION process_notification_queue(batch_size INT DEFAULT 100)
RETURNS INT AS $$
DECLARE
  processed_count INT := 0;
  queue_item RECORD;
BEGIN
  FOR queue_item IN 
    SELECT id, user_id, type, title, message, link, dedup_key
    FROM notification_queue 
    WHERE processed = false 
    ORDER BY priority DESC, created_at ASC 
    LIMIT batch_size
  LOOP
    -- Insert into notifications table
    INSERT INTO notifications (user_id, type, title, message, link)
    VALUES (queue_item.user_id, queue_item.type, queue_item.title, queue_item.message, queue_item.link);
    
    -- Mark as processed
    UPDATE notification_queue SET processed = true WHERE id = queue_item.id;
    processed_count := processed_count + 1;
  END LOOP;
  
  RETURN processed_count;
END;
$$ LANGUAGE plpgsql;

-- RPC: Cleanup old processed queue entries
CREATE OR REPLACE FUNCTION cleanup_notification_queue()
RETURNS void AS $$
BEGIN
  DELETE FROM notification_queue 
  WHERE processed = true 
  AND created_at < now() - interval '7 days';
END;
$$ LANGUAGE plpgsql;

-- RPC: Cleanup old read notifications (for user maintenance)
CREATE OR REPLACE FUNCTION cleanup_old_notifications(target_user_id UUID, days_old INT DEFAULT 30)
RETURNS void AS $$
BEGIN
  DELETE FROM notifications 
  WHERE user_id = target_user_id 
  AND is_read = true 
  AND created_at < now() - (days_old || ' days')::interval;
END;
$$ LANGUAGE plpgsql;
