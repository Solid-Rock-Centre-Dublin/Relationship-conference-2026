(function () {
  "use strict";

  var C = QA.config, ev = C.event || {};
  var $ = function (id) { return document.getElementById(id); };
  var stage = $("stage");

  /* ---------- text from config ---------- */
  if (ev.kicker) $("kicker").textContent = ev.kicker;
  $("when").textContent = [ev.when, ev.org].filter(Boolean).join(", ");

  /* ---------- keep the big headline inside its column in any font ---------- */
  var fitTargets = [document.querySelector(".mark"), document.querySelector(".ido")];
  function fitHeadlines() {
    var max = document.querySelector(".content").clientWidth;
    fitTargets.forEach(function (n) {
      n.style.fontSize = "";
      var size = parseFloat(getComputedStyle(n).fontSize);
      while (n.scrollWidth > max && size > 12) {
        size *= 0.97;
        n.style.fontSize = size + "px";
      }
    });
  }
  fitHeadlines();
  window.addEventListener("resize", fitHeadlines);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitHeadlines);

  /* ---------- QR code ---------- */
  // The folder this site is served from, so the code stays short and easy to scan.
  var target = C.submitUrl || new URL("./", window.location.href).href;
  var shown = C.displayUrl || target.replace(/^https?:\/\//, "").replace(/\/$/, "");
  $("url").textContent = shown;

  try {
    $("qr").innerHTML = window.QRCodeSVG(target);
  } catch (err) {
    $("qr").textContent = "The address is too long for the QR code. Use a shorter submitUrl in js/config.js.";
  }

  /* ---------- open or closed ---------- */
  QA.onOpen(function (open) {
    stage.classList.toggle("is-closed", !open);
    $("askTitle").textContent = open ? "Scan to ask your question" : "Questions are closed";
    $("askSub").textContent = open
      ? "Point your phone camera at the code, type your question and send it."
      : "Thank you for your questions.";
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
