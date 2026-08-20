/**
 * Hermes Agent Note — Copy Button
 *
 * Injected into osTicket SCP pages via Signal::connect('scp.header').
 * Detects .hermes-agent-note elements and adds a "Copier" button to each.
 * Uses MutationObserver to handle dynamically loaded thread entries.
 * No inline JS — pure event delegation, CSP-safe.
 */
(function () {
  'use strict';

  var BUTTON_LABEL = 'Copier';
  var BUTTON_DONE = 'Copié !';
  var BUTTON_CLASS = 'hermes-copy-btn';

  // Inject styles once
  if (!document.getElementById('hermes-copy-styles')) {
    var style = document.createElement('style');
    style.id = 'hermes-copy-styles';
    style.textContent = [
      '.' + BUTTON_CLASS + ' {',
      '  display: inline-block;',
      '  padding: 2px 10px;',
      '  margin: 0 0 8px 0;',
      '  font-size: 11px;',
      '  font-weight: 600;',
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
      '}',
      '.hermes-agent-note {',
      '  position: relative;',
      '}'
    ].join('\n');
    document.head.appendChild(style);
  }

  function getNoteText(noteDiv) {
    // Extract the main text content (first <div> child, before <hr>)
    var divs = noteDiv.querySelectorAll('div');
    for (var i = 0; i < divs.length; i++) {
      var d = divs[i];
      // Skip if it contains <hr> or <pre> (those are warnings/metadata)
      if (d.querySelector('hr') || d.querySelector('pre')) continue;
      return d.textContent.trim();
    }
    // Fallback: entire note text
    return noteDiv.textContent.trim();
  }

  function addCopyButton(noteDiv) {
    if (noteDiv.querySelector('.' + BUTTON_CLASS)) return; // already has button

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = BUTTON_CLASS;
    btn.textContent = BUTTON_LABEL;
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      var text = getNoteText(noteDiv);
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function () {
          btn.textContent = BUTTON_DONE;
          btn.classList.add('copied');
          setTimeout(function () {
            btn.textContent = BUTTON_LABEL;
            btn.classList.remove('copied');
          }, 2000);
        }).catch(function () {
          // Fallback: textarea + execCommand
          fallbackCopy(text, btn);
        });
      } else {
        fallbackCopy(text, btn);
      }
    });

    noteDiv.insertBefore(btn, noteDiv.firstChild);
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
    btn.textContent = BUTTON_DONE;
    btn.classList.add('copied');
    setTimeout(function () {
      btn.textContent = BUTTON_LABEL;
      btn.classList.remove('copied');
    }, 2000);
  }

  function scanForNotes(root) {
    var notes = (root || document).querySelectorAll('.hermes-agent-note');
    for (var i = 0; i < notes.length; i++) {
      addCopyButton(notes[i]);
    }
  }

  // Scan on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { scanForNotes(); });
  } else {
    scanForNotes();
  }

  // Watch for dynamically inserted notes (AJAX thread loads, ticket view refresh)
  if (typeof MutationObserver !== 'undefined') {
    var observer = new MutationObserver(function (mutations) {
      for (var i = 0; i < mutations.length; i++) {
        for (var j = 0; j < mutations[i].addedNodes.length; j++) {
          var node = mutations[i].addedNodes[j];
          if (node.nodeType !== 1) continue;
          if (node.classList && node.classList.contains('hermes-agent-note')) {
            addCopyButton(node);
          } else if (node.querySelectorAll) {
            scanForNotes(node);
          }
        }
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }
})();