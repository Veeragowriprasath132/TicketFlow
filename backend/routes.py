"""
routes.py — All API endpoints for TicketFlow
"""
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone, timedelta
from database import get_db

router = APIRouter(prefix="/api")

SLA_HOURS = {"Critical": 4, "High": 8, "Medium": 24, "Low": 72}
TICKET_COUNTER_START = 1016


# ── Schemas ───────────────────────────────────────────────

class TicketCreate(BaseModel):
    subject: str
    description: Optional[str] = None
    category: str
    priority: str = "Medium"
    ticket_type: str = "Incident"
    team_id: Optional[int] = None
    agent_id: Optional[int] = None
    reporter_name: Optional[str] = None
    reporter_email: Optional[str] = None
    tags: Optional[str] = "[]"

class TicketUpdate(BaseModel):
    subject: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    priority: Optional[str] = None
    team_id: Optional[int] = None
    agent_id: Optional[int] = None
    resolution_note: Optional[str] = None


# ── Helper ─────────────────────────────────────────────────

def row_to_dict(row) -> dict:
    return dict(row) if row else None

def rows_to_list(rows) -> list:
    return [dict(r) for r in rows]


# ── Teams ─────────────────────────────────────────────────

@router.get("/teams")
def get_teams():
    db = get_db()
    teams = rows_to_list(db.execute("SELECT * FROM teams").fetchall())
    for team in teams:
        team["agent_count"] = db.execute(
            "SELECT COUNT(*) FROM agents WHERE team_id=? AND is_active=1", (team["id"],)
        ).fetchone()[0]
        team["open_tickets"] = db.execute(
            "SELECT COUNT(*) FROM tickets WHERE team_id=? AND status NOT IN ('Resolved','Closed')", (team["id"],)
        ).fetchone()[0]
        team["total_tickets"] = db.execute(
            "SELECT COUNT(*) FROM tickets WHERE team_id=?", (team["id"],)
        ).fetchone()[0]
    db.close()
    return teams


@router.get("/teams/{team_id}")
def get_team(team_id: int):
    db = get_db()
    team = row_to_dict(db.execute("SELECT * FROM teams WHERE id=?", (team_id,)).fetchone())
    if not team:
        raise HTTPException(404, "Team not found")
    team["agents"] = rows_to_list(db.execute("SELECT * FROM agents WHERE team_id=?", (team_id,)).fetchall())
    db.close()
    return team


# ── Agents ────────────────────────────────────────────────

@router.get("/agents")
def get_agents(team_id: Optional[int] = Query(None)):
    db = get_db()
    if team_id:
        agents = rows_to_list(db.execute("SELECT * FROM agents WHERE team_id=? AND is_active=1", (team_id,)).fetchall())
    else:
        agents = rows_to_list(db.execute("SELECT * FROM agents WHERE is_active=1").fetchall())
    for agent in agents:
        agent["open_tickets"] = db.execute(
            "SELECT COUNT(*) FROM tickets WHERE agent_id=? AND status NOT IN ('Resolved','Closed')", (agent["id"],)
        ).fetchone()[0]
        agent["resolved_tickets"] = db.execute(
            "SELECT COUNT(*) FROM tickets WHERE agent_id=? AND status='Resolved'", (agent["id"],)
        ).fetchone()[0]
    db.close()
    return agents


# ── Tickets ───────────────────────────────────────────────

