/**
 * Auto-updater module for Pegasus Agents.
 * Privacy-first: the ONLY network call is checking GitHub Releases for a new version.
 * No telemetry, no crash reporting, no analytics.
 */

const { autoUpdater } = require('electron-updater');
const { dialog, BrowserWindow } = require('electron');

function initAutoUpdater() {
  // ── Privacy settings ──
  autoUpdater.autoDownload = false;          // Don't download without user consent
  autoUpdater.autoInstallOnAppQuit = true;   // Install pending update on next quit
  autoUpdater.disableWebInstaller = true;    // No NSIS web installer fallback

  // ── Event handlers ──

  autoUpdater.on('error', (err) => {
    // Silent — don't bother user if update check fails (offline, etc.)
    console.log('[Updater] Error:', err.message);
  });

  autoUpdater.on('checking-for-update', () => {
    console.log('[Updater] Checking for updates...');
  });

  autoUpdater.on('update-not-available', () => {
    console.log('[Updater] App is up to date.');
  });

  autoUpdater.on('update-available', (info) => {
    console.log('[Updater] Update available:', info.version);

    const win = BrowserWindow.getFocusedWindow();
    dialog.showMessageBox(win, {
      type: 'info',
      title: 'Update Available',
      message: `Pegasus Agents v${info.version} is available.`,
      detail: 'Would you like to download it now? The update will be installed when you next close the app.',
      buttons: ['Download', 'Later'],
      defaultId: 0,
      cancelId: 1,
    }).then((result) => {
      if (result.response === 0) {
        autoUpdater.downloadUpdate();
      }
    });
  });

  autoUpdater.on('download-progress', (progress) => {
    console.log(`[Updater] Download: ${Math.round(progress.percent)}%`);
  });

  autoUpdater.on('update-downloaded', (info) => {
    console.log('[Updater] Update downloaded:', info.version);

    const win = BrowserWindow.getFocusedWindow();
    dialog.showMessageBox(win, {
      type: 'info',
      title: 'Update Ready',
      message: `Pegasus Agents v${info.version} has been downloaded.`,
      detail: 'The update will be installed when you close the app. Restart now?',
      buttons: ['Restart Now', 'Later'],
      defaultId: 0,
      cancelId: 1,
    }).then((result) => {
      if (result.response === 0) {
        autoUpdater.quitAndInstall();
      }
    });
  });

  // ── Check once on launch (5s delay so window loads first) ──
  setTimeout(() => {
    autoUpdater.checkForUpdates().catch((err) => {
      console.log('[Updater] Check failed:', err.message);
    });
  }, 5000);
}

module.exports = { initAutoUpdater };
