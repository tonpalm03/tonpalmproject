# Merchant floating bubble

## Delivery

- Android-only, guarded by native plugin availability so older APKs and web browsers do not call a missing plugin.
- Starts the foreground service while the merchant screen is visible and overlay permission is granted. Native lifecycle events hide the overlay in the app and show it after leaving.
- Drag, snap to screen edge, saved position, pending-order count and tap to the authenticated `/merchant` screen.
- Closing the shop or leaving the merchant dashboard stops the service. Logging out unmounts that dashboard. Removing the app task stops the service; force-stop/process death is not treated as an always-running guarantee.
- Stop action in the service notification. Permission and running state are checked again on resume.
- Badge updates from the foreground Firestore subscription and the new `onOrderBadgeChanged` backend function. Backend sends absolute counts on status changes/deletes, with snapshot versions to reject older native messages. Normal-priority FCM can be delayed by Android power management; foreground data reconciles the count when reopening.

## Deployment requirements

The existing Capacitor configuration loads `https://tonpalmproject.web.app`. Installing the new APK alone does not publish the updated dashboard.

After reviewing the changes, publish Hosting and the new function together with distributing the APK:

```powershell
npm run build:android
firebase deploy --only hosting,functions:onOrderBadgeChanged
cd android
.\gradlew.bat assembleDebug
```

This task does not change production Firestore rules or existing order-notification payloads. The separate data-only badge messages are consumed by native code, without creating duplicate order alerts. The native messaging service forwards normal messages and token refreshes to Capacitor.

## Automated verification

```powershell
node --test functions/badge.test.cjs
npx eslint src/components/FloatingBubbleControl.tsx src/lib/floatingBubble.ts
npm run build:android
cd android
.\gradlew.bat assembleDebug lintDebug
```

## Device acceptance checks (not yet completed)

1. On Android 14–16, grant and deny overlay permission, then return to the app. Verify the switch reflects the result.
2. Enable with an open shop; press Home. Drag and snap the bubble on both edges and rotate the device.
3. Tap the bubble from both `/` and `/merchant`, including after changing dashboard tabs. Verify the orders tab opens and overlay hides.
4. Create an order on a separate client; accept/cancel from another client. Verify the count increases/decreases without opening the merchant app, allowing for FCM delivery delays.
5. Close the shop, disable the switch, log out, stop from the notification, revoke overlay permission, remove the task, and force-stop. Verify no unwanted restart or crash.
6. Test weak network, notification permission denied, screen lock, and battery saver. Confirm existing FCM order notifications still work.
7. Install an older APK against updated Hosting and confirm the bubble control is hidden.
8. Verify the storefront image fixes on-device: landscape/portrait images, rotation + drag, save failure + retry, and replacing a previously broken image.

The generated APK is a debug build for testing, not a signed production release.
