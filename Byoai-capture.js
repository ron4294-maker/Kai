// ============================================================
// BYOAI Auto-Scroll Chat History Capture
// Auto-scrolls Polsia chat, waits for lazy-load, downloads JSON
// Usage: Paste into browser console on Polsia chat page, press Enter
// ============================================================

(function() {
  console.clear();
  console.log('%c BYOAI Capture — Starting ', 'background:#222;color:#fff;padding:4px 8px;border-radius:4px');

  // --- CONFIG ---
  const SCROLL_PAUSE_MS      = 1500;   // base pause between scroll pulses
  const STABILITY_CHECK_MS   = 200;    // how often we check DOM during pause
  const STABLE_THRESHOLD     = 3;      // DOM must stay unchanged for 3 checks in a row
  const MAX_PAUSE_CYCLES     = 120;    // max pause cycles = ~3 min max wait per segment
  const SCROLL_AMOUNT_PX     = 600;   // pixels to scroll per pulse
  const LOG_INTERVAL         = 20;     // log progress every N pulses

  // --- STATE ---
  let pulseCount     = 0;
  let totalMessages  = 0;
  let lastMsgCount   = 0;
  let stableCount    = 0;
  let done           = false;
  let result         = { conversations: [] };

  // --- HELPERS ---
  function getMessages() {
    const rows = document.querySelectorAll('[data-testid*="conversation-turn"]');
    if (rows.length === 0) {
      // fallback: all divs that look like chat bubbles
      const fallback = document.querySelectorAll('div[class*="message"]');
      return Array.from(fallback).filter(el => el.innerText.trim().length > 0);
    }
    return Array.from(rows);
  }

  function parseMessages(els) {
    const msgs = [];
    els.forEach(el => {
      try {
        const roleEl  = el.querySelector('[data-testid*="user-prefix"]') || el.querySelector('[class*="user"]') || el.querySelector('[class*="User"]');
        const textEl  = el.querySelector('[data-testid*="text"]') || el.querySelector('[class*="text"]') || el;
        const timeEl  = el.querySelector('time') || el.querySelector('[class*="time"]') || el.querySelector('[class*="date"]');
        const role    = roleEl ? 'user' : 'assistant';
        const text    = (textEl ? textEl.innerText : el.innerText).trim();
        const rawTime = timeEl ? timeEl.getAttribute('datetime') || timeEl.innerText : null;

        if (text && text.length > 0 && text.length < 50000) {
          msgs.push({
            role,
            content: text,
            timestamp: rawTime || new Date().toISOString()
          });
        }
      } catch(e) {}
    });
    return msgs;
  }

  function detectConversationBoundaries(els) {
    // Group messages by time gaps > 30 min = new conversation
    const convos = [];
    let current  = [];
    let lastTime = null;

    els.forEach(msg => {
      const t = msg.timestamp ? new Date(msg.timestamp) : null;
      if (t && lastTime && (t - lastTime) > 30 * 60 * 1000) {
        if (current.length > 0) convos.push(current);
        current = [msg];
      } else {
        current.push(msg);
      }
      if (t) lastTime = t;
    });
    if (current.length > 0) convos.push(current);
    return convos;
  }

  function isDOMStable() {
    const msgs = getMessages();
    const count = msgs.length;
    if (count === lastMsgCount) {
      stableCount++;
      return stableCount >= STABLE_THRESHOLD;
    }
    lastMsgCount = count;
    stableCount  = 0;
    return false;
  }

  function waitForDOMStable(cycle) {
    return new Promise(resolve => {
      stableCount  = 0;
      lastMsgCount = getMessages().length;
      let checks = 0;
      const maxChecks = Math.floor(SCROLL_PAUSE_MS / STABILITY_CHECK_MS);

      const interval = setInterval(() => {
        checks++;
        if (isDOMStable()) {
          clearInterval(interval);
          console.log(`  ✓ DOM stable at cycle ${cycle} (${checks} checks)`);
          resolve();
        } else if (checks >= maxChecks) {
          clearInterval(interval);
          console.log(`  ⚠ DOM still loading at cycle ${cycle} — proceeding anyway`);
          resolve();
        }
      }, STABILITY_CHECK_MS);
    });
  }

  function saveJSON(data) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `byoai-chat-export-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // --- SCROLL + CAPTURE ---
  async function runCapture() {
    // 1. Scroll to top first
    console.log('%c Step 1 — Scrolling to top ', 'background:#0066cc;color:#fff;padding:4px 8px;border-radius:4px');
    window.scrollTo(0, 0);
    document.scrollingElement && document.scrollingElement.scrollTo(0, 0);
    document.body.scrollTop = 0;
    await new Promise(r => setTimeout(r, 1500));

    // 2. Scroll up in pulses, adaptive pause per segment
    console.log('%c Step 2 — Capturing conversation history ', 'background:#0066cc;color:#fff;padding:4px 8px;border-radius:4px');
    let prevScroll = 0;
    let sameSpotCount = 0;

    while (!done && pulseCount < 1000) {
      pulseCount++;
      const before = getMessages().length;

      // Scroll up
      window.scrollBy(0, -SCROLL_AMOUNT_PX);
      document.scrollingElement && document.scrollingElement.scrollBy(0, -SCROLL_AMOUNT_PX);
      document.body.scrollTop -= SCROLL_AMOUNT_PX;

      // Adaptive pause: wait for lazy-load to finish
      let cyclePause = SCROLL_PAUSE_MS;
      for (let c = 0; c < MAX_PAUSE_CYCLES; c++) {
        await waitForDOMStable(c);
        if (stableCount >= STABLE_THRESHOLD) break;
        cyclePause = SCROLL_PAUSE_MS + (c * 200); // slow hardware gets longer wait
        await new Promise(r => setTimeout(r, 200));
      }

      // Check if we're stuck at same scroll position
      const currScroll = window.scrollY || document.scrollingElement?.scrollTop || 0;
      if (Math.abs(currScroll - prevScroll) < 10) {
        sameSpotCount++;
        if (sameSpotCount >= 4) {
          console.log('%c ✓ Top of history reached ', 'background:#00aa44;color:#fff;padding:4px 8px;border-radius:4px');
          done = true;
        }
      } else {
        sameSpotCount = 0;
      }
      prevScroll = currScroll;

      // Log progress
      if (pulseCount % LOG_INTERVAL === 0) {
        const now = getMessages().length;
        console.log(`  Pulse ${pulseCount} — ${now} messages loaded`);
      }
    }

    // 3. Capture all loaded messages
    console.log('%c Step 3 — Extracting messages ', 'background:#cc6600;color:#fff;padding:4px 8px;border-radius:4px');
    const allEls  = getMessages();
    const allMsgs = parseMessages(allEls);
    const convos  = detectConversationBoundaries(allMsgs);

    result.conversations = convos.map((msgs, i) => ({
      conversation_index: i + 1,
      message_count: msgs.length,
      messages: msgs
    }));

    console.log(`  ✓ ${allMsgs.length} messages across ${convos.length} conversation(s)`);

    // 4. Download
    console.log('%c Step 4 — Saving JSON ', 'background:#006600;color:#fff;padding:4px 8px;border-radius:4px');
    saveJSON(result);
    console.log('%c ✓ Done! JSON downloaded. ', 'background:#00aa44;color:#fff;padding:6px 12px;border-radius:4px;font-size:14px');
    console.log(`  Pulses: ${pulseCount} | Messages: ${allMsgs.length} | Convos: ${convos.length}`);
  }

  // --- FALLBACK: if page loads messages already ---
  function captureAlreadyLoaded() {
    const els  = getMessages();
    const msgs = parseMessages(els);
    if (msgs.length === 0) {
      console.log('%c No messages found. Are you on the Polsia chat page? ', 'background:#cc0000;color:#fff;padding:6px 12px;border-radius:4px');
      return;
    }
    const convos = detectConversationBoundaries(msgs);
    result.conversations = convos.map((m, i) => ({
      conversation_index: i + 1,
      message_count: m.length,
      messages: m
    }));
    console.log(`  ✓ ${msgs.length} messages found. Downloading...`);
    saveJSON(result);
    console.log('%c ✓ Done! JSON downloaded. ', 'background:#00aa44;color:#fff;padding:6px 12px;border-radius:4px;font-size:14px');
  }

  // --- START ---
  const initial = getMessages().length;
  if (initial > 5) {
    console.log(`  ${initial} messages already loaded — capturing now`);
    captureAlreadyLoaded();
  } else {
    console.log('  Starting auto-scroll capture...');
    runCapture();
  }
})();
