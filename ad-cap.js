      (function () {
        try {
          var state = { shown: false, suppressed: false };
          function isAdIframe(el) {
            if (!el || el.tagName !== 'IFRAME') return false;
            if (el.closest && el.closest('#root')) return false;
            try {
              if (getComputedStyle(el).position !== 'fixed') return false;
            } catch (e) {
              return false;
            }
            return true;
          }
          function scan() {
            var iframes = document.querySelectorAll('body iframe');
            for (var i = 0; i < iframes.length; i++) {
              var f = iframes[i];
              if (!isAdIframe(f)) continue;
              if (state.suppressed) {
                f.remove();
                continue;
              }
              if (!state.shown) {
                state.shown = true;
                // enforce "only one": drop any sibling ad layers present in
                // the same batch so a single page view shows a single ad
                for (var j = 0; j < iframes.length; j++) {
                  if (j !== i && isAdIframe(iframes[j])) iframes[j].remove();
                }
                watchForClose(f);
                break;
              }
            }
            hideAdHoverUrls();
            sweepOverlays();
          }

          // The popunder script injects an invisible full-page anchor, so
          // the browser status bar shows its long tracking URL whenever the
          // mouse is anywhere over a page. Neutralize the HOVER DISPLAY
          // without touching ad behavior: the href is stripped (no status
          // text) and restored on mousedown/touchstart, so the actual click
          // still goes through the ad's own anchor with its original URL,
          // target and listeners — revenue path unchanged. Internal links
          // are never touched.
          function hideAdHoverUrls() {
            var anchors = document.getElementsByTagName('a');
            for (var k = 0; k < anchors.length; k++) {
              var a = anchors[k];
              if (a.dataset.hoverLocked === '1') continue;
              var href = a.getAttribute('href') || '';
              if (href.length > 80 && a.hostname !== location.hostname) {
                a.dataset.hoverLocked = '1';
                a.dataset.keepHref = href;
                var show = function () {
                  if (this.dataset.keepHref) this.setAttribute('href', this.dataset.keepHref);
                };
                var hide = function () { this.removeAttribute('href'); };
                a.addEventListener('mousedown', show);
                a.addEventListener('touchstart', show, { passive: true });
                a.addEventListener('focus', show);
                a.addEventListener('mouseleave', hide);
                a.addEventListener('blur', hide);
                a.removeAttribute('href');
              }
            }
          }
          // "Have to press twice" fix: the popunder injects an invisible
          // full-viewport anchor that keeps swallowing taps after its pop
          // attempt (especially when the popup is blocked — nothing visible
          // happens, so the page feels stuck). The FIRST interaction still
          // goes through the ad's own anchor (revenue path unchanged); every
          // later pointer event passes through to the real UI.
          function defuseFullPageAnchor(a) {
            if (a.dataset.overlayDefused === '1') return;
            a.dataset.overlayDefused = '1';
            var pass = function () {
              setTimeout(function () { a.style.pointerEvents = 'none'; }, 0);
            };
            a.addEventListener('pointerdown', pass, { capture: true, passive: true });
            a.addEventListener('click', pass, { capture: true });
          }
          function sweepOverlays() {
            var links = document.getElementsByTagName('a');
            var vw = window.innerWidth, vh = window.innerHeight;
            for (var m = 0; m < links.length; m++) {
              var a = links[m];
              if (a.dataset.overlayDefused === '1') continue;
              if (a.closest && a.closest('#root')) continue;
              var href = a.getAttribute('href') || '';
              if (href.length <= 80 && a.hostname === location.hostname) continue;
              var r = a.getBoundingClientRect();
              if (r.width * r.height < 0.8 * vw * vh) continue;
              try {
                var pos = getComputedStyle(a).position;
                if (pos !== 'fixed' && pos !== 'absolute') continue;
              } catch (e) { continue; }
              defuseFullPageAnchor(a);
            }
          }
          function watchForClose(el) {
            var mo = new MutationObserver(function () {
              if (!document.documentElement.contains(el)) {
                mo.disconnect();
                suppress();
              }
            });
            mo.observe(document.documentElement, { childList: true, subtree: true });
          }
          function suppress() {
            state.suppressed = true;
            document.documentElement.setAttribute('data-adcap', '1');
            scan();
          }
          // one ad per PAGE VIEW: navigating to another page re-arms the cap
          function reset() {
            state.suppressed = false;
            state.shown = false;
            document.documentElement.removeAttribute('data-adcap');
          }
          var push = history.pushState;
          history.pushState = function () {
            var r = push.apply(this, arguments);
            reset();
            return r;
          };
          window.addEventListener('popstate', reset);
          // rAF-coalesced: a page mount triggers dozens of mutation batches,
          // and scan() queries every body iframe each time — one scan per
          // frame keeps the cap behavior while cutting SPA navigation cost
          var scanQueued = false;
          var queueScan = function () {
            if (scanQueued) return;
            scanQueued = true;
            requestAnimationFrame(function () {
              scanQueued = false;
              scan();
            });
          };
          new MutationObserver(queueScan).observe(document.documentElement, { childList: true, subtree: true });
          document.addEventListener('DOMContentLoaded', scan);
        } catch (e) {}
      })();
