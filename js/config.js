/*
  Settings for the Q&A wall. This is the only file you need to edit.

  1. Paste your Firebase web app details below (see README.md, step 4).
  2. Change the event details if you reuse this for another event.

  While the Firebase values still say PASTE_..., the pages run in preview mode:
  questions stay in the current browser only, so you can try everything without
  setting anything up.
*/
window.QA_CONFIG = {
  firebase: {
    apiKey: "AIzaSyCB3cZrgZKenFLBhawQZCZdaU74GuWI6qk",
    authDomain: "srrc-2026.firebaseapp.com",
    projectId: "srrc-2026",
    appId: "1:977996790367:web:cb2303274fb2655570f9ea"
  },

  event: {
    org: "Solid Rock Centre Dublin",
    kicker: "Relationship conference",
    title: "Before & After You Say “I Do”",
    when: "Fri 2 Oct at 7PM"
  },

  // Choices shown under "Who is it for?". Keep "Anyone" first.
  recipients: ["Anyone", "Emmanuel & Evelyn Might", "Dr. David Burrows"],

  // Longest question allowed, in characters. Must match firestore.rules (500 max).
  maxLength: 400,

  // Stops one phone from sending questions back to back.
  minSecondsBetweenQuestions: 10,

  // Leave both empty to detect them automatically from where the site is hosted.
  // submitUrl: the address the QR code opens.
  // displayUrl: the text shown under the QR code on the big screen.
  submitUrl: "",
  displayUrl: ""
};
