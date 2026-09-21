# Krishnamargam — Android app shell

This is a [Capacitor](https://capacitorjs.com) native wrapper around the live
site at https://srikrishnamargam.in. It does **not** bundle a static copy of
the Next.js app — the Next.js app has SSR pages, API routes and Supabase
cookie auth that can't be statically exported, so the native WebView just
loads the production URL directly (see `capacitor.config.ts` at the repo
root). `mobile-shell/index.html` is only a brief loading screen shown before
the WebView finishes connecting.

Because there is no local Android SDK/JDK required for day-to-day changes to
the site (the app always reflects whatever is live on srikrishnamargam.in),
you generally don't need to rebuild the APK when the website changes — only
when you change native-shell things: the app id, name, icon, splash screen,
permissions, or the Capacitor config itself.

## Getting an installable APK

No local Android Studio/JDK setup needed — GitHub Actions builds it:

1. Push changes (or use the "Run workflow" button) to trigger
   `.github/workflows/android-apk.yml`.
2. Open the workflow run in the GitHub Actions tab, download the
   `krishnamargam-debug-apk` artifact (a zip containing `app-debug.apk`).
3. Transfer the APK to an Android phone (email, Drive, USB, etc.), open it,
   and allow "Install unknown apps" for that source when prompted.

This produces a debug-signed APK, which is fine for sideloading to yourself
or testers. It is **not** suitable for the Play Store — that needs a release
build signed with a real keystore, which is a later step once you're ready
to publish.

## Updating the icon/splash screen

Source images live in `/assets` (`icon.png`, `splash.png`) at the repo root.
Regenerate all Android densities after changing them:

```
npx @capacitor/assets generate --android \
  --iconBackgroundColor '#1a0f00' --iconBackgroundColorDark '#1a0f00' \
  --splashBackgroundColor '#1a0f00' --splashBackgroundColorDark '#1a0f00'
```

## Local development (requires Android Studio)

If you install Android Studio (which bundles a JDK) you can also build/run
locally:

```
npx cap sync android
npx cap open android   # opens the project in Android Studio
```

## iOS

Not set up yet — sideloading an iOS build requires a paid Apple Developer
account (TestFlight or ad-hoc distribution; there's no free equivalent of
an Android APK install). Add it later with `npx cap add ios` once that's in
place.
