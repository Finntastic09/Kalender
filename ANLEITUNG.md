# BhP Terminkalender – Raspberry Pi Setup-Anleitung

## Projektstruktur

```
bhp_kalender/
├── index.html              ← Hauptseite (HTML-Struktur)
├── style.css               ← Design & Layout
├── app.js                  ← Kalender-Logik (JavaScript)
├── server.py               ← Python-Webserver (Flask)
├── bhp-kalender.service    ← Systemd-Autostart-Datei
└── data/                   ← wird automatisch erstellt
    ├── termine.json        ← gespeicherte Termine
    └── settings.json       ← gespeicherte Einstellungen
```

---

## Schritt 1 – Dateien auf den Raspberry Pi übertragen

### Option A: Per USB-Stick
Kopiere den ganzen Ordner `bhp_kalender/` auf einen USB-Stick,
stecke ihn am Pi ein und kopiere ihn ins Home-Verzeichnis:

```bash
cp -r /media/pi/DEIN_STICK/bhp_kalender /home/pi/bhp_kalender
```

### Option B: Per SCP (von einem anderen PC im Netzwerk)
```bash
scp -r bhp_kalender/ pi@RASPBERRY-IP:/home/pi/
```

---

## Schritt 2 – Flask installieren

```bash
# System aktualisieren
sudo apt update && sudo apt upgrade -y

# Flask installieren
pip3 install flask

# Prüfen ob Flask vorhanden ist
python3 -c "import flask; print('Flask OK:', flask.__version__)"
```

---

## Schritt 3 – Server manuell testen

```bash
# In den Projektordner wechseln
cd /home/pi/bhp_kalender

# Server starten
python3 server.py
```

Jetzt im Browser auf dem Raspberry Pi (oder einem anderen Gerät im Netzwerk) aufrufen:

```
http://localhost:5000          ← auf dem Pi selbst
http://RASPBERRY-IP:5000       ← von einem anderen Gerät
```

IP des Pi herausfinden:
```bash
hostname -I
```

Mit **Ctrl+C** den Server wieder stoppen.

---

## Schritt 4 – Autostart beim Booten einrichten (systemd)

```bash
# Service-Datei kopieren
sudo cp /home/pi/bhp_kalender/bhp-kalender.service /etc/systemd/system/

# Datei öffnen und Pfade prüfen/anpassen (falls nötig)
sudo nano /etc/systemd/system/bhp-kalender.service

# systemd neu laden
sudo systemctl daemon-reload

# Service aktivieren (startet bei jedem Boot automatisch)
sudo systemctl enable bhp-kalender

# Service jetzt sofort starten
sudo systemctl start bhp-kalender

# Status prüfen
sudo systemctl status bhp-kalender
```

Erwartete Ausgabe bei `status`:
```
● bhp-kalender.service – BhP Terminkalender Server
   Active: active (running) ...
```

---

## Schritt 5 – Browser beim Start automatisch öffnen (optional)

Damit der Browser nach dem Booten automatisch den Kalender im Vollbild öffnet:

```bash
# Autostart-Datei öffnen
mkdir -p /home/pi/.config/autostart
nano /home/pi/.config/autostart/bhp-kalender.desktop
```

Inhalt einfügen:
```ini
[Desktop Entry]
Type=Application
Name=BhP Kalender
Exec=bash -c "sleep 5 && chromium-browser --kiosk --noerrdialogs --disable-infobars http://localhost:5000"
X-GNOME-Autostart-enabled=true
```

`sleep 5` gibt dem Server Zeit zu starten, bevor der Browser sich öffnet.

---

## Nützliche Befehle

```bash
# Server-Log live anschauen
sudo journalctl -u bhp-kalender -f

# Service neu starten (z.B. nach Dateiänderung)
sudo systemctl restart bhp-kalender

# Service stoppen
sudo systemctl stop bhp-kalender

# Service deaktivieren (kein Autostart mehr)
sudo systemctl disable bhp-kalender
```

---

## Datenspeicherung

Alle Daten liegen im Ordner `bhp_kalender/data/`:

| Datei              | Inhalt                        |
|--------------------|-------------------------------|
| `termine.json`     | Alle eingetragenen Termine     |
| `settings.json`    | Theme, Schriftgröße, Ansicht  |

Die Dateien werden automatisch erstellt beim ersten Speichern.
Ein **Backup** ist einfach: Ordner `data/` kopieren – fertig.

---

## Troubleshooting

**Port 5000 bereits belegt:**
```bash
sudo lsof -i :5000
# Prozess-ID (PID) aus der Ausgabe nehmen und beenden:
sudo kill -9 PROZESS-ID
```

**Flask nicht gefunden:**
```bash
sudo pip3 install flask
# oder mit pip direkt:
python3 -m pip install flask
```

**Keine Verbindung von anderem Gerät:**
```bash
# Firewall prüfen
sudo ufw status
# Falls aktiv: Port 5000 freigeben
sudo ufw allow 5000
```
