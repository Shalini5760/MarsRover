import os
import sqlite3
from datetime import datetime

from flask import Flask, jsonify, render_template, request

app = Flask(__name__)

DATABASE = "mission_mars.db"


def get_db():
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_db()

    conn.execute("""
        CREATE TABLE IF NOT EXISTS scores (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            player_name TEXT NOT NULL,
            score INTEGER NOT NULL,
            mission INTEGER NOT NULL,
            samples INTEGER NOT NULL,
            time_taken INTEGER NOT NULL,
            created_at TEXT NOT NULL
        )
    """)

    conn.commit()
    conn.close()


@app.route("/")
def home():
    return render_template("index.html")


@app.route("/api/save-score", methods=["POST"])
def save_score():
    data = request.get_json()

    player_name = data.get("player_name", "Anonymous")
    score = int(data.get("score", 0))
    mission = int(data.get("mission", 1))
    samples = int(data.get("samples", 0))
    time_taken = int(data.get("time_taken", 0))

    conn = get_db()

    conn.execute("""
        INSERT INTO scores
        (player_name, score, mission, samples, time_taken, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
    """, (
        player_name,
        score,
        mission,
        samples,
        time_taken,
        datetime.now().isoformat()
    ))

    conn.commit()
    conn.close()

    return jsonify({
        "success": True,
        "message": "Score saved successfully"
    })


@app.route("/api/leaderboard")
def leaderboard():
    conn = get_db()

    rows = conn.execute("""
        SELECT player_name, score, mission, samples, time_taken
        FROM scores
        ORDER BY score DESC
        LIMIT 10
    """).fetchall()

    conn.close()

    return jsonify([dict(row) for row in rows])


init_db()


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 5000)), debug=False)