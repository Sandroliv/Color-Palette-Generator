# Tools

Hier findest du Infos, was du allenfalls beachten musst, dass die verschiedenen Tools mit deiner Shell funktionieren.

## Tools Konfigurieren

Mit der Datei `config.json` können einzelne Tools aktiviert oder deaktiviert werden.

### Format

```json
{
  "read_file": true,
  "list_files": true,
  "bash": false,
  "edit_file": true,
  "code_search": true,
  "play_mp3": false,
  "subagent": true
}
```

Das bash und das play_mp3 Tool sind Standardmässig ausgeschaltet. Setze ein Tool auf `true` um es zu aktivieren und auf `false` um es zu deaktivieren. Der Agent erhält dann keinen Zugriff mehr auf dieses Tool. Die Schlüssel entsprechen dem `name`-Feld in der jeweiligen Tool-Definition (z. B. `tool.function.name`). Nach Änderungen ist ein **Neustart des Agents** erforderlich.



Die Tools bash, code_search und play_mp3, benötigen allenfalls weitergehende Konfiguration


### Bash
Bei Windows könnt ihr einstellen, was für eine Shell benutzt werden soll (cmd, powershell, etc.).
In `tools/bash.js` auf Zeile 12:
```javascript
// Windows mit cmd
const shellArgs = isWindows
  ? ["cmd", "/c", input.command]
  : ["bash", "-c", input.command];
// Windows mit powershell
const shellArgs = isWindows
  ? ["powershell", "/c", input.command]
  : ["bash", "-c", input.command];
```
Je nach Shell hat dein Agent Zugang zu unterschiedlichen Befehlen/Kommandos (dir, cat, more, type, rg, etc.).
Teste in der entsprechenden Shell ob die Befehle, die dein Agent für die Aufgabe benötigt vorhanden sind.


## Code Search
Das Tool code_search benötigt den Shell Befehl rg (ripgrep). Falls deine Shell den Befehl noch nicht kennt, installiere ihn, alternativ kannst du in code_search auch grep -r statt rg verwenden (siehe diff-grep-rg (#)):
- Linux: ```sudo apt install ripgrep```
- Mac: ```brew install ripgrep```
- Windows: ```winget install -e --id BurntSushi.ripgrep.MSVC```

### Play MP3
Das Tool `play_mp3` (`tools/play_mp3.js`) spielt MP3-Dateien auf dem Server ab und verwendet dafür den Kommandozeilen-Player `mpg123`. Dieser muss auf dem System installiert sein.

#### Installation von mpg123
- Linux: ```sudo apt install mpg123```
- Mac: ```brew install mpg123```
- Windows: ```winget install -e --id mpg123.mpg123```

#### Verwendung
Der Agent kann das Tool aufrufen, um eine MP3-Datei abzuspielen. Es wird ein `path`-Parameter erwartet, der den relativen oder absoluten Pfad zur MP3-Datei angibt.


---

# Blocklist-System

Sicherheitsmechanismus, der verhindert, dass der KI-Agent über seine Tools auf
sensible Dateien zugreift.

## Wie es funktioniert

Die Datei `blocklist-files.json` enthält eine Liste von Dateinamen und
Endungen, die als sensibel gelten. Das gemeinsame Modul `blocklist.js` lädt
diese Liste und stellt Hilfsfunktionen bereit, die von den einzelnen Tools
verwendet werden.

### Abgleichregeln

Eine Datei wird blockiert, wenn **eine** der folgenden Bedingungen zutrifft:

- Ihr **Basename** stimmt exakt mit einem Blocklist-Eintrag überein
  (z. B. `passwords.txt` blockiert `notes/passwords.txt`)
- Ihr **Pfad endet mit** einem Blocklist-Eintrag
  (z. B. `.pem` blockiert `certs/server.pem`, `.docker/config.json` blockiert
  `home/.docker/config.json`)

### Durchsetzung pro Tool

| Tool          | Verhalten                                                          |
|---------------|--------------------------------------------------------------------|
| `read_file`   | Wirft einen Fehler, bevor die Datei gelesen wird                   |
| `edit_file`   | Wirft einen Fehler, bevor die Datei bearbeitet oder erstellt wird  |
| `list_files`  | Lässt blockierte Dateien stillschweigend aus der Auflistung weg    |
| `code_search` | Lässt Suchergebniszeilen aus blockierten Dateien stillschweigend weg |
| `bash`        | **Nicht geschützt** — führt Befehle ohne Einschränkung aus         |

### Fehlermeldung

Wenn ein Tool den Zugriff blockiert, gibt es folgende Meldung zurück:

```
Access denied: '<Dateiname>' is blocked by security policy
```

## Neue Einträge hinzufügen

Bearbeite `blocklist-files.json` und füge Einträge zum Array `blocklistFiles`
hinzu.

- Um einen bestimmten Dateinamen zu blockieren: Trage den exakten Namen ein (z. B. `"my-secrets.json"`)
- Um eine Dateiendung zu blockieren: Trage die Endung mit dem Punkt ein (z. B. `".pfx"`)
- Um ein Unterpfad-Muster zu blockieren: Trage das Pfad-Suffix ein (z. B. `".docker/config.json"`)

Nach Änderungen ist ein Neustart des Servers erforderlich.

## Einschränkungen

- Das `bash`-Tool ist **nicht geschützt**. Befehle wie `cat .env` funktionieren
  weiterhin. Das ist beabsichtigt — das Bash-Tool ist grundsätzlich
  uneingeschränkt und einfacher String-Abgleich lässt sich leicht umgehen.
- Der Abgleich basiert ausschliesslich auf Pfad-Suffixen und Basenamen.
  Symlinks, Hardlinks oder indirekte Dateireferenzen werden nicht aufgelöst.

## Zukünftige Arbeit

`blocklist-words.json` enthält Muster für sensible Schlüsselwörter zur
Inhaltsebene-Prüfung (z. B. Erkennung von API-Schlüsseln, Passwörtern,
Verbindungszeichenfolgen in Dateiinhalten). Dies ist **noch nicht implementiert**.
