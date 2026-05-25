"""
database.py — PostgreSQL + SQLite database setup for TicketFlow
"""
import os
import logging

logger = logging.getLogger(__name__)

DATABASE_URL = os.environ.get("DATABASE_URL", "")

# Check if PostgreSQL or SQLite
USE_POSTGRES = DATABASE_URL.startswith("postgresql")

if USE_POSTGRES:
    import psycopg2
    import psycopg2.extras

    def get_db():
        conn = psycopg2.connect(DATABASE_URL)
        conn.autocommit = False
        return conn

    def dict_cursor(conn):
        return conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

else:
    import sqlite3
    DB_PATH = os.path.join(os.path.dirname(__file__), "ticketflow.db")

    def get_db():
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA foreign_keys = ON")
        return conn

    def dict_cursor(conn):
        return conn.cursor()


def rows_to_list(cursor):
    rows = cursor.fetchall()
    return [dict(r) for r in rows]


def row_to_dict(cursor):
    row = cursor.fetchone()
    return dict(row) if row else None


def init_db():
    conn = get_db()
    cur = dict_cursor(conn)

    if USE_POSTGRES:
        # PostgreSQL syntax
        cur.execute("""
            CREATE TABLE IF NOT EXISTS teams (
                id SERIAL PRIMARY KEY,
                name TEXT NOT NULL UNIQUE,
                description TEXT,
                email TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        cur.execute("""
            CREATE TABLE IF NOT EXISTS agents (
                id SERIAL PRIMARY KEY,
                name TEXT NOT NULL,
                email TEXT UNIQUE,
                role TEXT,
                team_id INTEGER REFERENCES teams(id),
                is_active INTEGER DEFAULT 1,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        cur.execute("""
            CREATE TABLE IF NOT EXISTS tickets (
                id SERIAL PRIMARY KEY,
                ticket_number TEXT UNIQUE NOT NULL,
                subject TEXT NOT NULL,
                description TEXT,
                category TEXT,
                priority TEXT DEFAULT 'Medium',
                status TEXT DEFAULT 'Open',
                ticket_type TEXT DEFAULT 'Incident',
                team_id INTEGER REFERENCES teams(id),
                agent_id INTEGER REFERENCES agents(id),
                reporter_name TEXT,
                reporter_email TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                resolved_at TIMESTAMP,
                sla_due_at TIMESTAMP,
                sla_met INTEGER,
                tags TEXT DEFAULT '[]'
            )
        """)
    else:
        # SQLite syntax
        cur.execute("""
            CREATE TABLE IF NOT EXISTS teams (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL UNIQUE,
                description TEXT,
                email TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        """)
        cur.execute("""
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
        cur.execute("""
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

    # Check if teams table is empty
    cur.execute("SELECT COUNT(*) as count FROM teams")
    count = dict(cur.fetchone())['count']
    if count == 0:
        logger.info("Database is empty — ready for fresh data")

    cur.close()
    conn.close()