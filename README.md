# Q&A wall

Audience members scan a QR code on the big screen, type a question on their phone and press send. The question appears instantly on your question desk, where you can mark it as read, print it or save it as a PDF, or forward it to whoever is reading the questions out.

It is built for **Before & After You Say "I Do"** at Solid Rock Centre Dublin, in the flyer's colours with the church logo as a watermark.

## The three pages

| Page | Who uses it | What it does |
| --- | --- | --- |
| `index.html` | The audience | The form they reach after scanning. Question, who it is for, optional name. |
| `screen.html` | The big screen | Shows the QR code, sized for a projector. Press **F** for fullscreen. |
| `moderator.html` | You and the team | Password protected live inbox. Mark as read, Print, Share, Copy, Delete, and an on/off switch for new questions. |

## How the pieces fit together

Two free services, no server and no extra connector program:

- **GitHub Pages** hosts the three pages.
- **Firebase** is the connector. Firestore stores the questions and pushes new ones to your desk the moment they arrive. Firebase Authentication keeps the desk behind your login.

Security rules (`firestore.rules`) let anyone add a short question but only your listed emails read, change or delete them. Audience members cannot see each other's questions.

## Try it first (no setup)

Until you paste your Firebase details into `js/config.js`, every page runs in **preview mode**. Questions stay in the current browser only, and you sign in to the desk with any email and the password `demo`. Serve the folder locally to try it:

```
cd qa-wall
python3 -m http.server 8000
```

Then open `http://localhost:8000/`. Preview mode is for looking around only. Phones cannot reach it, so you must complete the setup below before the event.

## Setup (about 15 minutes)

### 1. Create a Firebase project
1. Go to [console.firebase.google.com](https://console.firebase.google.com) and sign in with a Google account.
2. Choose **Create a project**, give it a name (for example `solid-rock-qa`) and continue. You can turn Google Analytics off.

### 2. Turn on the database
1. In the left menu open **Build**, then **Firestore Database**, then **Create database**.
2. Pick a location in Europe. This cannot be changed later.
3. Choose **Production mode**. The next steps replace the rules.

### 3. Turn on login and create your account
1. Open **Build**, then **Authentication**, then **Get started**.
2. Under **Sign-in method** choose **Email/Password** and enable it.
3. Open the **Users** tab and choose **Add user**. Enter the email and a strong password you will use on the question desk. Write the email in lowercase.

### 4. Connect the pages to your project
1. Click the gear icon, then **Project settings**.
2. Under **Your apps** choose the web icon `</>`. Give the app a nickname and register it. Skip the Firebase Hosting option.
3. Firebase shows a block called `firebaseConfig`. Copy the values for `apiKey`, `authDomain`, `projectId` and `appId` into `js/config.js`, replacing the `PASTE_...` text.

These values are meant to be public. Your data is protected by the rules in the next step, not by hiding the key.

### 5. Publish the security rules
1. Open `firestore.rules` and replace `you@example.com` with the email from step 3. To give a second person access, add a comma and a second email inside the brackets.
2. In Firebase go to **Firestore Database**, open the **Rules** tab, paste the whole file and press **Publish**.

### 6. Put the site on GitHub Pages
1. On [github.com](https://github.com) create a new **public** repository, for example `qa-wall`.
2. Choose **Add file**, then **Upload files**, and drag in everything from this folder, keeping the `css`, `js` and `assets` folders. Commit.
3. Open **Settings**, then **Pages**. Under **Build and deployment** choose **Deploy from a branch**, pick the `main` branch and the `/ (root)` folder, and save.
4. After a minute or two the site is live at `https://YOUR-USERNAME.github.io/qa-wall/`.

### 7. Allow your site to sign in
In Firebase open **Authentication**, then **Settings**, then **Authorized domains**, and add `YOUR-USERNAME.github.io`.

### 8. Test it end to end
1. Open `https://YOUR-USERNAME.github.io/qa-wall/` on your phone and send a question.
2. Open `.../moderator.html` on a laptop, sign in, and check it arrived.
3. Open `.../screen.html` and scan the code with your phone to confirm it opens the form.
4. Delete your test questions from the desk before the event.

## On the night

1. **Big screen:** open `screen.html` on the AV computer, press **F** for fullscreen (or use the button that appears when you move the mouse).
2. **Question desk:** sign in on a laptop or phone and keep the tab open. New questions slide in at the top and the tab title shows how many are unread.
3. **Reading out:** use **Share** to send a question to the reader on WhatsApp or by message. Use **Print** to print one question, or **Print list** to print everything in the current view. In the print dialog choose **Save as PDF** if you want a file instead.
4. **Keeping track:** **Mark as read** moves a question to the Read tab. **Oldest first** sorts the queue in the order questions arrived.
5. **Closing:** switch off **Accepting questions** when the Q&A ends. The big screen and anyone with the form open will show that questions are closed.

## Make it yours

- **Event details, recipients and limits:** edit `js/config.js`. The "Who is it for?" choices come from `recipients`.
- **Short link:** the QR code opens whatever address the site is served from. For a tidier line on screen, create a short link (for example with TinyURL) and set both `submitUrl` and `displayUrl` in `js/config.js` to it.
- **Colours:** the palette is at the top of `css/style.css`.

## If something looks wrong

| What you see | What to check |
| --- | --- |
| Desk says "This account cannot read questions" | The email you signed in with must be in `firestore.rules`, and the rules must be published. |
| Form says "Questions are closed" but the desk switch is on | The rules were not published, or they were changed. Publish `firestore.rules` again. |
| Everything works but questions vanish after a refresh | `js/config.js` still has `PASTE_` values, so the pages are in preview mode. |
| Sign in fails with the right password | Confirm the user exists under Authentication, then Users, and the domain is in Authorized domains. |
| Phones cannot open the page | Check the address and the Pages setting. Wait a couple of minutes after the first publish. |

## Notes

- Names are optional. Questions are visible only to the emails listed in `firestore.rules`.
- Fonts (Anton, Montserrat, Playfair Display) load from Google Fonts. If they cannot load, the pages fall back to system fonts and still work.
- The QR code is generated in the browser by `js/qr.js`, so it needs no outside library.
- The free Firebase plan is far more than one event needs.