@router.get("/tickets")
def get_tickets(
    status: Optional[str] = Query(None),
    team_id: Optional[int] = Query(None),
    priority: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200)
):
    db = get_db()
    query = """
        SELECT t.*, tm.name as team_name, a.name as agent_name
        FROM tickets t
        LEFT JOIN teams tm ON t.team_id = tm.id
        LEFT JOIN agents a ON t.agent_id = a.id
        WHERE 1=1
    """
    params = []
    if status:
        query += " AND t.status = ?"
        params.append(status)
    if team_id:
        query += " AND t.team_id = ?"
        params.append(team_id)
    if priority:
        query += " AND t.priority = ?"
        params.append(priority)
    if category:
        query += " AND t.category = ?"
        params.append(category)
    if search:
        query += " AND (t.subject LIKE ? OR t.ticket_number LIKE ? OR t.reporter_name LIKE ?)"
        params.extend([f"%{search}%", f"%{search}%", f"%{search}%"])

    total = db.execute(f"SELECT COUNT(*) FROM ({query})", params).fetchone()[0]
    query += " ORDER BY t.created_at DESC LIMIT ? OFFSET ?"
    params.extend([page_size, (page - 1) * page_size])

    tickets = rows_to_list(db.execute(query, params).fetchall())
    db.close()
    return {"total": total, "page": page, "page_size": page_size, "tickets": tickets}


