/**
 * Development environment.
 * Used by `ng serve` and `ng build --configuration development`
 * (swapped in via `fileReplacements` in angular.json).
 *
 * 👉 Change `apiUrl` here for local dev.
 *    - This Mac only:            'http://localhost:3000/'
 *    - Phone / other WiFi device: 'http://192.168.1.73:3000/'  (this Mac's LAN IP)
 *      then run: ng serve --host 0.0.0.0
 *    Must end with a trailing slash.
 */
export const environment = {
  production: false,
  apiUrl: 'http://localhost:3000/',
};
