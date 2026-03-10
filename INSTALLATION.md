# Installation af KiloGris

## 1) Kør appen lokalt

```bash
cd "/Users/jaquelin/Documents/Øvelser/Små brugbare programmer/KiloGris"
python3 -m http.server 5173
```

Åbn derefter:
- På Mac: `http://127.0.0.1:5173`
- På iPhone/iPad (samme Wi-Fi): `http://<din-mac-ip>:5173`

Find din Mac-IP med:

```bash
ipconfig getifaddr en0
```

## 2) Tilføj til hjemmeskærm (iPhone/iPad)

1. Åbn appen i Safari.
2. Tryk Del-ikonet.
3. Vælg **Føj til hjemmeskærm**.
4. Bekræft navnet **KiloGris**.

## 3) Opdateringer

- Efter kodeændringer: genindlæs siden i Safari og luk/åbn hjemmeskærms-appen.
- Service worker er aktiveret for hurtigere opstart og offline cache.
