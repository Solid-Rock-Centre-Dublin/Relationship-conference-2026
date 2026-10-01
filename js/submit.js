(function () {
  "use strict";

  var C = QA.config, ev = C.event || {};
  var MAX = C.maxLength || 400;
  var COOLDOWN_KEY = "qa-last-sent";
  var $ = function (id) { return document.getElementById(id); };

  var form = $("askForm"), q = $("q"), nameEl = $("name"), count = $("count"), note = $("note");
  var sendBtn = $("send"), formPanel = $("formPanel"), donePanel = $("donePanel"), closedPanel = $("closedPanel");
  var isOpen = true, justSent = false;

  /* ---------- content from config ---------- */
  if (ev.org) $("org").textContent = ev.org;
  if (ev.title) $("brand").textContent = ev.title;
  document.title = "Ask a question" + (ev.title ? " | " + ev.title : "");
  q.maxLength = MAX;
  if (QA.mode === "preview") $("demoFlag").hidden = false;

  var recipients = (C.recipients && C.recipients.length) ? C.recipients : ["Anyone"];
  recipients.forEach(function (name, i) {
    var label = document.createElement("label");
    label.className = "chip";
    var input = document.createElement("input");
    input.type = "radio";
    input.name = "to";
    input.value = name;
    if (i === 0) input.checked = true;
    var span = document.createElement("span");
    span.textContent = name;
    label.appendChild(input);
    label.appendChild(span);
    $("chipRow").appendChild(label);
  });

  /* ---------- small helpers ---------- */
  function showNote(text, kind) {
    note.textContent = text;
    note.className = "note" + (kind === "info" ? " is-info" : "");
    note.hidden = false;
  }
  function hideNote() { note.hidden = true; }

  function updateCount() {
    count.textContent = q.value.length + " / " + MAX;
    count.classList.toggle("is-near", q.value.length >= MAX * 0.9);
  }

  function render() {
    var showClosed = !isOpen && !justSent;
    closedPanel.hidden = !showClosed;
    formPanel.hidden = showClosed || justSent;
    donePanel.hidden = !justSent;
  }

  function selectedRecipient() {
    var r = form.querySelector('input[name="to"]:checked');
    return r ? r.value : recipients[0];
  }

  function secondsLeft() {
    var wait = (C.minSecondsBetweenQuestions || 0) * 1000;
    var last = 0;
    try { last = parseInt(localStorage.getItem(COOLDOWN_KEY), 10) || 0; } catch (e) {}
    return Math.max(0, Math.ceil((last + wait - Date.now()) / 1000));
  }

  /* ---------- events ---------- */
  q.addEventListener("input", updateCount);
  updateCount();

  QA.onOpen(function (open) { isOpen = open; render(); });

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    hideNote();

    var text = QA.cleanText(q.value, MAX);
    if (!text) { showNote("Type your question first.", "error"); q.focus(); return; }

    // Hidden field that only bots fill in: pretend it worked and drop it.
    if ($("website").value) { finish(text); return; }

    var wait = secondsLeft();
    if (wait > 0) { showNote("Please wait " + wait + " seconds before sending another question.", "info"); return; }

    sendBtn.disabled = true;
    sendBtn.textContent = "Sending…";
    var slow = setTimeout(function () {
      showNote("Still sending. Keep this page open and it will go through when your connection returns.", "info");
    }, 10000);

    QA.submit({ text: text, name: QA.cleanLine(nameEl.value, 60), to: selectedRecipient() })
      .then(function () {
        try { localStorage.setItem(COOLDOWN_KEY, String(Date.now())); } catch (e2) {}
        finish(text);
      })
      .catch(function (err) {
        var code = (err && err.code) || "";
        if (/permission-denied/.test(code)) {
          isOpen = false; render();
        } else if (/unavailable|network|deadline/.test(code)) {
          showNote("Could not send. Check your connection and try again. Your question is still here.", "error");
        } else {
          showNote("Something went wrong and your question was not sent. It is still in the box, so try again.", "error");
        }
      })
      .then(function () {
        clearTimeout(slow);
        sendBtn.disabled = false;
        sendBtn.textContent = "Send question";
      });
  });

  function finish(text) {
    justSent = true;
    $("echo").textContent = text;
    q.value = "";
    updateCount();
    hideNote();
    render();
    $("doneTitle").focus();
  }

  $("again").addEventListener("click", function () {
    justSent = false;
    render();
    q.focus();
  });
})();
