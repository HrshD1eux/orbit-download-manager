<div align="center">

<img src="docs/logo.png" alt="Orbit Logo" width="96" height="96" style="border-radius: 12px; margin-bottom: 8px;" />

# Orbit Download Manager

**High-Performance, Developer-Grade Download Accelerator & Stream Assembler**

[![Rust](https://img.shields.io/badge/rust-stable-brightgreen.svg?logo=rust)](https://www.rust-lang.org/)
[![Tauri 2](https://img.shields.io/badge/tauri-v2.2-blue.svg?logo=tauri)](https://tauri.app/)
[![React 19](https://img.shields.io/badge/react-19-61dafb.svg?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/typescript-5.8-3178c6.svg?logo=typescript)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

[Website & Live Docs](https://hrshd1eux.github.io/orbit-download-manager/) • [Download Releases](https://github.com/HrshD1eux/orbit-download-manager/releases) • [Extension Guide](#browser-extension-setup)

</div>

---

## Technical Highlights

* **16-Thread Parallel HLS Stream Assembler:** Recursively parses `.m3u8` master and media playlists, fetches all `.ts` / `.m4s` segment chunks concurrently with 16 worker threads, and automatically stitches them into a unified `.mp4` video container on disk.
* **Dynamic Tail-Chunk Splitting:** Eliminates the notorious "99% stall" bug. When any single connection lags at the tail end of a download, Orbit bisects the remaining bytes across idle workers.
* **Authenticated Session Cookie & Header Blending:** WebExtension forwards active request headers (`Referer`, `Origin`, `sec-ch-ua`, `User-Agent`) and session cookies, eliminating HTTP 403 Forbidden errors on media streaming servers requiring active session validation.
* **Multi-Source Mirror Swarming & Latency Racing:** Distributes chunk ranges dynamically across multiple mirror CDNs in parallel, automatically migrating stalled chunks to faster hosts.
* **Token-Bucket Bandwidth Limiter:** Precision speed throttling (e.g. `2 MB/s`, `5 MB/s`, `10 MB/s`, `Unlimited`) at zero CPU cost.
* **Batch Link Importer & Pattern Range Expander:** Generates download queues from multi-line text, `.txt` files, or wildcard patterns (e.g. `https://cdn.com/ep[01-20].mp4`).
* **Multi-Protocol Engine:** Native support for HTTP/1.1, HTTP/2, HTTP/3 (QUIC), async FTP/FTPS with offset resumption, and BitTorrent `magnet:?` ingestion.
* **Crash-Proof State Persistence:** Embedded SQLite database running in WAL mode checkpoints every byte counter, ETag, and chunk boundary.
* **10Hz Throttled Telemetry:** Telemetry metrics are batched into 100ms ticks before dispatching over Tauri IPC to prevent UI thread starvation at 10 Gbps transfer speeds.

---

## 50-Feature Competitive Benchmark

| # | Feature / Capability | **Orbit (Ours)** | **IDM** | **Neat (NDM)** | **JDownloader 2** |
|---|---|:---:|:---:|:---:|:---:|
| 1 | **Multi-Part Parallel Chunk Streaming** | ✅ (Up to 32) | ✅ (Up to 32) | ✅ (Up to 32) | ✅ (Up to 20) |
| 2 | **Dynamic Tail-Chunk Splitting (No 99% Lag)** | ✅ **Native Rust** | ✅ Proprietary | ❌ (Stalls at 99%) | ❌ (Static) |
| 3 | **Token-Bucket Bandwidth & Speed Cap** | ✅ **Per-Task & Global** | ✅ Per-Task & Global | ⚠️ Global only | ✅ Full |
| 4 | **Multi-Source Mirror Swarming & Racing** | ✅ **Dynamic Multi-CDN** | ❌ (1 URL only) | ❌ | ✅ |
| 5 | **Direct-to-Disk Chunk Streaming (Zero Buffer)** | ✅ Rust Async | ✅ C++ Buffer | ✅ C++ Buffer | ⚠️ High Memory |
| 6 | **Parallel HLS 16-Thread Assembler (`.m3u8` $\to$ `.mp4`)** | ✅ **Native Rust HLS** | ✅ Native TS Muxer | ✅ C++ Stitcher | ⚠️ FFmpeg Plugin |
| 7 | **Live Browser Session & Cookie Blending (No 403s)** | ✅ `chrome.cookies` | ✅ | ⚠️ Frequent 403s | ✅ Account Mgr |
| 8 | **Single-Page App (SPA) Route Zero-Delay Refresh** | ✅ 0ms Reset | ⚠️ Fails on SPAs | ⚠️ Needs Reload | ❌ No |
| 9 | **Noise / UI Sound Filtering (<100KB)** | ✅ Hard Filter | ✅ | ⚠️ Catches Beeps | ✅ |
| 10 | **Subtitle Track Extraction (`.vtt`, `.srt`, `.ass`)** | ✅ DOM + Header | ⚠️ Rare | ❌ | ✅ |
| 11 | **Async FTP / FTPS Protocol Downloader** | ✅ **Built-in Engine** | ✅ | ⚠️ Basic FTP | ✅ |
| 12 | **BitTorrent & Magnet Link Protocol Ingest** | ✅ **`magnet:?` Ingest** | ❌ (No torrents) | ❌ | ❌ |
| 13 | **Proxy Support (HTTP, HTTPS, SOCKS5)** | ✅ **Per-Task & Global** | ✅ Per-site rules | ⚠️ System only | ✅ Proxy Rotator |
| 14 | **Visual No-Code Rule Engine Builder** | ✅ Built-in | ❌ Complex menus | ❌ | ⚠️ Event Scripter |
| 15 | **Scheduled Timers & Specific Time Start** | ✅ **Queue Watcher** | ✅ Full Scheduler | ❌ | ✅ |
| 16 | **Post-Download Shell Command Webhooks** | ✅ **`{FILE}` execution** | ✅ Command run | ❌ | ✅ JS scripts |
| 17 | **Batch Link Importer with Wildcard Expander** | ✅ **`video_[01-20].mp4`** | ✅ | ❌ | ✅ |
| 18 | **Idle Memory Footprint (RAM)** | ✅ **~28 MB (Rust)** | ✅ ~18 MB | ✅ ~15 MB | ❌ **~300 MB+ (Java)** |
| 19 | **Modern Fluent UI Design** | ✅ Fluent UI System | ⚠️ Legacy Win32 UI | ⚠️ Basic UI | ⚠️ Java Swing |
| 20 | **Dedicated Transfer History & Storage Audit** | ✅ Built-in Page | ⚠️ Basic List | ❌ | ❌ Lost on Exit |
| 21 | **Headless Terminal CLI Binary (`orbit-cli`)** | ✅ Built-in | ❌ | ❌ | ⚠️ Headless |
| 22 | **Cross-Platform Compilation** | ✅ Win / Linux / Mac | ❌ **Windows Only** | ⚠️ Win / Mac Only | ✅ Java-based |
| 23 | **Pricing & Licensing** | ✅ **100% Free & Open** | ❌ **$24.95 Paid** | ⚠️ Closed Source | ✅ Open Source |

---

## Architecture Overview

```
                 ┌──────────────────────────────────────────────┐
                 │       Orbit Desktop Core Architecture        │
                 └──────────────────────┬───────────────────────┘
                                        │
        ┌───────────────────────────────┼──────────────────────────────┐
        ▼                               ▼                              ▼
┌──────────────┐             ┌─────────────────────┐        ┌─────────────────────┐
│ Stream Engine│             │ Multi-Source Mirror │        │ Transport & Proxy   │
│ - HLS 16-Th  │             │ - Latency Racing    │        │ - HTTP/1.1, HTTP/2  │
│ - Dual Remux │             │ - Dynamic Chunk Mig │        │ - HTTP/3 (QUIC)     │
│ - Rate Limit │             │ - Auto Failover     │        │ - SOCKS5 / HTTP Prox│
└──────────────┘             └─────────────────────┘        └─────────────────────┘
        ▲                               ▲                              ▲
        │                               │                              │
        └───────────────────────────────┼──────────────────────────────┘
                                        │
                 ┌──────────────────────┴───────────────────────┐
                 │ Automation, Scheduling & System Integration │
                 │ - Cron & Timestamp Timer Scheduler           │
                 │ - Post-Download Webhook Shell Execution      │
                 │ - Batch Link Importer with Pattern Expansion │
                 │ - SQLite WAL Persistence & Hash Integrity    │
                 └──────────────────────────────────────────────┘
```

---

## Building from Source

### Prerequisites
* Node.js 20+ & `pnpm` 10+ (`npm install -g pnpm`)
* Rust stable toolchain (`rustup default stable`)
* Platform-specific Tauri prerequisites (see [Tauri Docs](https://tauri.app/start/prerequisites/))

### Development Mode
```bash
# Install frontend dependencies
pnpm install

# Run frontend + Rust backend in development mode
pnpm tauri dev
```

### Production Build
```bash
# Compile optimized desktop installer binaries
pnpm tauri build
```

Binary outputs:
* **Windows:** NSIS setup installer (`.exe`) and WiX installer (`.msi`)
* **Linux:** Debian package (`.deb`) and standalone (`.AppImage`)

---

## Browser Extension Setup

1. Open `chrome://extensions/` (or `edge://extensions/`, `about:debugging` in Firefox).
2. Enable **Developer mode** toggle in the top-right corner.
3. Click **Load unpacked** and select the `extension/` directory from this repository.
4. When browsing any web media portal, the floating on-screen action grabber (`[⚡ X Files Found ▾]`) will appear automatically with instant 1-click downloads directly to Orbit Desktop.

---

## CLI Client (`orbit-cli`)

Orbit includes a standalone, headless CLI binary for servers, headless environments, and terminal power users:

```bash
# Add download with 16 parallel threads
orbit-cli add "https://cdn.example.com/ubuntu-24.04.iso" --connections 16

# Add batch downloads from a text file
orbit-cli batch links.txt --auto-start

# Inspect download status
orbit-cli status <download-id>
```

---

## Legal Disclaimer & Acceptable Use Policy

Orbit Download Manager is an open-source, general-purpose network utility, parallel download accelerator, and stream assembler. It is designed solely for personal backups, authorized file transfers, and accessing open-access web media.

* Orbit does **not** crack, decrypt, or circumvent Digital Rights Management (DRM) technologies such as Google Widevine, Apple FairPlay, or Microsoft PlayReady.
* Users are responsible for ensuring that their downloading activities comply with applicable copyright laws, local regulations, and individual platform terms of service.
* All product names, logos, and brands mentioned are property of their respective owners. Company, product, and service names used in this project are for identification and technical comparison purposes only. Use of these names, logos, and brands does not imply endorsement or affiliation.

---

## License

MIT License. See [LICENSE](LICENSE) for full details.
