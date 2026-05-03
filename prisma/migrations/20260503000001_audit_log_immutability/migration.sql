-- Prevent UPDATE and DELETE on audit_logs to ensure immutable audit trail.
-- Only INSERT is allowed. This protects against tampering by compromised admins.

CREATE OR REPLACE FUNCTION prevent_audit_log_modification()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION 'audit_logs rows cannot be updated (immutable audit trail)';
  ELSIF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'audit_logs rows cannot be deleted (immutable audit trail)';
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS enforce_audit_log_immutability ON audit_logs;

CREATE TRIGGER enforce_audit_log_immutability
  BEFORE UPDATE OR DELETE ON audit_logs
  FOR EACH ROW
  EXECUTE FUNCTION prevent_audit_log_modification();
