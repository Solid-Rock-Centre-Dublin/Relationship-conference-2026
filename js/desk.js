(function () {
  "use strict";

  var C = QA.config, ev = C.event || {};
  var generic = (C.recipients && C.recipients[0]) || "Anyone";
  var $ = function (id) { return document.getElementById(id); };

  var state = { list: [], filter: "new", sort: "newest", known: null, fresh: {}, error: null };
  var unsubQ = null, unsubO = null;
  var gate = $("gate"), desk = $("desk"), listEl = $("list"), emptyEl = $("empty");

  if (QA.mode === "preview") { $("demoFlag").hidden = false; $("loginHint").hidden = false; }
  $("phOrg").textContent = [ev.org, ev.title].filter(Boolean).join(", ");

  /* ---------- small helpers ---------- */

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function fmtTime(ms) {
    return new Date(ms).toLocaleTimeString("en-IE", { hour: "2-digit", minute: "2-digit" });
  }

  function ago(ms) {
    var s = Math.max(0, Math.round((Date.now() - ms) / 1000));
    if (s < 45) return "just now";
    var m = Math.round(s / 60);
    if (m < 60) return m + " min ago";
    return Math.floor(m / 60) + " h ago";
  }

  var toastTimer;
  function toast(text) {
    var t = $("toast");
    t.textContent = text;
    t.classList.add("is-on");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove("is-on"); }, 2200);
  }

  function setStatus(kind, text) {
    var s = $("status");
    s.textContent = text;
    s.className = "status" + (kind === "live" ? " is-live" : kind === "error" ? " is-error" : "");
  }

  function find(id) {
    for (var i = 0; i < state.list.length; i++) if (state.list[i].id === id) return state.list[i];
    return null;
  }

  /* ---------- sign in and out ---------- */

  QA.auth.onChange(function (user, err) {
    if (err) { showLoginNote("Could not reach the sign-in service. Check your connection and reload."); return; }
    if (user) enter(); else leave();
  });

  function showLoginNote(text) { var n = $("loginNote"); n.textContent = text; n.hidden = false; }

  $("loginForm").addEventListener("submit", function (e) {
    e.preventDefault();
    $("loginNote").hidden = true;
    var btn = $("loginBtn");
    btn.disabled = true;
    QA.auth.signIn($("email").value.trim(), $("pw").value)
      .then(function () { $("pw").value = ""; })
      .catch(function (err) {
        var code = (err && err.code) || "";
        if (/too-many/.test(code)) showLoginNote("Too many attempts. Wait a few minutes and try again.");
        else if (/network/.test(code)) showLoginNote("Could not reach Firebase. Check your connection.");
        else if (/invalid|wrong-password|user-not-found/.test(code)) showLoginNote("That email or password is not right.");
        else showLoginNote("Could not sign in. Try again.");
      })
      .then(function () { btn.disabled = false; });
  });

  $("signOut").addEventListener("click", function () { QA.auth.signOut(); });

  function enter() {
    gate.hidden = true;
    desk.hidden = false;
    if (unsubQ) return;
    setStatus("", "Connecting…");
    unsubQ = QA.onQuestions(onList, onListError);
    unsubO = QA.onOpen(function (open) {
      $("openSwitch").checked = open;
      $("openLabel").textContent = open ? "Accepting questions" : "Questions closed";
    });
  }

  function leave() {
    desk.hidden = true;
    gate.hidden = false;
    if (unsubQ) { unsubQ(); unsubQ = null; }
    if (unsubO) { unsubO(); unsubO = null; }
    state.list = []; state.known = null; state.error = null;
    document.title = "Question desk";
  }

  /* ---------- incoming questions ---------- */

  function onList(list) {
    var first = state.known === null, arrivals = [];
    if (first) state.known = {};
    state.fresh = {};
    list.forEach(function (q) {
      if (!state.known[q.id]) {
        state.known[q.id] = true;
        if (!first) { state.fresh[q.id] = true; arrivals.push(q); }
      }
    });
    state.list = list;
    state.error = null;
    setStatus("live", "Live");
    render();
    if (arrivals.length) {
      var a = arrivals[0];
      $("announce").textContent = arrivals.length > 1
        ? arrivals.length + " new questions"
        : "New question" + (a.name ? " from " + a.name : "");
    }
  }

  function onListError(err) {
    var code = (err && err.code) || "";
    state.error = /permission-denied/.test(code)
      ? { title: "This account cannot read questions", body: "Check that the email you signed in with is listed in firestore.rules, then publish the rules again." }
      : { title: "Could not load questions", body: "Check your connection. The page will keep trying." };
    state.list = [];
    setStatus("error", "Not connected");
    render();
  }

  /* ---------- rendering ---------- */

  function visibleRows() {
    var rows = state.list.filter(function (q) {
      return state.filter === "all" || (state.filter === "new" ? !q.read : q.read);
    });
    rows.sort(function (a, b) { return state.sort === "newest" ? b.createdMs - a.createdMs : a.createdMs - b.createdMs; });
    return rows;
  }

  function buildCard(q) {
    var li = el("li", "card" + (q.read ? " is-read" : "") + (state.fresh[q.id] ? " is-fresh" : ""));
    li.dataset.id = q.id;

    var meta = el("div", "card-meta");
    meta.appendChild(el("span", "who", q.name || "Anonymous"));
    if (q.to && q.to !== generic) meta.appendChild(el("span", "to", q.to));
    var t = el("time", "when");
    t.dateTime = new Date(q.createdMs).toISOString();
    t.dataset.ms = String(q.createdMs);
    t.appendChild(el("span", "clock", fmtTime(q.createdMs)));
    t.appendChild(el("span", "ago", ", " + ago(q.createdMs)));
    meta.appendChild(t);
    li.appendChild(meta);

    li.appendChild(el("p", "q", q.text));

    var actions = el("div", "actions");
    [
      ["read", q.read ? "Mark as new" : "Mark as read", "act act-read"],
      ["print", "Print", "act"],
      ["share", "Share", "act"],
      ["copy", "Copy", "act"],
      ["del", "Delete", "act act-del"]
    ].forEach(function (a) {
      var b = el("button", a[2], a[1]);
      b.type = "button";
      b.dataset.act = a[0];
      actions.appendChild(b);
    });
    li.appendChild(actions);
    return li;
  }

  function render() {
    var counts = { "new": 0, read: 0, all: state.list.length };
    state.list.forEach(function (q) { if (q.read) counts.read++; else counts["new"]++; });
    $("nNew").textContent = counts["new"];
    $("nRead").textContent = counts.read;
    $("nAll").textContent = counts.all;
    document.title = (counts["new"] ? "(" + counts["new"] + ") " : "") + "Question desk";

    // Keep keyboard focus on the same button after the list redraws.
    var keep = null, active = document.activeElement;
    if (active && listEl.contains(active) && active.dataset.act) {
      var c = active.closest(".card");
      if (c) keep = { id: c.dataset.id, act: active.dataset.act };
    }

    var rows = visibleRows();
    listEl.textContent = "";
    rows.forEach(function (q) { listEl.appendChild(buildCard(q)); });

    if (state.error) {
      $("emptyTitle").textContent = state.error.title;
      $("emptyBody").textContent = state.error.body;
      emptyEl.hidden = false;
    } else if (!rows.length) {
      var msg = {
        "new": ["No new questions", "They will appear here as soon as someone sends one."],
        read: ["Nothing marked as read yet", "Questions you mark as read move here."],
        all: ["No questions yet", "Open the big screen page so people can scan the code and send one."]
      }[state.filter];
      $("emptyTitle").textContent = msg[0];
      $("emptyBody").textContent = msg[1];
      emptyEl.hidden = false;
    } else {
      emptyEl.hidden = true;
    }

    if (keep) {
      var sel = '.card[data-id="' + (window.CSS && CSS.escape ? CSS.escape(keep.id) : keep.id) + '"] [data-act="' + keep.act + '"]';
      var target = listEl.querySelector(sel);
      if (target) target.focus();
    }
    state.fresh = {};
  }

  setInterval(function () {
    Array.prototype.forEach.call(listEl.querySelectorAll("time[data-ms]"), function (t) {
      t.querySelector(".ago").textContent = ", " + ago(parseInt(t.dataset.ms, 10));
    });
  }, 30000);

  /* ---------- toolbar ---------- */

  Array.prototype.forEach.call(document.querySelectorAll(".tabs button"), function (b) {
    b.addEventListener("click", function () {
      state.filter = b.dataset.filter;
      Array.prototype.forEach.call(document.querySelectorAll(".tabs button"), function (x) {
        x.setAttribute("aria-pressed", x === b ? "true" : "false");
      });
      render();
    });
  });

  $("sortBtn").addEventListener("click", function () {
    state.sort = state.sort === "newest" ? "oldest" : "newest";
    this.textContent = state.sort === "newest" ? "Newest first" : "Oldest first";
    render();
  });

  $("printList").addEventListener("click", function () {
    if (!listEl.children.length) { toast("Nothing to print in this view"); return; }
    printCards(null);
  });

  $("openSwitch").addEventListener("change", function () {
    var box = this, want = box.checked;
    QA.setOpen(want).catch(function () {
      box.checked = !want;
      toast("Could not change that setting");
    });
  });

  /* ---------- per-question actions ---------- */

  listEl.addEventListener("click", function (e) {
    var b = e.target.closest("[data-act]");
    if (!b) return;
    var card = b.closest(".card"), q = find(card.dataset.id);
    if (!q) return;

    switch (b.dataset.act) {
      case "read":
        QA.setRead(q.id, !q.read).catch(function () { toast("Could not update that question"); });
        break;
      case "print":
        printCards(card);
        break;
      case "share":
        share(q);
        break;
      case "copy":
        copyText(shareText(q)).then(function () { toast("Copied"); }, function () { toast("Could not copy"); });
        break;
      case "del":
        if (window.confirm("Delete this question? This cannot be undone.")) {
          QA.remove(q.id).catch(function () { toast("Could not delete that question"); });
        }
        break;
    }
  });

  function shareText(q) {
    var head = "Q&A question";
    if (q.to && q.to !== generic) head += " for " + q.to;
    if (q.name) head += " (from " + q.name + ")";
    return head + ":\n\n" + q.text;
  }

  function share(q) {
    var text = shareText(q);
    function fallback() {
      window.open("https://wa.me/?text=" + encodeURIComponent(text), "_blank", "noopener");
      toast("Opened WhatsApp");
    }
    if (navigator.share) {
      navigator.share({ title: "Q&A question", text: text }).catch(function (err) {
        if (err && err.name !== "AbortError") fallback();
      });
    } else {
      fallback();
    }
  }

  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text);
    return new Promise(function (resolve, reject) {
      var ta = document.createElement("textarea");
      ta.value = text;
      ta.style.cssText = "position:fixed;opacity:0";
      document.body.appendChild(ta);
      ta.select();
      var ok = false;
      try { ok = document.execCommand("copy"); } catch (err) { ok = false; }
      document.body.removeChild(ta);
      if (ok) resolve(); else reject();
    });
  }

  function printCards(card) {
    $("phSub").textContent = "Printed at " + fmtTime(Date.now());
    document.body.classList.add(card ? "print-one" : "print-list");
    if (card) card.classList.add("is-printing");
    function cleanup() {
      document.body.classList.remove("print-one", "print-list");
      Array.prototype.forEach.call(document.querySelectorAll(".is-printing"), function (n) { n.classList.remove("is-printing"); });
      window.removeEventListener("afterprint", cleanup);
    }
    window.addEventListener("afterprint", cleanup);
    setTimeout(function () { window.print(); }, 30);
  }
})();
