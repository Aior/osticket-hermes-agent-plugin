/**
 * Hermes Agent Note — Copy Button
 *
 * Injected into osTicket SCP ticket view pages by the plugin
 * (class.ticket-webhook.php, onObjectView). Finds Hermes proposal
 * thread entries and adds a "Copier" button in the entry HEADER
 * (next to the dropdown caret), copying the proposal text only —
 * never the warnings block or the JSON metadata.
 *
 * Detection (either one):
 *   - body contains .hermes-agent-note  (new notes, if the class
 *     survives osTicket's HTML Purifier)
 *   - header title matches /Proposition Hermes/ (older notes)
 *
 * No inline JS — pure event delegation, CSP-safe.
 */
(function () {
  'use strict';

  var BUTTON_LABEL = 'Copier';
  var BUTTON_DONE = 'Copié !';
  var BUTTON_CLASS = 'hermes-copy-btn';
  var MARKER_CLASS = 'hermes-copy-processed';
  var TITLE_RE = /Proposition Hermes/i;

  // Inject styles once
  if (!document.getElementById('hermes-copy-styles')) {
    var style = document.createElement('style');
    style.id = 'hermes-copy-styles';
    style.textContent = [
      '.' + BUTTON_CLASS + ' {',
      '  float: right;',
      '  margin: 1px 6px 1px 0;',
      '  padding: 1px 8px;',
      '  font-size: 11px;',
      '  font-weight: 600;',
      '  line-height: 16px;',
      '  color: #fff;',
      '  background: #007bff;',
      '  border: none;',
      '  border-radius: 3px;',
      '  cursor: pointer;',
      '  transition: background 0.2s;',
      '}',
      '.' + BUTTON_CLASS + ':hover {',
      '  background: #0056b3;',
      '}',
      '.' + BUTTON_CLASS + '.copied {',
      '  background: #28a745;',
      '}'
    ].join('\n');
    document.head.appendChild(style);
  }

  /**
   * textContent drops <br> entirely (no character at all), so line breaks
   * written by the LLM would vanish on paste. Convert each <br> to a real
   * newline first, then drop the stray spaces HTML Purifier leaves around
   * the breaks ("texte<br> <br>texte" → "texte\n\ntexte").
   */
  function textWithBreaks(el) {
    var clone = el.cloneNode(true);
    var brs = clone.querySelectorAll('br');
    for (var i = 0; i < brs.length; i++) {
      brs[i].parentNode.replaceChild(document.createTextNode('\n'), brs[i]);
    }
    return clone.textContent
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n[ \t]+/g, '\n');
  }

  /**
   * Extract the proposal text: the first <div> inside .hermes-agent-note
   * (or inside .thread-body as fallback) that is not the warnings/metadata
   * block. Those blocks are siblings introduced by <hr>, so the first
   * child div of the note wrapper is the proposal itself.
   */
  function getProposalText(entryEl) {
    var root = entryEl.querySelector('.hermes-agent-note')
           || entryEl.querySelector('.thread-body')
           || entryEl;
    var divs = root.querySelectorAll('div');
    for (var i = 0; i < divs.length; i++) {
      var d = divs[i];
      // Skip warnings (<hr>+<p>+<ul>) and metadata (<pre>) containers
      if (d.querySelector('hr') || d.querySelector('pre')) continue;
      var t = textWithBreaks(d).trim();
      if (t) return t;
    }
    return textWithBreaks(root).trim();
  }

  function isHermesEntry(entryEl) {
    if (entryEl.querySelector('.hermes-agent-note')) return true;
    // NB: the header contains SEVERAL .title elements — osTicket's action
    // dropdown renders a <ul class="title"> ("Create Ticket / Create Task")
    // BEFORE the real <span class="title">. querySelector('.title') grabs
    // the dropdown, not the entry title — test them all instead.
    var titles = entryEl.querySelectorAll('.header .title, header .title');
    for (var i = 0; i < titles.length; i++) {
      if (TITLE_RE.test(titles[i].textContent)) return true;
    }
    return false;
  }

  function addCopyButton(entryEl) {
    if (entryEl.classList.contains(MARKER_CLASS)) return;
    var header = entryEl.querySelector('.header, header');
    if (!header) return;
    entryEl.classList.add(MARKER_CLASS);

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = BUTTON_CLASS;
    btn.textContent = BUTTON_LABEL;
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      var text = getProposalText(entryEl);
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function () {
          flashCopied(btn);
        }).catch(function () {
          fallbackCopy(text, btn);
        });
      } else {
        fallbackCopy(text, btn);
      }
    });

    // First child of the header + float:right => lands in the header
    // action area, just left of the dropdown caret.
    header.insertBefore(btn, header.firstChild);
  }

  function flashCopied(btn) {
    btn.textContent = BUTTON_DONE;
    btn.classList.add('copied');
    setTimeout(function () {
      btn.textContent = BUTTON_LABEL;
      btn.classList.remove('copied');
    }, 2000);
  }

  function fallbackCopy(text, btn) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); } catch (e) {}
    document.body.removeChild(ta);
    flashCopied(btn);
  }

  function scanForEntries(root) {
    // Only .thread-entry elements can be Hermes notes in the SCP thread
    var entries = (root || document).querySelectorAll('.thread-entry');
    for (var i = 0; i < entries.length; i++) {
      if (isHermesEntry(entries[i])) addCopyButton(entries[i]);
    }
    // Safety net: a .hermes-agent-note outside any .thread-entry
    var orphans = (root || document).querySelectorAll('.hermes-agent-note');
    for (var j = 0; j < orphans.length; j++) {
      var o = orphans[j];
      var entry = o.closest ? o.closest('.thread-entry') : null;
      addCopyButton(entry && entry.classList ? entry : o);
    }
  }

  // Scan on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { scanForEntries(); });
  } else {
    scanForEntries();
  }

  // Watch for dynamically inserted notes (AJAX thread loads, ticket view
  // refresh, PJAX navigation between tickets)
  if (typeof MutationObserver !== 'undefined') {
    var observer = new MutationObserver(function (mutations) {
      for (var i = 0; i < mutations.length; i++) {
        for (var j = 0; j < mutations[i].addedNodes.length; j++) {
          var node = mutations[i].addedNodes[j];
          if (node.nodeType !== 1) continue;
          scanForEntries(node);
        }
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }
})();
