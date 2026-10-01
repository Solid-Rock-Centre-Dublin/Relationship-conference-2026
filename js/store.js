/*
  Data layer shared by all three pages.

  Firebase mode: talks to Firestore (questions) and Firebase Auth (moderator login).
  Preview mode:  used automatically while js/config.js still has PASTE_ values.
                 Everything is kept in this browser's localStorage so the pages
                 can be tried without any setup.

  Exposes window.QA.
*/
(function () {
  "use strict";

  var C = window.QA_CONFIG || {};
  var FB = C.firebase || {};
  var FB_VERSION = "10.14.1";
  var BASE = "https://www.gstatic.com/firebasejs/" + FB_VERSION + "/";
  var preview = !FB.apiKey || !FB.projectId || /PASTE/i.test(String(FB.apiKey) + String(FB.projectId));

  var QA = { mode: preview ? "preview" : "firebase", config: C };
  window.QA = QA;

  /* ---------- helpers ---------- */

  QA.cleanLine = function (s, max) {
    return String(s == null ? "" : s).replace(/\s+/g, " ").trim().slice(0, max);
  };

  QA.cleanText = function (s, max) {
    return String(s == null ? "" : s)
      .replace(/\r\n?/g, "\n")
      .replace(/[ \t]+/g, " ")
      .replace(/ ?\n ?/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
      .slice(0, max);
  };

  function normalise(id, d) {
    var t = d.createdAt, ms;
    if (t && typeof t.toMillis === "function") ms = t.toMillis();
    else if (typeof t === "number") ms = t;
    else ms = Date.now();
    return { id: id, text: d.text || "", name: d.name || "", to: d.to || "", read: !!d.read, createdMs: ms };
  }

  function newestFirst(list) {
    return list.slice().sort(function (a, b) { return b.createdMs - a.createdMs; });
  }

  /* ---------- preview mode (localStorage) ---------- */

  if (preview) {
    var KQ = "qa-preview-questions", KO = "qa-preview-open", KU = "qa-preview-user";
    var qSubs = [], oSubs = [], aSubs = [];

    var load = function (key, fallback) {
      try {
        var v = JSON.parse(localStorage.getItem(key));
        return v == null ? fallback : v;
      } catch (e) { return fallback; }
    };
    var save = function (key, val) {
      try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) { /* storage full or blocked */ }
    };
    var emitQ = function () { var l = newestFirst(load(KQ, [])); qSubs.forEach(function (f) { f(l); }); };
    var emitO = function () { var o = load(KO, true) !== false; oSubs.forEach(function (f) { f(o); }); };
    var emitA = function () { var u = load(KU, null); aSubs.forEach(function (f) { f(u); }); };

    window.addEventListener("storage", function (e) {
      if (e.key === KQ) emitQ();
      if (e.key === KO) emitO();
      if (e.key === KU) emitA();
    });

    var sub = function (list, cb, emit) {
      list.push(cb);
      setTimeout(emit, 0);
      return function () { var i = list.indexOf(cb); if (i > -1) list.splice(i, 1); };
    };

    QA.submit = function (q) {
      return new Promise(function (resolve, reject) {
        if (load(KO, true) === false) return reject({ code: "permission-denied" });
        var list = load(KQ, []);
        list.push({
          id: "p" + Date.now() + Math.random().toString(36).slice(2, 6),
          text: q.text, name: q.name, to: q.to, read: false, createdMs: Date.now()
        });
        save(KQ, list);
        emitQ();
        resolve();
      });
    };
    QA.onQuestions = function (cb) { return sub(qSubs, cb, emitQ); };
    QA.setRead = function (id, read) {
      var list = load(KQ, []);
      list.forEach(function (q) { if (q.id === id) q.read = !!read; });
      save(KQ, list); emitQ();
      return Promise.resolve();
    };
    QA.remove = function (id) {
      save(KQ, load(KQ, []).filter(function (q) { return q.id !== id; })); emitQ();
      return Promise.resolve();
    };
    QA.onOpen = function (cb) { return sub(oSubs, cb, emitO); };
    QA.setOpen = function (open) { save(KO, !!open); emitO(); return Promise.resolve(); };

    QA.auth = {
      onChange: function (cb) { return sub(aSubs, cb, emitA); },
      signIn: function (email, pw) {
        return new Promise(function (resolve, reject) {
          if (pw === "demo" && email) { save(KU, { email: email }); emitA(); resolve(); }
          else reject({ code: "auth/invalid-credential" });
        });
      },
      signOut: function () { try { localStorage.removeItem(KU); } catch (e) {} emitA(); return Promise.resolve(); }
    };
  }

  /* ---------- Firebase mode ---------- */

  if (!preview) {
    var fbP = null, authP = null;

    var fb = function () {
      if (!fbP) {
        fbP = Promise.all([import(BASE + "firebase-app.js"), import(BASE + "firebase-firestore.js")]).then(function (mods) {
          var app = mods[0].initializeApp(FB);
          var fs = mods[1];
          // Long polling auto-detect helps on venue Wi-Fi and networks that block websockets.
          var db = fs.initializeFirestore(app, { experimentalAutoDetectLongPolling: true });
          return { app: app, fs: fs, db: db };
        });
      }
      return fbP;
    };

    var authMod = function () {
      if (!authP) {
        authP = fb().then(function (f) {
          return import(BASE + "firebase-auth.js").then(function (m) { return { m: m, auth: m.getAuth(f.app) }; });
        });
      }
      return authP;
    };

    // Runs an async subscribe function and returns a synchronous unsubscribe.
    var subscribeLater = function (start) {
      var dead = false, stop = function () {};
      start().then(function (unsub) { if (dead) unsub(); else stop = unsub; });
      return function () { dead = true; stop(); };
    };

    QA.submit = function (q) {
      return fb().then(function (f) {
        return f.fs.addDoc(f.fs.collection(f.db, "questions"), {
          text: q.text, name: q.name, to: q.to, read: false, createdAt: f.fs.serverTimestamp()
        });
      });
    };

    QA.onQuestions = function (cb, onError) {
      return subscribeLater(function () {
        return fb().then(function (f) {
          var qy = f.fs.query(f.fs.collection(f.db, "questions"), f.fs.orderBy("createdAt", "desc"), f.fs.limit(500));
          return f.fs.onSnapshot(qy, function (snap) {
            cb(snap.docs.map(function (d) { return normalise(d.id, d.data({ serverTimestamps: "estimate" })); }));
          }, function (err) { if (onError) onError(err); });
        }).catch(function (err) { if (onError) onError(err); return function () {}; });
      });
    };

    QA.setRead = function (id, read) {
      return fb().then(function (f) { return f.fs.updateDoc(f.fs.doc(f.db, "questions", id), { read: !!read }); });
    };
    QA.remove = function (id) {
      return fb().then(function (f) { return f.fs.deleteDoc(f.fs.doc(f.db, "questions", id)); });
    };

    QA.onOpen = function (cb) {
      return subscribeLater(function () {
        return fb().then(function (f) {
          return f.fs.onSnapshot(f.fs.doc(f.db, "settings", "qa"), function (snap) {
            cb(!snap.exists() || snap.data().open !== false);
          }, function () { cb(true); });
        }).catch(function () { cb(true); return function () {}; });
      });
    };
    QA.setOpen = function (open) {
      return fb().then(function (f) { return f.fs.setDoc(f.fs.doc(f.db, "settings", "qa"), { open: !!open }); });
    };

    QA.auth = {
      onChange: function (cb) {
        return subscribeLater(function () {
          return authMod().then(function (a) {
            return a.m.onAuthStateChanged(a.auth, function (u) { cb(u ? { email: u.email } : null); });
          }).catch(function (err) { cb(null, err); return function () {}; });
        });
      },
      signIn: function (email, pw) {
        return authMod().then(function (a) { return a.m.signInWithEmailAndPassword(a.auth, email, pw); });
      },
      signOut: function () {
        return authMod().then(function (a) { return a.m.signOut(a.auth); });
      }
    };
  }
})();
