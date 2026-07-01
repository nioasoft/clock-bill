import json
import os

JSON_PATH = "/Users/asafbenatia/Projects/_personal/clock-bill/public/logos/logo_data.json"
HTML_OUTPUT = "/Users/asafbenatia/Projects/_personal/clock-bill/clockbill-logos.html"

with open(JSON_PATH, "r") as f:
    logos = json.load(f)

# Rationales for the 3D art concepts
RATIONALES = {
    1: "A futuristic 3D stopwatch merging into a gold currency coin with bright neon energy arcs. Combines accurate time tracking with tangible money generation.",
    2: "A bold geometric interlocking 'C' and 'B' monogram with a glowing technical clock face in the center, representing the core brand initials.",
    3: "A sleek dashboard dial meter featuring a segmented progress ring, where the final bright yellow segment represents the active billable hour.",
    4: "A modern clock face whose right-side markings rise vertically to form a progressive bar chart, visually representing hours scaling into revenue.",
    5: "A stylized neon invoice document silhouette integrated inside a classic circular chronometer dial. The ultimate time-plus-billing concept.",
    6: "A continuous vertical figure-8 hourglass loop representing billing flow. The top bulb houses a running clock, while the bottom contains a verified invoice checkmark."
}

html_content = """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ClockBill — Transparent Logo & App Icon Explorer</title>
  <style>
    :root {
      --bg-page: #0a0a0a;
      --bg-card: #161616;
      --border-color: #262626;
      --border-hover: #3a3a3a;
      --text-primary: #ffffff;
      --text-muted: #a0a0a0;
      --accent: #faff69;
      --accent-hover: #fcfc8e;
      --accent-text: #0a0a0a;

      --status-approve: #faff69;
      --status-refine: #ffa630;
      --status-pass: #ff5e5e;

      --font-sans: 'Inter', system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      --font-mono: ui-monospace, SFMono-Regular, SF Mono, Menlo, monospace;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      background-color: var(--bg-page);
      color: var(--text-primary);
      font-family: var(--font-sans);
      font-size: 14px;
      line-height: 1.5;
      padding: 40px 24px;
      letter-spacing: -0.01em;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      overflow-y: scroll;
    }

    header {
      width: 100%;
      max-width: 1400px;
      margin-bottom: 40px;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      border-bottom: 1px solid var(--border-color);
      padding-bottom: 24px;
    }

    .header-left h1 {
      font-size: 30px;
      font-weight: 850;
      letter-spacing: -0.04em;
      margin-bottom: 6px;
    }

    .header-left p {
      color: var(--text-muted);
      font-size: 14px;
    }

    .header-right {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 12px;
    }

    .metrics-bar {
      display: flex;
      gap: 16px;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      font-weight: 600;
      color: var(--text-muted);
      font-variant-numeric: tabular-nums;
    }

    .metric-item span {
      color: var(--text-primary);
      font-weight: bold;
    }

    .global-controls {
      display: flex;
      align-items: center;
      gap: 16px;
    }

    .btn {
      background: transparent;
      border: 1px solid var(--border-color);
      color: var(--text-primary);
      padding: 8px 16px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .btn:hover {
      border-color: var(--text-muted);
      background-color: rgba(255, 255, 255, 0.04);
    }

    .btn-accent {
      background-color: var(--accent);
      color: var(--accent-text);
      border-color: var(--accent);
    }

    .btn-accent:hover {
      background-color: var(--accent-hover);
      border-color: var(--accent-hover);
    }

    .logo-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 32px;
      width: 100%;
      max-width: 1400px;
      margin-bottom: 60px;
    }

    @media (max-width: 1200px) {
      .logo-grid {
        grid-template-columns: repeat(2, 1fr);
      }
    }

    @media (max-width: 800px) {
      .logo-grid {
        grid-template-columns: 1fr;
      }
      header {
        flex-direction: column;
        align-items: flex-start;
        gap: 20px;
      }
      .header-right {
        align-items: flex-start;
        width: 100%;
      }
    }

    /* Concept Card */
    .concept-card {
      background-color: var(--bg-card);
      border: 1px solid var(--border-color);
      border-radius: 12px;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      transition: border-color 0.25s, transform 0.25s;
    }

    .concept-card:hover {
      border-color: var(--border-hover);
      transform: translateY(-2px);
    }

    /* Transparency Test Stage */
    .stage-container {
      position: relative;
      background-color: #111;
      border-bottom: 1px solid var(--border-color);
      padding: 24px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
    }

    .stage-preview {
      width: 100%;
      height: 180px;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      position: relative;
      overflow: hidden;
      transition: background 0.3s ease;
      background-image: radial-gradient(#222 1px, transparent 1px);
      background-size: 12px 12px;
      background-color: #181818;
    }

    /* Checkerboard grid background */
    .stage-preview.grid {
      background-image: linear-gradient(45deg, #181818 25%, transparent 25%), 
                        linear-gradient(-45deg, #181818 25%, transparent 25%), 
                        linear-gradient(45deg, transparent 75%, #181818 75%), 
                        linear-gradient(-45deg, transparent 75%, #181818 75%);
      background-size: 16px 16px;
      background-position: 0 0, 0 8px, 8px -8px, -8px 0px;
      background-color: #111;
    }

    .stage-preview.light {
      background-color: #ffffff;
      background-image: none;
    }

    .stage-preview.dark {
      background-color: #0c0c0c;
      background-image: none;
    }

    .logo-img {
      max-width: 140px;
      max-height: 140px;
      object-fit: contain;
      pointer-events: none;
      filter: drop-shadow(0 4px 12px rgba(0, 0, 0, 0.4));
    }

    /* Contrast Swatch toggles */
    .stage-controls {
      display: flex;
      gap: 8px;
      width: 100%;
      justify-content: center;
    }

    .swatch-btn {
      background: transparent;
      border: 1px solid var(--border-color);
      color: var(--text-muted);
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      padding: 4px 10px;
      border-radius: 4px;
      cursor: pointer;
      font-weight: 700;
      transition: all 0.2s;
    }

    .swatch-btn.active {
      border-color: var(--text-primary);
      color: var(--text-primary);
      background-color: rgba(255, 255, 255, 0.05);
    }

    /* Mobile Environment Adaptations */
    .env-testbed {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
      padding: 20px;
      background-color: #121212;
      border-bottom: 1px solid var(--border-color);
    }

    .env-title {
      grid-column: span 2;
      font-size: 10px;
      font-weight: 800;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.08em;
      border-bottom: 1px solid #202020;
      padding-bottom: 6px;
      margin-bottom: 4px;
    }

    .env-item {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
    }

    .env-label {
      font-size: 10px;
      color: var(--text-muted);
      font-weight: 600;
    }

    /* iOS squircle shape */
    .icon-ios {
      width: 68px;
      height: 68px;
      background-color: #1a1a1a;
      border-radius: 15px; /* squircle approximation for small icons */
      border: 1px solid rgba(255, 255, 255, 0.08);
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      position: relative;
      background: radial-gradient(circle at center, #262626 0%, #111111 100%);
    }

    .icon-ios img {
      width: 50px;
      height: 50px;
      object-fit: contain;
    }

    /* Android adaptive circle shape */
    .icon-android {
      width: 68px;
      height: 68px;
      border-radius: 50%;
      border: 1px solid rgba(255, 255, 255, 0.08);
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      background: linear-gradient(135deg, #1c1c1e 0%, #0c0c0c 100%);
    }

    .icon-android img {
      width: 44px;
      height: 44px;
      object-fit: contain;
    }

    /* Concept Metadata */
    .concept-details {
      padding: 20px;
      flex-grow: 1;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .concept-number {
      font-size: 10px;
      font-weight: 800;
      color: var(--accent);
      text-transform: uppercase;
      letter-spacing: 0.1em;
    }

    .concept-title {
      font-size: 18px;
      font-weight: 700;
      letter-spacing: -0.02em;
    }

    .concept-rationale {
      color: var(--text-muted);
      font-size: 13px;
      line-height: 1.45;
    }

    /* Review Options */
    .review-panel {
      padding: 16px 20px;
      background-color: #111;
      border-top: 1px solid var(--border-color);
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .review-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .status-group {
      display: flex;
      gap: 6px;
    }

    .status-tag {
      background: transparent;
      border: 1px solid var(--border-color);
      color: var(--text-muted);
      padding: 4px 10px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 700;
      cursor: pointer;
      transition: all 0.15s;
    }

    .status-tag.active[data-status="approve"] {
      border-color: var(--status-approve);
      color: var(--status-approve);
      background-color: rgba(250, 255, 105, 0.05);
    }

    .status-tag.active[data-status="refine"] {
      border-color: var(--status-refine);
      color: var(--status-refine);
      background-color: rgba(255, 166, 48, 0.05);
    }

    .status-tag.active[data-status="pass"] {
      border-color: var(--status-pass);
      color: var(--status-pass);
      background-color: rgba(255, 94, 94, 0.05);
    }

    .star-rating {
      display: flex;
      gap: 4px;
    }

    .star {
      font-size: 16px;
      color: #333;
      cursor: pointer;
      transition: color 0.1s;
    }

    .star.active {
      color: var(--accent);
    }

    .feedback-note {
      width: 100%;
      background-color: #080808;
      border: 1px solid var(--border-color);
      border-radius: 6px;
      padding: 8px 12px;
      color: var(--text-primary);
      font-family: var(--font-sans);
      font-size: 12px;
      outline: none;
      resize: vertical;
      height: 50px;
    }

    .feedback-note:focus {
      border-color: var(--text-muted);
    }

    /* Make Winner / Pick this Logo Button */
    .pick-btn {
      width: 100%;
      background: transparent;
      border: 1px solid var(--border-color);
      color: var(--text-primary);
      padding: 10px;
      font-size: 12px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      border-radius: 6px;
      cursor: pointer;
      transition: all 0.2s;
      margin-top: 4px;
    }

    .pick-btn:hover {
      background-color: var(--accent);
      color: var(--accent-text);
      border-color: var(--accent);
    }

    .pick-btn.selected {
      background-color: #faff69;
      color: #0a0a0a;
      border-color: #faff69;
    }

    /* Modal dialogs */
    .summary-overlay {
      position: fixed;
      inset: 0;
      background-color: rgba(0, 0, 0, 0.9);
      backdrop-filter: blur(8px);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.3s ease;
      padding: 24px;
    }

    .summary-overlay.active {
      opacity: 1;
      pointer-events: all;
    }

    .summary-container {
      background-color: var(--bg-card);
      border: 1px solid var(--border-color);
      border-radius: 16px;
      width: 100%;
      max-width: 600px;
      display: flex;
      flex-direction: column;
    }

    .summary-content {
      padding: 28px;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .summary-title {
      font-size: 20px;
      font-weight: 850;
      letter-spacing: -0.03em;
    }

    .summary-textarea {
      width: 100%;
      height: 240px;
      background-color: #080808;
      border: 1px solid var(--border-color);
      border-radius: 8px;
      padding: 16px;
      color: var(--text-primary);
      font-family: var(--font-mono);
      font-size: 12px;
      outline: none;
      resize: none;
      line-height: 1.4;
    }

    .summary-actions {
      display: flex;
      justify-content: flex-end;
      gap: 12px;
    }

    /* Winner Splash screen */
    .winner-overlay {
      position: fixed;
      inset: 0;
      background: radial-gradient(circle, #151515 0%, #050505 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 2000;
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.4s cubic-bezier(0.16, 1, 0.3, 1);
    }

    .winner-overlay.active {
      opacity: 1;
      pointer-events: all;
    }

    .winner-card {
      background-color: #111;
      border: 1px solid var(--accent);
      padding: 48px;
      border-radius: 20px;
      text-align: center;
      max-width: 500px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 24px;
      box-shadow: 0 10px 40px rgba(250, 255, 105, 0.1);
      transform: scale(0.9);
      transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1);
    }

    .winner-overlay.active .winner-card {
      transform: scale(1);
    }

    .winner-logo-box {
      width: 180px;
      height: 180px;
      border-radius: 36px;
      background: radial-gradient(circle, #252525 0%, #0f0f0f 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      border: 1px solid rgba(255,255,255,0.05);
      margin-bottom: 8px;
    }

    .winner-logo-box img {
      width: 130px;
      height: 130px;
      object-fit: contain;
    }

    .winner-title {
      font-size: 24px;
      font-weight: 900;
      letter-spacing: -0.03em;
    }

    .winner-desc {
      color: var(--text-muted);
      font-size: 14px;
    }

    footer {
      width: 100%;
      max-width: 1400px;
      border-top: 1px solid var(--border-color);
      padding-top: 24px;
      margin-top: auto;
      display: flex;
      justify-content: space-between;
      color: var(--text-muted);
      font-size: 12px;
    }

    .footer-stamp {
      font-family: var(--font-mono);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
  </style>
</head>
<body>

  <!-- Header -->
  <header>
    <div class="header-left">
      <h1>ClockBill — Brand Identity Review</h1>
      <p>Interactive review panel for transparent artwork and iOS / Android launcher app icons.</p>
    </div>
    <div class="header-right">
      <div class="metrics-bar">
        <div class="metric-item">Selected: <span id="stat-winner">None</span></div>
        <div class="metric-item">Avg Rating: <span id="stat-rating">0.0</span>★</div>
        <div class="metric-item">Reviewed: <span id="stat-reviewed">0/6</span></div>
      </div>
      <div class="global-controls">
        <button class="btn btn-accent" id="export-summary-btn">
          Export Review Summary
        </button>
      </div>
    </div>
  </header>

  <!-- Logo Grid -->
  <main class="logo-grid">
"""

