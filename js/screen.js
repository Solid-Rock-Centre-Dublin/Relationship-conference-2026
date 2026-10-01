(function () {
  "use strict";

  var C = QA.config, ev = C.event || {};
  var $ = function (id) { return document.getElementById(id); };
  var stage = $("stage"), content = $("content"), inner = $("inner");

  /* ---------- text from config ---------- */
  $("kicker").textContent = [ev.kicker, ev.when].filter(Boolean).join(", ") || $("kicker").textContent;

  /* ---------- QR code and web address ---------- */
  // The folder this site is served from, so the code stays short and easy to scan.
  var target = C.submitUrl || new URL("./", window.location.href).href;
  var shown = C.displayUrl || target.replace(/^https?:\/\//, "").replace(/\/$/, "");

  // Let a long address wrap after dots and slashes instead of in the middle of a word.
  shown.split(/([./-])/).forEach(function (part) {
    $("url").appendChild(document.createTextNode(part));
    if (/^[./-]$/.test(part)) $("url").appendChild(document.createElement("wbr"));
  });

  try {
    $("qr").innerHTML = window.QRCodeSVG(target);
  } catch (err) {
    $("qr").textContent = "The address is too long for the QR code. Use a shorter submitUrl in js/config.js.";
  }

  /* ---------- fit everything inside the window, whatever the size or font ---------- */
  var headlines = [document.querySelector(".mark"), document.querySelector(".ido")];

  // 1. Stop the big headline lines running past the column.
  function fitHeadlines() {
    var max = content.clientWidth;
    headlines.forEach(function (n) {
      n.style.fontSize = "";
      var size = parseFloat(getComputedStyle(n).fontSize);
      while (n.scrollWidth > max && size > 12) {
        size *= 0.97;
        n.style.fontSize = size + "px";
      }
    });
  }

  // 2. If the whole block is still taller or wider than its box, scale it down evenly.
  function fitContent() {
    inner.style.transform = "";
    inner.style.width = "";
    inner.style.height = "";
    if (getComputedStyle(content).position !== "absolute") return; // stacked layout scrolls instead
    var boxW = content.clientWidth, boxH = content.clientHeight;
    var s = Math.min(1, boxW / inner.scrollWidth, boxH / inner.scrollHeight);
    if (s < 0.995) {
      inner.style.width = boxW / s + "px";
      inner.style.height = boxH / s + "px";
      inner.style.transform = "scale(" + s + ")";
    }
  }

  var pending = false;
  function fit() {
    if (pending) return;
    pending = true;
    requestAnimationFrame(function () {
      pending = false;
      fitHeadlines();
      fitContent();
    });
  }

  fit();
  window.addEventListener("resize", fit);
  window.addEventListener("load", fit);
  if (document.fonts) {
    if (document.fonts.ready) document.fonts.ready.then(fit);
    if (document.fonts.addEventListener) document.fonts.addEventListener("loadingdone", fit);
  }

  /* ---------- open or closed ---------- */
  QA.onOpen(function (open) {
    stage.classList.toggle("is-closed", !open);
    $("askTitle").textContent = open ? "Scan to ask your question" : "Questions are closed";
    $("askSub").textContent = open
      ? "Point your phone camera at the code, type your question and send it."
      : "Thank you for your questions.";
    fit();
  });

  /* ---------- fullscreen button and key ---------- */
  function toggleFullscreen() {
    if (document.fullscreenElement) document.exitFullscreen();
    else if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen();
  }
  $("fs").addEventListener("click", toggleFullscreen);
  document.addEventListener("keydown", function (e) {
    if ((e.key === "f" || e.key === "F") && !e.metaKey && !e.ctrlKey && !e.altKey) toggleFullscreen();
  });

  // Show the button when the mouse moves, then hide it and the cursor again.
  var idle;
  function wake() {
    stage.classList.add("show-ui");
    document.body.classList.remove("cursor-hidden");
    clearTimeout(idle);
    idle = setTimeout(function () {
      stage.classList.remove("show-ui");
      if (document.fullscreenElement) document.body.classList.add("cursor-hidden");
    }, 3000);
  }
  document.addEventListener("mousemove", wake);
})();