@router.post("/tickets", status_code=201)
def create_ticket(data: TicketCreate):
    db = get_db()
    now = datetime.now(timezone.utc).isoformat()
    count = db.execute("SELECT COUNT(*) FROM tickets").fetchone()[0]
    ticket_number = f"TF-{TICKET_COUNTER_START + count}"
    sla_due = (datetime.now(timezone.utc) + timedelta(hours=SLA_HOURS.get(data.priority, 24))).isoformat()

    cursor = db.execute("""
        INSERT INTO tickets (ticket_number, subject, description, category, priority,
            status, ticket_type, team_id, agent_id, reporter_name, reporter_email,
            created_at, updated_at, sla_due_at, tags)
        VALUES (?, ?, ?, ?, ?, 'Open', ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (ticket_number, data.subject, data.description, data.category, data.priority,
          data.ticket_type, data.team_id, data.agent_id,
          data.reporter_name, data.reporter_email,
          now, now, sla_due, data.tags or "[]"))
    db.commit()

    ticket = row_to_dict(db.execute("""
        SELECT t.*, tm.name as team_name, a.name as agent_name
        FROM tickets t
        LEFT JOIN teams tm ON t.team_id = tm.id
        LEFT JOIN agents a ON t.agent_id = a.id
        WHERE t.id = ?
    """, (cursor.lastrowid,)).fetchone())
    db.close()
    return ticket


@router.get("/tickets/{ticket_id}")
def get_ticket(ticket_id: int):
    db = get_db()
    ticket = row_to_dict(db.execute("""
        SELECT t.*, tm.name as team_name, a.name as agent_name
        FROM tickets t
        LEFT JOIN teams tm ON t.team_id = tm.id
        LEFT JOIN agents a ON t.agent_id = a.id
        WHERE t.id = ?
    """, (ticket_id,)).fetchone())
    if not ticket:
        raise HTTPException(404, "Ticket not found")
    db.close()
    return ticket


@router.patch("/tickets/{ticket_id}")
def update_ticket(ticket_id: int, data: TicketUpdate):
    db = get_db()
    ticket = row_to_dict(db.execute("SELECT * FROM tickets WHERE id=?", (ticket_id,)).fetchone())
    if not ticket:
        raise HTTPException(404, "Ticket not found")

    updates = {}
    if data.subject:    updates["subject"]     = data.subject
    if data.status:     updates["status"]      = data.status
    if data.priority:   updates["priority"]    = data.priority
    if data.team_id:    updates["team_id"]     = data.team_id
    if data.agent_id:   updates["agent_id"]    = data.agent_id
    if data.description:updates["description"] = data.description
    updates["updated_at"] = datetime.now(timezone.utc).isoformat()

    if data.status == "Resolved":
        updates["resolved_at"] = datetime.now(timezone.utc).isoformat()
        sla_due = ticket.get("sla_due_at")
        if sla_due:
            updates["sla_met"] = 1 if updates["resolved_at"] <= sla_due else 0

    if updates:
        set_clause = ", ".join(f"{k}=?" for k in updates)
        db.execute(f"UPDATE tickets SET {set_clause} WHERE id=?", list(updates.values()) + [ticket_id])
        db.commit()

    ticket = row_to_dict(db.execute("""
        SELECT t.*, tm.name as team_name, a.name as agent_name
        FROM tickets t LEFT JOIN teams tm ON t.team_id = tm.id
        LEFT JOIN agents a ON t.agent_id = a.id WHERE t.id=?
    """, (ticket_id,)).fetchone())
    db.close()
    return ticket


@router.delete("/tickets/{ticket_id}", status_code=204)
def delete_ticket(ticket_id: int):
    db = get_db()
    ticket = db.execute("SELECT * FROM tickets WHERE id=?", (ticket_id,)).fetchone()
    if not ticket:
        raise HTTPException(404, "Ticket not found")
    db.execute("DELETE FROM tickets WHERE id=?", (ticket_id,))
    db.commit()
    db.close()


# ── Summary (for ServicePulse sync) ───────────────────────

@router.get("/summary")
def get_summary():
    """ServicePulse calls this endpoint to sync data."""
    db = get_db()
    total     = db.execute("SELECT COUNT(*) FROM tickets").fetchone()[0]
    resolved  = db.execute("SELECT COUNT(*) FROM tickets WHERE status='Resolved'").fetchone()[0]
    open_t    = db.execute("SELECT COUNT(*) FROM tickets WHERE status='Open'").fetchone()[0]
    inprog    = db.execute("SELECT COUNT(*) FROM tickets WHERE status='In Progress'").fetchone()[0]
    breaches  = db.execute("SELECT COUNT(*) FROM tickets WHERE status='SLA Breach'").fetchone()[0]

    teams = rows_to_list(db.execute("SELECT * FROM teams").fetchall())
    team_summary = []
    for team in teams:
        open_count = db.execute(
            "SELECT COUNT(*) FROM tickets WHERE team_id=? AND status NOT IN ('Resolved','Closed')", (team["id"],)
        ).fetchone()[0]
        resolved_count = db.execute(
            "SELECT COUNT(*) FROM tickets WHERE team_id=? AND status='Resolved'", (team["id"],)
        ).fetchone()[0]
        team_summary.append({
            "team_id": team["id"],
            "team_name": team["name"],
            "open": open_count,
            "resolved": resolved_count,
        })

    recent = rows_to_list(db.execute("""
        SELECT t.*, tm.name as team_name, a.name as agent_name
        FROM tickets t
        LEFT JOIN teams tm ON t.team_id = tm.id
        LEFT JOIN agents a ON t.agent_id = a.id
        ORDER BY t.created_at DESC LIMIT 10
    """).fetchall())

    db.close()
    return {
        "source": "TicketFlow",
        "synced_at": datetime.now(timezone.utc).isoformat(),
        "kpis": {
            "total_tickets": total,
            "resolved": resolved,
            "open_tickets": open_t,
            "in_progress": inprog,
            "active_breaches": breaches,
            "resolution_rate": round(resolved / total * 100, 1) if total else 0,
        },
        "teams": team_summary,
        "recent_tickets": recent
    }


# ── Sync endpoint (ServicePulse pulls from here) ──────────

@router.get("/sync")
def sync_data(since: Optional[str] = Query(None)):
    """Returns all tickets created/updated since a given timestamp."""
    db = get_db()
    if since:
        tickets = rows_to_list(db.execute("""
            SELECT t.*, tm.name as team_name, a.name as agent_name
            FROM tickets t
            LEFT JOIN teams tm ON t.team_id = tm.id
            LEFT JOIN agents a ON t.agent_id = a.id
            WHERE t.updated_at >= ?
            ORDER BY t.updated_at DESC
        """, (since,)).fetchall())
    else:
        tickets = rows_to_list(db.execute("""
            SELECT t.*, tm.name as team_name, a.name as agent_name
            FROM tickets t
            LEFT JOIN teams tm ON t.team_id = tm.id
            LEFT JOIN agents a ON t.agent_id = a.id
            ORDER BY t.created_at DESC
        """).fetchall())

    db.close()
    return {
        "source": "TicketFlow",
        "synced_at": datetime.now(timezone.utc).isoformat(),
        "count": len(tickets),
        "tickets": tickets
    }