for logo in logos:
    id_val = logo["id"]
    name = logo["name"]
    b64 = logo["base64"]
    rationale = RATIONALES[id_val]
    
    html_content += f"""
    <!-- Concept {id_val} -->
    <article class="concept-card" id="card-{id_val}" data-concept-id="{id_val}">
      <!-- Transparency test stage -->
      <div class="stage-container">
        <div class="stage-preview grid" id="stage-{id_val}">
          <img class="logo-img" src="data:image/png;base64,{b64}" alt="{name}">
        </div>
        
        <!-- Surface testers -->
        <div class="stage-controls">
          <button class="swatch-btn active" onclick="setSurface({id_val}, 'grid')">Transparency Grid</button>
          <button class="swatch-btn" onclick="setSurface({id_val}, 'dark')">On Dark</button>
          <button class="swatch-btn" onclick="setSurface({id_val}, 'light')">On Light</button>
        </div>
      </div>

      <!-- App Icon Environments (iOS and Android adaptive checks) -->
      <div class="env-testbed">
        <div class="env-title">Launcher App Icon Grid</div>
        
        <div class="env-item">
          <div class="icon-ios">
            <img src="data:image/png;base64,{b64}" alt="{name} iOS">
          </div>
          <span class="env-label">iOS Icon</span>
        </div>
        
        <div class="env-item">
          <div class="icon-android">
            <img src="data:image/png;base64,{b64}" alt="{name} Android">
          </div>
          <span class="env-label">Android Icon</span>
        </div>
      </div>

      <!-- Details -->
      <div class="concept-details">
        <span class="concept-number">Concept 0{id_val}</span>
        <h3 class="concept-title">{name}</h3>
        <p class="concept-rationale">{rationale}</p>
      </div>

      <!-- Review Input Panel -->
      <div class="review-panel">
        <div class="review-row">
          <div class="status-group">
            <button class="status-tag" data-status="approve" onclick="setStatus({id_val}, 'approve')">Approve</button>
            <button class="status-tag" data-status="refine" onclick="setStatus({id_val}, 'refine')">Refine</button>
            <button class="status-tag" data-status="pass" onclick="setStatus({id_val}, 'pass')">Pass</button>
          </div>
          <div class="star-rating" data-concept="{id_val}">
            <span class="star" data-val="1" onclick="setRating({id_val}, 1)">★</span>
            <span class="star" data-val="2" onclick="setRating({id_val}, 2)">★</span>
            <span class="star" data-val="3" onclick="setRating({id_val}, 3)">★</span>
            <span class="star" data-val="4" onclick="setRating({id_val}, 4)">★</span>
            <span class="star" data-val="5" onclick="setRating({id_val}, 5)">★</span>
          </div>
        </div>
        
        <textarea class="feedback-note" placeholder="Write review comments..." oninput="saveNotes({id_val}, this.value)"></textarea>
        
        <button class="pick-btn" id="pick-btn-{id_val}" onclick="selectWinner({id_val})">Select as Brand Logo</button>
      </div>
    </article>
"""

