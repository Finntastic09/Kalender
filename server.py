#!/usr/bin/env python3
"""
BhP Terminkalender – Raspberry Pi Server
Speichert Termine und Einstellungen lokal als JSON-Dateien.
Start: python3 server.py
Aufruf im Browser: http://localhost:5000
"""

import json
import os
from flask import Flask, send_from_directory, request, jsonify

# ── Pfade ────────────────────────────────────────────────
BASE_DIR    = os.path.dirname(os.path.abspath(__file__))
DATA_DIR    = os.path.join(BASE_DIR, 'data')
TERMINE_F   = os.path.join(DATA_DIR, 'termine.json')
SETTINGS_F  = os.path.join(DATA_DIR, 'settings.json')

# Datenordner anlegen falls nicht vorhanden
os.makedirs(DATA_DIR, exist_ok=True)

# ── Flask App ─────────────────────────────────────────────
app = Flask(__name__, static_folder=BASE_DIR)

# ── Hilfsfunktionen ──────────────────────────────────────
def read_json(path, default):
    try:
        with open(path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return default

def write_json(path, data):
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

# ── Statische Dateien ─────────────────────────────────────
@app.route('/')
def index():
    return send_from_directory(BASE_DIR, 'index.html')

@app.route('/style.css')
def css():
    return send_from_directory(BASE_DIR, 'style.css')

@app.route('/app.js')
def js():
    return send_from_directory(BASE_DIR, 'app.js')

# ── API: Termine ──────────────────────────────────────────
@app.route('/api/termine', methods=['GET'])
def get_termine():
    return jsonify(read_json(TERMINE_F, []))

@app.route('/api/termine', methods=['POST'])
def save_termine():
    data = request.get_json(force=True, silent=True)
    if data is None:
        return jsonify({'error': 'Ungültige Daten'}), 400
    write_json(TERMINE_F, data)
    return jsonify({'ok': True})

# ── API: Einstellungen ────────────────────────────────────
@app.route('/api/settings', methods=['GET'])
def get_settings():
    return jsonify(read_json(SETTINGS_F, {}))

@app.route('/api/settings', methods=['POST'])
def save_settings():
    data = request.get_json(force=True, silent=True)
    if data is None:
        return jsonify({'error': 'Ungültige Daten'}), 400
    write_json(SETTINGS_F, data)
    return jsonify({'ok': True})

# ── Start ─────────────────────────────────────────────────
if __name__ == '__main__':
    print("╔══════════════════════════════════════════╗")
    print("║   BhP Terminkalender – Server gestartet  ║")
    print("╠══════════════════════════════════════════╣")
    print("║  http://localhost:5000                   ║")
    print("║  Daten:  ./data/termine.json             ║")
    print("║          ./data/settings.json            ║")
    print("║  Stopp:  Ctrl+C                          ║")
    print("╚══════════════════════════════════════════╝")
    app.run(host='0.0.0.0', port=5000, debug=False)
