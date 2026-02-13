# Android CI/CD Setup Guide

This document explains how to configure GitHub Actions for building, testing, and releasing your Android application automatically.

## Prerequisites

- **Java JDK 17** (Standard for recent Android Gradle builds)
- **Node.js 20+** (For Capacitor)
- **GitHub Repository Access** (Admin permissions to add secrets)

## Step 1: Generate a Release Keystore

If you don't have a release keystore yet, generate one locally using `keytool` (installed with JDK or Android Studio):

```bash
keytool -genkey -v -keystore release.keystore -alias my-key-alias -keyalg RSA -keysize 2048 -validity 10000
```
- **Password:** Create a strong password (remember it!).
- **Alias:** Choose an alias (e.g., `tradiemate-release`).
- **Validity:** 10000 days (~27 years).
- **Location:** This creates `release.keystore` in your current directory. **DO NOT commit this file to Git.**

## Step 2: Encode Keystore to Base64

GitHub Secrets cannot store binary files directly. You must encode the keystore file to a Base64 string.

**On Mac/Linux:**
```bash
base64 -i release.keystore > release_keystore_base64.txt
```

**On Windows (PowerShell):**
```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("path\to\release.keystore")) | Out-File "release_keystore_base64.txt"
```
Copy the content of `release_keystore_base64.txt`. This is your `ANDROID_KEYSTORE_BASE64` secret.

## Step 3: Add GitHub Secrets

Go to your repository on GitHub:
1.  **Settings** > **Secrets and variables** > **Actions**
2.  Click **New repository secret**
3.  Add the following secrets:

| Name | Value |
| :--- | :--- |
| `ANDROID_KEYSTORE_BASE64` | The content of the base64 encoded keystore file. |
| `ANDROID_KEYSTORE_PASSWORD` | The password you set for the keystore. |
| `ANDROID_KEY_ALIAS` | The alias you used (e.g., `tradiemate-release`). |
| `ANDROID_KEY_PASSWORD` | The password for the key (usually same as keystore password). |

## How the Workflows Work

### 1. **Android CI (`android-ci.yml`)**
- **Triggers:** On every push and pull request to `main`.
- **Actions:**
  - Installs dependencies.
  - Runs lint checks (`npm run lint`).
  - Runs unit tests (`npm run test:run`).
  - Builds a **Debug APK** to verify the build process works.
  - Uploads the debug APK as an artifact.

### 2. **Build Android Release (`android-release.yml`)**
- **Triggers:** Manually via the **Actions** tab -> **Run workflow**.
- **Inputs:**
  - `Version Name` (e.g., `1.0.0`)
  - `Version Code` (e.g., `10`)
- **Actions:**
  - Decodes the release keystore from secrets.
  - Runs a full release build (`./gradlew bundleRelease`).
  - Signs the app using the keystore and secrets.
  - Uploads the signed **Release AAB** (App Bundle) and **Release APK** as artifacts.
  - You can download these artifacts and upload them manually to the Google Play Console.

## Troubleshooting

- **Build Fails on Keystore:** Ensure the base64 string is copied correctly without newlines or extra spaces.
- **Lint Errors:** Review the lint report or run `npm run lint` locally to fix issues.
- **Gradle Errors:** Check the "Build Release Bundle" step logs for specific Gradle error messages.
