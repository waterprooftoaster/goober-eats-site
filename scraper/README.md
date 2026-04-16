# Goober Eats — Grubhub Campus Scraper

Captures menu data from the Grubhub Campus mobile app via HTTPS interception
(mitmproxy + Android emulator), then transforms it into Goober Eats schema JSON.

**This is a manual, one-time tool.** No credentials are automated, no data is
written to the database. Output is JSON files for human review before import.

## Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| Python | 3.11+ | |
| Android Studio | Latest | Includes AVD Manager + emulator |
| Android system image | **API 33** (Android 13) | Use "Google APIs" — **NOT** "Google Play" (locked system partition) |
| mitmproxy | 10+ | `pip install mitmproxy` or via this project |
| adb | Latest | Included with Android Studio (`platform-tools/`) |
| openssl | Any | For cert hash computation |

> **Why API 33?** Android 14 (API 34+) moved system CA certs to APEX modules,
> making the traditional `/system/etc/security/cacerts/` injection unreliable.

## Setup

### 1. Install Python dependencies

```bash
cd scraper/
python -m venv .venv
source .venv/bin/activate
pip install -e .
```

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env and set SCHOOL_ID to the UUID of the target school in Goober Eats
```

### 3. Create the AVD

In Android Studio → Device Manager → Create Virtual Device:

- Device: any phone (e.g., Pixel 7)
- System image: **API 33, Google APIs** (not Google Play)
- Finish

### 4. Generate mitmproxy certificate

Run mitmproxy once to generate its CA certificate, then exit:

```bash
mitmdump --mode regular@8080
# Wait for "Proxy server listening" message, then Ctrl-C
```

This creates `~/.mitmproxy/mitmproxy-ca-cert.cer`.

### 5. Install certificate in AVD

Start the emulator with a writable system partition:

```bash
emulator -avd <avd-name> -writable-system
```

In a separate terminal, run the cert installer:

```bash
bash setup/install-cert.sh
```

The script will:
1. Compute the OpenSSL hash for the cert filename
2. Disable verified boot, reboot
3. Remount `/system` as writable
4. Push the cert to `/system/etc/security/cacerts/`
5. Reboot to finalize

**Verify:** On the emulator, go to Settings → Security → Encryption & credentials →
Trusted credentials → System tab — look for a "mitmproxy" entry.

> **Tip:** Snapshot the AVD after cert installation so you don't repeat this step.

### 6. Install Grubhub Campus APK

Download the Grubhub Campus Dining APK and sideload it:

```bash
adb install grubhub-campus-dining.apk
```

## Capture Workflow

### 1. Start the proxy

```bash
mitmdump --mode regular@8080 -s src/addon.py
```

### 2. Start the emulator with proxy

```bash
emulator -avd <avd-name> -writable-system -http-proxy http://127.0.0.1:8080
```

Or set the proxy on a running emulator:

```bash
adb shell settings put global http_proxy 127.0.0.1:8080
```

### 3. Browse the app

1. Open Grubhub Campus Dining on the emulator
2. Log in manually with your campus credentials
3. Browse restaurants and their menus — the addon captures automatically
4. Navigate through all the restaurants you want to scrape

The addon captures all JSON responses from `*.grubhub.com` and saves them
to `data/raw/` as enveloped JSON files.

### 4. Stop

Press Ctrl-C in the mitmdump terminal. The addon logs a capture summary.

## Parse Workflow

### 1. Discover the API shape

Since the Grubhub Campus API is undocumented, inspect what was captured:

```bash
python -m src.parse --discover
```

This prints the key/type structure of every raw file, helping you identify
which endpoints contain restaurant listings, menus, and item details.

### 2. Update field mappings

Edit the extraction functions in `src/parse.py` (`_extract_eatery`,
`_extract_menu_items`, etc.) to match the actual Grubhub response
structure you observed in step 1. The placeholder mappings look for
common Grubhub-style keys but will likely need adjustment.

### 3. Transform

```bash
python -m src.parse
```

If Grubhub returns prices in dollars instead of cents:

```bash
python -m src.parse --price-unit dollars
```

Output lands in `data/parsed/` as one JSON file per eatery.

## Output Format

Each file in `data/parsed/` matches the Goober Eats seed data shape
(see `scripts/seed.ts`):

```json
{
  "eatery": {
    "school_id": "uuid-from-env",
    "name": "Palladium Dining",
    "address": "140 E 14th St, New York, NY 10003",
    "image_url": "https://...",
    "is_active": true,
    "latitude": 40.7339,
    "longitude": -73.9893
  },
  "groups": ["Entrees", "Sides", "Drinks"],
  "menu_items": [
    {
      "name": "Grilled Chicken",
      "group": "Entrees",
      "original_price_cents": 1200,
      "market_price_cents": null,
      "image_url": "https://...",
      "option_groups": [
        {
          "name": "Side Choice",
          "selection_type": "single",
          "is_required": true,
          "sort_order": 0,
          "options": [
            {
              "name": "Rice",
              "additional_price_cents": 0,
              "is_default": true,
              "sort_order": 0
            }
          ]
        }
      ]
    }
  ]
}
```

- `market_price_cents` is always `null` — set by Goober Eats operators after review
- `selection_type` is inferred from Grubhub's min/max choice fields
- `is_required` is inferred from `min_choices >= 1`

## Troubleshooting

### Certificate not trusted / SSL errors

- Verify the AVD uses API 33 with "Google APIs" (not "Google Play")
- Verify the emulator was started with `-writable-system`
- Re-run `setup/install-cert.sh`
- Check: Settings → Security → Trusted credentials → System → look for mitmproxy

### Certificate pinning

Grubhub may implement certificate pinning, causing SSL handshake failures even
with the system CA installed. Possible workarounds:

- Try an older version of the Grubhub Campus APK (pinning is sometimes absent)
- Use [Frida](https://frida.re/) with an SSL unpinning script (e.g., `frida-ssl-unpin`)

### No traffic captured

- Verify proxy is running: `curl -x http://127.0.0.1:8080 https://httpbin.org/get`
- Check emulator proxy: `adb shell settings get global http_proxy`
- If empty, set it: `adb shell settings put global http_proxy 127.0.0.1:8080`

### Parse finds no eatery data

- Run `--discover` and inspect the raw file structures
- Update the extraction functions in `src/parse.py` to match the actual keys