html_content += """
  </main>

  <!-- Footer -->
  <footer>
    <p>Wordmark is Latin in all locales (including Hebrew UI). App icon proportions represent 512x512 pixels rendering down to device dimensions.</p>
    <div class="footer-stamp">CLOCKBILL EXPLORATION VER: 2.0.0</div>
  </footer>

  <!-- Summary modal -->
  <div class="summary-overlay" id="summary-modal">
    <div class="summary-container">
      <div class="summary-content">
        <div class="summary-title">Review Summary Report</div>
        <p style="color: var(--text-muted); font-size: 13px;">Copy this summary to share reviews with design & engineering partners.</p>
        <textarea class="summary-textarea" id="summary-text" readonly></textarea>
        <div class="summary-actions">
          <button class="btn" onclick="closeSummary()">Close</button>
          <button class="btn btn-accent" onclick="copySummaryText()">Copy Summary</button>
        </div>
      </div>
    </div>
  </div>

  <!-- Winner Splash Screen -->
  <div class="winner-overlay" id="winner-splash" onclick="closeWinnerSplash()">
    <div class="winner-card" onclick="event.stopPropagation()">
      <div class="winner-logo-box">
        <img id="winner-logo-img" src="" alt="Winner Logo">
      </div>
      <div class="winner-title" id="winner-logo-title">Brand Identity Set!</div>
      <div class="winner-desc">
        Congratulations! You have selected this concept as the official logo for ClockBill. 
        The transparent PNG assets are generated and saved under <code>public/logos/</code> in your workspace.
      </div>
      <button class="btn btn-accent" onclick="closeWinnerSplash()">Back to Explorer</button>
    </div>
  </div>

  <script>
    // State management
    const state = {
      1: { status: '', rating: 0, notes: '', title: 'Clock→Coin' },
      2: { status: '', rating: 0, notes: '', title: 'CB Monogram' },
      3: { status: '', rating: 0, notes: '', title: 'Billing Meter' },
      4: { status: '', rating: 0, notes: '', title: 'Sweep→bars' },
      5: { status: '', rating: 0, notes: '', title: 'Receipt + dial' },
      6: { status: '', rating: 0, notes: '', title: 'Time-Value Loop' },
    };

    let selectedWinnerId = null;

    // Load from LocalStorage
    function loadSavedState() {
      const stored = localStorage.getItem('clockbill-review-state-v2');
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          Object.keys(parsed).forEach(id => {
            if (state[id]) {
              state[id].status = parsed[id].status || '';
              state[id].rating = parsed[id].rating || 0;
              state[id].notes = parsed[id].notes || '';
            }
          });
        } catch (e) {
          console.error('Error loading stored reviews', e);
        }
      }

      const savedWinner = localStorage.getItem('clockbill-selected-winner');
      if (savedWinner) {
        selectedWinnerId = parseInt(savedWinner);
        updateWinnerUI();
      }
      
      // Update UI components
      for (let i = 1; i <= 6; i++) {
        if (state[i].status) {
          const btn = document.querySelector(`#card-${i} .status-tag[data-status="${state[i].status}"]`);
          if (btn) btn.classList.add('active');
        }
        updateStars(i, state[i].rating);
        const textarea = document.querySelector(`#card-${i} .feedback-note`);
        if (textarea) textarea.value = state[i].notes;
      }
      
      updateStats();
    }

    function saveState() {
      localStorage.setItem('clockbill-review-state-v2', JSON.stringify(state));
      updateStats();
    }

    // Set preview surface background
    function setSurface(id, surface) {
      const stage = document.getElementById(`stage-${id}`);
      const buttons = document.querySelectorAll(`#card-${id} .swatch-btn`);
      
      stage.className = `stage-preview ${surface}`;
      
      buttons.forEach(btn => {
        const text = btn.textContent.toLowerCase();
        if (text.includes(surface) || (surface === 'grid' && text.includes('transparency'))) {
          btn.classList.add('active');
        } else {
          btn.classList.remove('active');
        }
      });
    }

    // Set Review Status
    function setStatus(id, status) {
      const buttons = document.querySelectorAll(`#card-${id} .status-tag`);
      buttons.forEach(btn => {
        if (btn.getAttribute('data-status') === status) {
          if (btn.classList.contains('active')) {
            btn.classList.remove('active');
            state[id].status = '';
          } else {
            btn.classList.add('active');
            state[id].status = status;
          }
        } else {
          btn.classList.remove('active');
        }
      });
      saveState();
    }

    // Set Rating Stars
    function setRating(id, rating) {
      if (state[id].rating === rating) {
        state[id].rating = 0; // toggle off
      } else {
        state[id].rating = rating;
      }
      updateStars(id, state[id].rating);
      saveState();
    }

    function updateStars(id, rating) {
      const stars = document.querySelectorAll(`#card-${id} .star`);
      stars.forEach(star => {
        const val = parseInt(star.getAttribute('data-val'));
        if (val <= rating) {
          star.classList.add('active');
        } else {
          star.classList.remove('active');
        }
      });
    }

    // Save notes
    function saveNotes(id, text) {
      state[id].notes = text;
      saveState();
    }

    // Winner Selection
    function selectWinner(id) {
      if (selectedWinnerId === id) {
        // Toggle off
        selectedWinnerId = null;
        localStorage.removeItem('clockbill-selected-winner');
        updateWinnerUI();
      } else {
        selectedWinnerId = id;
        localStorage.setItem('clockbill-selected-winner', id);
        updateWinnerUI();
        triggerWinnerSplash(id);
      }
      updateStats();
    }

    function updateWinnerUI() {
      // Reset all buttons
      document.querySelectorAll('.pick-btn').forEach(btn => {
        btn.textContent = 'Select as Brand Logo';
        btn.classList.remove('selected');
      });

      if (selectedWinnerId) {
        const activeBtn = document.getElementById(`pick-btn-${selectedWinnerId}`);
        if (activeBtn) {
          activeBtn.textContent = 'OFFICIAL LOGO';
          activeBtn.classList.add('selected');
        }
        document.getElementById('stat-winner').textContent = state[selectedWinnerId].title;
      } else {
        document.getElementById('stat-winner').textContent = 'None';
      }
    }

    function triggerWinnerSplash(id) {
      const splash = document.getElementById('winner-splash');
      const logoImg = document.getElementById('winner-logo-img');
      const logoTitle = document.getElementById('winner-logo-title');

      const card = document.getElementById(`card-${id}`);
      const src = card.querySelector('.logo-img').getAttribute('src');

      logoImg.src = src;
      logoTitle.textContent = `${state[id].title} Selected!`;
      splash.classList.add('active');
    }

    function closeWinnerSplash() {
      document.getElementById('winner-splash').classList.remove('active');
    }

    // Statistics Counter
    function updateStats() {
      let reviewedCount = 0;
      let ratedCount = 0;
      let totalRating = 0;

      Object.keys(state).forEach(id => {
        const item = state[id];
        const isReviewed = item.status || item.rating > 0 || item.notes.trim() !== '';
        if (isReviewed) reviewedCount++;
        
        if (item.rating > 0) {
          totalRating += item.rating;
          ratedCount++;
        }
      });

      const avgRating = ratedCount > 0 ? (totalRating / ratedCount).toFixed(1) : '0.0';
      document.getElementById('stat-rating').textContent = avgRating;
      document.getElementById('stat-reviewed').textContent = `${reviewedCount}/6`;
    }

    // Export Summary
    const summaryModal = document.getElementById('summary-modal');
    const summaryText = document.getElementById('summary-text');
    const exportBtn = document.getElementById('export-summary-btn');

    exportBtn.addEventListener('click', () => {
      let report = `==================================================\\n`;
      report += `CLOCKBILL TRANSPARENT LOGO & APP ICON REVIEW REPORT\\n`;
      report += `Generated: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}\\n`;
      report += `==================================================\\n\\n`;

      if (selectedWinnerId) {
        report += `SELECTED BRAND IDENTITY LOGO: CONCEPT 0${selectedWinnerId} - ${state[selectedWinnerId].title}\\n\\n`;
      } else {
        report += `SELECTED BRAND IDENTITY LOGO: PENDING DECISION\\n\\n`;
      }

      Object.keys(state).forEach(id => {
        const c = state[id];
        report += `CONCEPT 0${id}: ${c.title}\\n`;
        report += `--------------------------------------------------\\n`;
        report += `Review Status: ${c.status ? c.status.toUpperCase() : 'PENDING'}\\n`;
        report += `Review Rating: ${c.rating > 0 ? '★'.repeat(c.rating) + '☆'.repeat(5 - c.rating) + ` (${c.rating}/5)` : 'UNRATED'}\\n`;
        report += `Notes:         ${c.notes.trim() ? c.notes : '(No comments written)'}\\n\\n`;
      });

      summaryText.value = report;
      summaryModal.classList.add('active');
    });

    function closeSummary() {
      summaryModal.classList.remove('active');
    }

    function copySummaryText() {
      summaryText.select();
      navigator.clipboard.writeText(summaryText.value).then(() => {
        alert('Report copied to clipboard.');
        closeSummary();
      });
    }

    summaryModal.addEventListener('click', (e) => {
      if (e.target === summaryModal) closeSummary();
    });

    window.addEventListener('DOMContentLoaded', () => {
      loadSavedState();
    });
  </script>
</body>
</html>
"""

with open(HTML_OUTPUT, "w") as f:
    f.write(html_content)

print(f"HTML logo review file generated successfully at: {HTML_OUTPUT}")
