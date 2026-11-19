# AGE Capital Structure App

**FIN 4150 · Capital Structure**

You will use Claude Code to build a web app for the AGE case. It reads Campus Deli and Sub Shop's (CDSS's) figures and a banker's estimates of its borrowing costs, then works out what each amount of borrowing does to CDSS's share price, earnings per share (EPS), times interest earned (TIE) and cost of capital. It also shows the case's Firm U and Firm L example, and it has levers you can move. You then publish it with GitHub Pages, so it installs on your phone or laptop like any other app. A web app that installs this way is called a progressive web app (PWA).

Fill in section 1 of the case worksheet by hand before you start. You will check the app against it.

## What's in this repository

| File | What it is |
|---|---|
| `case/AGE_Case.md` | The case |
| `data/cdss.csv` | CDSS's operations, book balance sheet and market data. The `section` column says which. |
| `data/assumptions.csv` | The 40% tax rate |
| `data/banker_schedule.csv` | The banker's cost of debt and cost of equity at each amount of borrowing |
| `data/example_firms.csv` | Firm U and Firm L's assets, Firm L's debt and interest rate, and the range for the Firm L slider |
| `data/ebit_scenarios.csv` | The EBIT probability distribution for Firm U and Firm L |
| `data/banker_schedule_riskier.csv` | A made-up schedule for testing Part F. It is not part of the AGE case. |
| `icons/` | The app's icons |
| `CLAUDE.md` | Instructions Claude reads at the start of every session. Read it so you know how Claude has been told to work with you. |

## Part A: By hand first (no AI)

Fill in section 1 of the case worksheet: Firm L's income statements and ratios from question c(1), and CDSS's shares remaining, EPS, TIE, share price and WACC from questions d(3) to d(7). A calculator is fine. Keep the worksheet next to you, because Claude will ask for your numbers.

## Part B: Build the calculator (20 minutes)

Start a Claude Code session on your repository and paste this prompt:

> Read CLAUDE.md, README.md and case/AGE_Case.md. Build the first version of the app: a page that reads the files in data/ and shows Firm U and Firm L's table from question c, and, for each amount of borrowing in the banker's schedule, CDSS's shares repurchased, shares remaining, EPS, TIE, share price and WACC, first with the case's $20 buyback and then with buying back at the new price. Walk me through it.

Then:

- When Claude asks for your section 1 numbers, give them. If yours don't match Claude's, figure out who is right and why. Rounding counts.
- Check one number yourself with a calculator: the share price with $250,000 of debt under the case's $20 buyback. Type it in one go, without rounding along the way: (500,000 − 0.10 × 250,000) × (1 − 0.40) / (100,000 − 250,000 / 20) / 0.155. It should match the app. If it doesn't match your worksheet, figure out why.

## Part C: Add the levers (20 minutes)

Write your own prompt asking Claude to add two sliders and some buttons.

1. **CDSS's debt.** It stops only at the banker's amounts. When it moves, the app shows, for the case's $20 buyback and for buying back at the new price:
   - the share price, shares repurchased and shares remaining
   - EPS, dividends per share and TIE
   - WACC (book weights with the $20 buyback, market weights with the new price)
   - management's share of the company
2. **Firm L's debt.** When it moves, the app shows Firm L's ROE and TIE in each kind of year, its expected ROE, standard deviation of ROE, coefficient of variation, expected TIE and standard deviation of TIE, next to Firm U.
3. Add a **Best price** button that sets CDSS's debt to the amount with the highest share price, a **Highest EPS** button, and a **Case** button that sets Firm L's debt back to $10,000.

You can't open the app until Part D publishes it, so ask Claude to show you in chat what the page shows after **Best price** and after **Highest EPS**. The share price should match your worksheet. You'll click the buttons yourself after Part D.

## Part D: Make it installable and publish it (15 minutes)

1. Paste this prompt: "Make this a progressive web app. Add a web app manifest that uses the icons in icons/ and a service worker so it installs and works offline. Then commit and push."
2. In the **Changes** card beside the chat, click the line counts (like `+120 -0`) to see every change Claude made. Read through it.
3. Click **Create PR**. On GitHub, open your repository's **Pull requests** tab and open the new pull request. Click **Merge pull request**, then **Confirm merge**.
4. On GitHub, go to your repository's **Settings**, then **Pages**. Under **Build and deployment**, set **Source** to **Deploy from a branch**, choose **main** and **/ (root)**, and click **Save**.
5. Wait a few minutes and refresh the Pages screen. Your app's address appears at the top. It looks like `https://your-username.github.io/capital-structure-lab-starter/`.

   If the address doesn't appear, open your repository's **Actions** tab and look for a run called **pages build and deployment**. If there's no such run after a few minutes, go back to **Settings**, then **Pages**. Set the branch to **None** and click **Save**. Then choose **main** and **/ (root)** again and click **Save**. When the run in the **Actions** tab has a green check, refresh the Pages screen.
6. Open the address and install the app. In Chrome or Edge, click the install icon in the address bar. On an iPhone, tap Share, then **Add to Home Screen**.

## Part E: Use the levers (10 minutes)

Fill in section 2 of the case worksheet and answer the memo questions in the Canvas assignment. Every answer should cite a number from the app or your worksheet.

## Part F (optional): A more cautious banker

Ask Claude to add a button that loads a different banker's schedule from your device. The file must be read in the browser and never uploaded. Test it with `data/banker_schedule_riskier.csv`, a made-up schedule from a banker who sees more risk at every amount of debt and won't lend $1,000,000. Which amount of borrowing gives the highest share price now, and why did it move? Record your answers in section 3 of the worksheet.

Part D already merged your first pull request. To get this change onto your live app, click **Create PR** again and merge the new pull request.

## Submit

In the Canvas assignment, paste your app's address, your repository's address and your memo, and upload your worksheet.
