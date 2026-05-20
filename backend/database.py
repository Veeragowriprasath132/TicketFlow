"""
database.py — SQLite database setup for TicketFlow
"""
import sqlite3
import os
from datetime import datetime, timezone, timedelta
import random

DB_PATH = os.path.join(os.path.dirname(__file__), "ticketflow.db")


def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db():
    conn = get_db()
    cursor = conn.cursor()

    # Teams table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS teams (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            description TEXT,
            email TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # Agents table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS agents (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT UNIQUE,
            role TEXT,
            team_id INTEGER,
            is_active INTEGER DEFAULT 1,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (team_id) REFERENCES teams(id)
        )
    """)

    # Tickets table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS tickets (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ticket_number TEXT UNIQUE NOT NULL,
            subject TEXT NOT NULL,
            description TEXT,
            category TEXT,
            priority TEXT DEFAULT 'Medium',
            status TEXT DEFAULT 'Open',
            ticket_type TEXT DEFAULT 'Incident',
            team_id INTEGER,
            agent_id INTEGER,
            reporter_name TEXT,
            reporter_email TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
            resolved_at TEXT,
            sla_due_at TEXT,
            sla_met INTEGER,
            tags TEXT DEFAULT '[]',
            FOREIGN KEY (team_id) REFERENCES teams(id),
            FOREIGN KEY (agent_id) REFERENCES agents(id)
        )
    """)

    conn.commit()

    # Seed if empty
    count = cursor.execute("SELECT COUNT(*) FROM teams").fetchone()[0]
    if count == 0:
        seed_data(conn)

    conn.close()


def seed_data(conn):
    cursor = conn.cursor()
    now = datetime.now(timezone.utc)

    # Teams
    teams = [
        ("Network Ops",     "LAN/WAN, VPN, Firewall",           "network@company.com"),
        ("Security",        "Cybersecurity, IAM, Compliance",    "security@company.com"),
        ("Hardware",        "Endpoints, Printers, Assets",       "hardware@company.com"),
        ("Software",        "Applications, Licenses, OS",        "software@company.com"),
        ("Infra & Servers", "Servers, VMware, Cloud",            "infra@company.com"),
        ("BI & Analytics",  "Power BI, Dashboards, Reporting",   "bi@company.com"),
        ("DB & Middleware",  "SQL, APIs, Middleware",             "db@company.com"),
    ]
    for name, desc, email in teams:
        cursor.execute("INSERT INTO teams (name, description, email) VALUES (?, ?, ?)", (name, desc, email))
    conn.commit()

    # Agents
    agents = [
        ("Ravi Kumar",      "ravi.kumar@company.com",    "Lead Engineer",      1),
        ("Arun Selvan",     "arun.selvan@company.com",   "Network Engineer",   1),
        ("Priya Singh",     "priya.singh@company.com",   "Security Lead",      2),
        ("Ganesh V",        "ganesh.v@company.com",      "Security Analyst",   2),
        ("Deepa Nair",      "deepa.nair@company.com",    "Hardware Lead",      3),
        ("Karthi M",        "karthi.m@company.com",      "Field Technician",   3),
        ("Karthik V",       "karthik.v@company.com",     "Software Lead",      4),
        ("Ramya D",         "ramya.d@company.com",       "App Support",        4),
        ("Suresh Babu",     "suresh.babu@company.com",   "Infra Lead",         5),
        ("Aarthi N",        "aarthi.n@company.com",      "Server Admin",       5),
        ("Anand Raj",       "anand.raj@company.com",     "BI Lead",            6),
        ("Eswari K",        "eswari.k@company.com",      "Data Analyst",       6),
        ("Meena Pillai",    "meena.pillai@company.com",  "DB Lead",            7),
        ("Naveen C",        "naveen.c@company.com",      "Database Admin",     7),
    ]
    for name, email, role, team_id in agents:
        cursor.execute("INSERT INTO agents (name, email, role, team_id) VALUES (?, ?, ?, ?)", (name, email, role, team_id))
    conn.commit()

    # Sample tickets
    sla_hours = {"Critical": 4, "High": 8, "Medium": 24, "Low": 72}
    tickets = [
        ("VPN connectivity failure in Block-C",         "Network",        "High",     "In Progress", 1, 1),
        ("Email server TLS certificate expiry",         "Security",       "High",     "Open",        2, 3),
        ("Power BI dashboard not loading",              "BI & Analytics", "Medium",   "In Progress", 6, 11),
        ("Laptop battery replacement request",          "Hardware",       "Low",      "Resolved",    3, 5),
        ("AD group policy not applying",                "Infrastructure", "Medium",   "Open",        5, 9),
        ("SQL query timeout in production",             "Database",       "High",     "In Progress", 7, 13),
        ("Antivirus definitions outdated",              "Security",       "Medium",   "Resolved",    2, 4),
        ("Office 365 activation failure",               "Software",       "Medium",   "Open",        4, 7),
        ("Cisco switch port down floor 2",              "Network",        "High",     "Resolved",    1, 2),
        ("Projector not detected in conf room",         "Hardware",       "Low",      "Resolved",    3, 6),
        ("Database replication lag exceeding threshold","Database",       "High",     "Open",        7, 14),
        ("Firewall rule blocking internal APIs",        "Network",        "High",     "Open",        1, 1),
        ("User account lockout in HR dept",             "Security",       "Medium",   "Resolved",    2, 3),
        ("VMware ESXi host health warnings",            "Infrastructure", "Medium",   "In Progress", 5, 10),
        ("Tableau license expiry alert",                "BI & Analytics", "Medium",   "Open",        6, 12),
    ]

    for i, (subject, category, priority, status, team_id, agent_id) in enumerate(tickets):
        ticket_number = f"TF-{1000 + i + 1}"
        created_at = (now - timedelta(days=random.randint(0, 7), hours=random.randint(0, 12))).isoformat()
        sla_due = (datetime.fromisoformat(created_at) + timedelta(hours=sla_hours[priority])).isoformat()
        resolved_at = None
        sla_met = None
        if status == "Resolved":
            resolved_at = (datetime.fromisoformat(created_at) + timedelta(hours=sla_hours[priority] * 0.7)).isoformat()
            sla_met = 1

        cursor.execute("""
            INSERT INTO tickets (ticket_number, subject, category, priority, status,
                team_id, agent_id, reporter_name, reporter_email,
                created_at, updated_at, sla_due_at, resolved_at, sla_met)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (ticket_number, subject, category, priority, status,
              team_id, agent_id, "System User", "user@company.com",
              created_at, created_at, sla_due, resolved_at, sla_met))

    conn.commit()
