# Firebase Realtime Listeners Setup

## Vorteile gegenüber Polling

- ✅ **Instant Updates** - Änderungen werden sofort gepusht (< 1 Sekunde)
- ✅ **Effizient** - Keine unnötigen HTTP-Requests alle 30-60 Sekunden
- ✅ **Bandbreite** - Nur bei tatsächlichen Änderungen wird Daten übertragen
- ✅ **Skalierbar** - Firebase Firestore managed Connections automatisch
- ✅ **Funktioniert für**: Trading Page (City Matrix, Base Price) & Dashboard (Player Data)

## Setup

### 1. Firebase SDK in HTML einbinden

Füge diese Scripts **vor** den anderen JavaScript-Dateien in `trading.html` und `dashboard.html` ein:

```html
<!-- Firebase SDK -->
<script src="https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore-compat.js"></script>

<!-- Firebase Realtime Service -->
<script src="js/firebase-realtime.js"></script>

<!-- Dann die bestehenden Scripts -->
<script src="js/backend-service.js"></script>
<script src="js/common.js"></script>
<script src="js/trading.js"></script>
```

### 2. Firebase Config anpassen

In `web/js/firebase-realtime.js` Zeile 22-25:

```javascript
const firebaseConfig = {
    projectId: 'tsdgems-trading',  // Ihr Firebase Project ID
    databaseURL: 'https://tsdgems-trading.firebaseio.com'
};
```

### 3. Firestore Database Name

Zeile 32 in `firebase-realtime.js`:

```javascript
this.db = firebase.app().firestore('tsdgems');  // Ihr Database Name
```

## Wie es funktioniert

### Ohne Realtime (Polling):
```
Trading Page:
Frontend ─┬─> Request ─> Backend ─> Firestore (alle 60s)
          ├─> Request ─> Backend ─> Firestore (alle 60s)
          └─> Request ─> Backend ─> Firestore (alle 60s)

Dashboard:
Frontend ─┬─> Request ─> Backend ─> Firestore (alle 30s)
          ├─> Request ─> Backend ─> Firestore (alle 30s)
          └─> Request ─> Backend ─> Firestore (alle 30s)
```

### Mit Realtime (Listeners):
```
Frontend ─────────────> Firestore
         <─────────────  (instant push bei Änderung)
         WebSocket Connection (persistent)
         
Listeners aktiv für:
- City Boosts (Trading)
- Base Price (Trading + Dashboard)
- Player Data (Dashboard)
```

## Automatisches Fallback

Die Implementation hat ein intelligentes Fallback:

1. **Versucht zuerst** Firestore Realtime Listeners zu verwenden
2. **Falls Firebase nicht verfügbar**: Fällt automatisch auf Polling zurück
3. **Keine Code-Änderungen nötig** - funktioniert in beiden Modi

## Monitoring

Öffne die Browser Console um zu sehen, welcher Modus aktiv ist:

**Realtime aktiv (Trading Page):**
```
[Trading] ✅ Realtime listeners active - instant updates enabled!
[Trading] 🔥 Base price updated in realtime!
[Trading] 🔥 City matrix updated in realtime!
```

**Realtime aktiv (Dashboard):**
```
[Dashboard] ✅ Realtime listeners active - instant updates enabled!
[Dashboard] 🔥 Dashboard data updated in realtime!
```

**Polling Fallback:**
```
[Trading] ⏱️ Polling started (60s interval) - realtime not available
[Dashboard] ⏱️ Setting up polling (30s interval)...
```

## Firestore Security Rules

Stelle sicher, dass die Firestore Rules lesend Zugriff erlauben:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/tsdgems/documents {
    // Allow read access to base price (global)
    match /game_config/base_price {
      allow read: if true;
    }
    
    // Allow read access to cities config (global)
    match /game_config/cities {
      allow read: if true;
    }
    
    // Allow read access to city boosts (global)
    match /city_boosts/{cityId} {
      allow read: if true;
    }
    
    // Allow read access to player's own data
    match /players/{actor} {
      allow read: if true;  // Or: if request.auth.uid == actor
    }
  }
}
```

## Testen

### Trading Page:
1. Öffne Trading-Seite
2. Öffne Browser Console
3. Führe Backend-Update aus (z.B. `updateBonusesNow` oder ändere Base Price)
4. UI sollte **sofort** ohne Neuladen aktualisieren

### Dashboard:
1. Öffne Dashboard
2. Verbinde Wallet
3. Öffne Browser Console
4. Ändere Player-Daten im Backend (z.B. füge Gems hinzu)
5. Dashboard sollte **sofort** aktualisieren

## Bandbreite-Vergleich

### Trading Page:
**Polling (60s):**
- 2 Requests/Minute = 2880 Requests/Tag
- ~1MB/Tag (bei 0.35KB pro Request)

**Realtime:**
- WebSocket: 1 Connection (persistent)
- Updates: Nur bei tatsächlichen Änderungen (~24/Tag)
- ~10KB/Tag

**Ersparnis: ~99% weniger Requests!**

### Dashboard:
**Polling (30s):**
- 2 Requests/Minute = 2880 Requests/Tag
- ~1.5MB/Tag (bei 0.5KB pro Request)

**Realtime:**
- WebSocket: 1 Connection (persistent)
- Updates: Nur bei Spieleraktionen
- ~5KB/Tag

**Ersparnis: ~99.7% weniger Requests!**

## Implementierte Features

### Trading Page (`web/js/trading.js`):
- ✅ Realtime City Boosts Updates
- ✅ Realtime Base Price Updates
- ✅ Automatisches Fallback auf Polling
- ✅ Cleanup bei Page Unload

### Dashboard (`web/js/dashboard.js`):
- ✅ Realtime Player Data Updates
- ✅ Realtime Base Price Updates
- ✅ Automatisches Fallback auf Polling
- ✅ Cleanup bei Page Unload
- ✅ Pause/Resume bei Tab-Wechsel

### Firebase Realtime Service (`web/js/firebase-realtime.js`):
- ✅ `listenToBasePrice()` - Base Price Listener
- ✅ `listenToCityBoosts()` - City Boosts Listener
- ✅ `listenToCities()` - Cities Config Listener
- ✅ `listenToCityMatrix()` - Combined Listener
- ✅ `listenToPlayer(actor)` - Player Data Listener
- ✅ `listenToDashboard(actor)` - Combined Dashboard Listener
- ✅ Automatic cleanup management

