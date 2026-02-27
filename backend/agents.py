"""
Bloomfield BCCC — Background Agent Worker
==========================================
Runs periodic background jobs:

1. Pending Transfer Reminders — nudge the ticket handler about old unpaid e-transfers
2. Marketplace Stale Cleanup  — auto-withdraw old listings

    python backend/agents.py

Environment variables:
    BCCC_AGENT_INTERVAL_SECONDS                      polling loop interval (default: 300)
    BCCC_AGENT_PENDING_TRANSFER_HOURS                hours before a reminder (default: 48)
    BCCC_AGENT_PENDING_TRANSFER_REMINDER_COOLDOWN_HOURS  min gap between reminders (default: 24)
    BCCC_AGENT_MARKETPLACE_STALE_DAYS                days before auto-withdraw (default: 90)
"""

import os, sqlite3, time, uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
DB_PATH = BASE_DIR / "backend" / "bccc.db"

INTERVAL = int(os.getenv("BCCC_AGENT_INTERVAL_SECONDS", "300"))
PENDING_TRANSFER_HOURS = int(os.getenv("BCCC_AGENT_PENDING_TRANSFER_HOURS", "48"))
REMINDER_COOLDOWN_HOURS = int(os.getenv("BCCC_AGENT_PENDING_TRANSFER_REMINDER_COOLDOWN_HOURS", "24"))
MARKETPLACE_STALE_DAYS = int(os.getenv("BCCC_AGENT_MARKETPLACE_STALE_DAYS", "90"))


def get_db():
    conn = sqlite3.connect(str(DB_PATH), check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn


def job_pending_transfer_reminders():
    """Insert a reminder notification for tickets stuck in pending_transfer."""
    db = get_db()
    cutoff = (datetime.now(timezone.utc) - timedelta(hours=PENDING_TRANSFER_HOURS)).isoformat()
    cooldown_cutoff = (datetime.now(timezone.utc) - timedelta(hours=REMINDER_COOLDOWN_HOURS)).isoformat()

    ps = db.execute("SELECT ticket_handler_email FROM payment_settings WHERE id = 1").fetchone()
    handler_email = ps["ticket_handler_email"] if ps else ""
    if not handler_email:
        db.close()
        return 0

    tickets = db.execute(
        "SELECT * FROM tickets WHERE status = 'pending_transfer' AND created_at < ?", (cutoff,)
    ).fetchall()

    count = 0
    now = datetime.now(timezone.utc).isoformat()
    for t in tickets:
        # Check cooldown: was a reminder sent recently for this ticket?
        recent = db.execute(
            "SELECT 1 FROM notifications WHERE recipient_email = ? AND subject LIKE ? AND created_at > ? LIMIT 1",
            (handler_email, f"%{t['id']}%", cooldown_cutoff),
        ).fetchone()
        if recent:
            continue

        db.execute(
            "INSERT INTO notifications (id, recipient_email, subject, body, created_at) VALUES (?,?,?,?,?)",
            (str(uuid.uuid4()), handler_email,
             f"Reminder: pending e-transfer ticket {t['id']}",
             f"Ticket from {t['buyer_name']} ({t['buyer_email']}) for event {t['event_id']} "
             f"has been pending since {t['created_at']}.",
             now),
        )
        count += 1

    db.commit()
    db.close()
    return count


def job_marketplace_stale_cleanup():
    """Auto-withdraw marketplace items that have been active too long."""
    db = get_db()
    cutoff = (datetime.now(timezone.utc) - timedelta(days=MARKETPLACE_STALE_DAYS)).isoformat()
    result = db.execute(
        "UPDATE marketplace_items SET status = 'withdrawn' WHERE status = 'active' AND created_at < ?",
        (cutoff,),
    )
    count = result.rowcount
    db.commit()
    db.close()
    return count


def run():
    print(f"\n  Bloomfield BCCC Agents running (interval: {INTERVAL}s)")
    print(f"  Pending transfer reminder: after {PENDING_TRANSFER_HOURS}h, cooldown {REMINDER_COOLDOWN_HOURS}h")
    print(f"  Marketplace stale cleanup: after {MARKETPLACE_STALE_DAYS} days\n")

    while True:
        try:
            ts = datetime.now().strftime("%H:%M:%S")
            r1 = job_pending_transfer_reminders()
            r2 = job_marketplace_stale_cleanup()
            if r1 or r2:
                print(f"[{ts}] Reminders sent: {r1}, Stale items withdrawn: {r2}")
        except Exception as exc:
            print(f"[AGENT ERROR] {exc}")
        time.sleep(INTERVAL)


if __name__ == "__main__":
    run()
