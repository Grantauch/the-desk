# Robber Barons online play: one-time setup

Robber Barons works two ways:

- **Pass and play** on one Chromebook. This works with no setup.
- **Separate Chromebooks.** One Chromebook hosts a game and gets a 4-letter code. Everyone else opens the game, types the code, takes a baron, and plays from their own screen. This mode needs a free Firebase project to relay the moves between Chromebooks. You set it up once.

Until the setup is done, the Host and Join buttons say that online play is not switched on yet, and pass and play keeps working.

## 1. Create the Firebase project

1. Go to <https://console.firebase.google.com> and sign in with a personal Google account. School Google accounts often block Firebase.
2. Click **Create a project**, name it something like `robber-barons`, and turn Google Analytics off. You do not need it.

## 2. Turn on anonymous sign-in

Students do not sign in with a Google account or an email address. Each Chromebook gets an anonymous ID so the database can tell whose turn it is.

1. In the left menu, open **Build > Authentication** and click **Get started**.
2. Open the **Sign-in method** tab, choose **Anonymous**, switch it on, and click **Save**.

## 3. Create the database and paste the rules

1. Open **Build > Realtime Database** and click **Create database**. Pick the United States location and **Start in locked mode**.
2. Open the **Rules** tab. Delete everything in the box, paste the whole contents of `docs/robber-barons-online/database.rules.json`, and click **Publish**.

The rules make sure that only players in a game can change it, that nobody can list every game, and that each move has to build on the latest board.

When this rules file changes, paste it again and click **Publish**. The October 2026 update opened seats five through eight, so games with more than four players need the new rules.

## 4. Copy the settings into the site

1. Click the gear next to **Project overview**, then **Project settings**.
2. Under **Your apps**, click the web icon `</>`. Give the app a nickname, leave Firebase Hosting unchecked, and click **Register app**.
3. Firebase shows a `firebaseConfig` block. Copy the values for `apiKey`, `authDomain`, `databaseURL`, `projectId` and `appId` into `public/hubs/robber-barons-firebase.js`, between the quotes.
   - If `databaseURL` is missing from the block, copy it from the top of the Realtime Database page. It looks like `https://robber-barons-xxxxx-default-rtdb.firebaseio.com`.
4. Commit and push. After Netlify rebuilds, open the game and click **Host a game** to check it.

These values are not passwords. They are meant to sit in a web page, and the rules from step 3 do the protecting.

## What gets stored, and for how long

- The first name or nickname each student types (16 characters at most), which baron they picked, and the game itself: cash, businesses, dice rolls and the game log.
- No emails, no Google accounts, no grades and no rosters.
- A game is deleted one day after it starts. The deletion happens the next time anyone hosts a game.

## Free plan limits

The free Spark plan allows 100 Chromebooks connected at the same time and 10 GB of downloads a month. A full game between four players uses a few megabytes in total, so a class playing every period stays far inside the free plan.

## If something goes wrong

- **"Could not reach the game server."** The school network may be blocking `firebaseio.com` or `www.gstatic.com`. Ask the tech office to allow both.
- **"Anonymous sign-in is turned off."** Go back to step 2.
- **A Chromebook dies or refreshes mid-game.** Open the game again. The code is already filled in, so press **Join** and the student lands back in their seat. On a different Chromebook, press Join and tap **I am (their name)**.
- **A student leaves and the game is stuck on their turn.** Anyone can join from another Chromebook and tap **I am (their name)** to take over that seat.
- **The projector.** Host from the teacher computer without taking a baron. That screen shows the whole board, and only the host can pause the clock or end the game early.
