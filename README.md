# SportZone App

SportZone is a booking and tournament management application built with Express and Capacitor for mobile support.

## Repository Structure

- `server.js` - Express server serving static frontend assets and API endpoints
- `public/` - Static web files used by the app
- `data/db.json` - Local JSON database
- `android/` - Capacitor Android project files
- `package.json` - Project dependencies and scripts

## Local Setup and Run

1. Install dependencies:

   ```bash
   npm install
   ```

2. Start the server:

   ```bash
   npm start
   ```

3. Open the app in your browser at:

   ```text
   http://localhost:3000
   ```

## Capacitor Commands

Use the existing Capacitor scripts for mobile support:

```bash
npm run cap:init
npm run cap:sync
npm run cap:add-android
npm run cap:run-android
```

> This repo is currently configured as a static web + Capacitor app, not a React app created with `create-react-app`.

## React Deployment to GitHub Pages (Optional Guidance)

If you add a React frontend to this project, use the following workflow to deploy it to GitHub Pages.

### 1. Push Your React Project to GitHub

In the frontend project folder:

```bash
git init
git add .
git commit -m "Initial frontend upload"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git push -u origin main
```

Replace `YOUR_USERNAME` and `YOUR_REPO` with your GitHub details.

### 2. Install GitHub Pages Package

```bash
npm install gh-pages --save-dev
```

### 3. Update `package.json`

Add the following fields:

```json
"homepage": "https://YOUR_USERNAME.github.io/YOUR_REPO",
"scripts": {
  "predeploy": "npm run build",
  "deploy": "gh-pages -d build"
}
```

### 4. Deploy to GitHub Pages

```bash
npm run deploy
```

This will:

- Build the React application
- Create a production build
- Upload the build to GitHub Pages

### 5. Enable GitHub Pages

1. Open your GitHub repository.
2. Go to `Settings` → `Pages`.
3. Under `Build and deployment`, choose `Source` → `Deploy from branch`.
4. Select the `gh-pages` branch.
5. Save.

### 6. Access the Live Application

Your app should be available at:

```text
https://YOUR_USERNAME.github.io/YOUR_REPO
```

### 7. Configure React Router for GitHub Pages

If you use React Router, replace:

```js
import { BrowserRouter } from 'react-router-dom';
```

with:

```js
import { HashRouter } from 'react-router-dom';
```

Then update:

```jsx
<BrowserRouter>
```

to:

```jsx
<HashRouter>
```

This helps prevent 404 errors on refresh or direct route access.

### 8. Rebuild and Redeploy

After router changes:

```bash
npm run build
npm run deploy
```

### 9. Verify Deployment

Confirm:

- Homepage loads
- Login works
- Refresh works
- Direct URL access works

Example URL:

```text
https://YOUR_USERNAME.github.io/YOUR_REPO/#/login
```

## Selenium E2E Testing Guidance

### Install Selenium Dependencies

```bash
npm install selenium-webdriver mocha --save-dev
```

### Create Test Structure

Recommended layout:

```text
frontend/
  selenium-tests/
    tests/
      login.test.js
  package.json
```

### Add Stable IDs for Automation

Add reliable IDs to UI elements, for example:

```html
<input id="email" />
<input id="password" />
<button id="login-button">Login</button>
```

### Run Selenium Tests Locally

Create a script in `package.json` and run it, for example:

```bash
npm run test:selenium
```

### GitHub Actions

Create a workflow file such as `.github/workflows/selenium-login.yml` to install dependencies, run tests, and report results.

### Automatic CI/CD Testing

Once configured, pushes to GitHub will trigger the workflow and verify deployment via Selenium.

## Notes

- This repository currently serves a static web frontend through an Express backend.
- If you want a full React deployment pipeline, create the React app separately or migrate this frontend to a React-based structure.
