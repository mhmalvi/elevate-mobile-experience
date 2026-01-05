# iOS Resources

This directory contains resources required for iOS app builds.

## Privacy Manifest (PrivacyInfo.xcprivacy)

**Required by Apple for App Store submission (iOS 17+)**

The Privacy Manifest declares:
- What privacy-sensitive data the app collects
- What required reason APIs the app uses
- Whether the app performs tracking

### Integration Steps

When building the iOS app with Capacitor:

1. **Generate iOS project** (if not already done):
   ```bash
   npx cap add ios
   ```

2. **Copy Privacy Manifest to iOS project**:
   ```bash
   cp ios-resources/PrivacyInfo.xcprivacy ios/App/App/PrivacyInfo.xcprivacy
   ```

3. **Add to Xcode project**:
   - Open `ios/App/App.xcodeproj` in Xcode
   - Right-click on the `App` folder in Project Navigator
   - Select "Add Files to App"
   - Select `PrivacyInfo.xcprivacy`
   - Ensure "Copy items if needed" is checked
   - Click "Add"

4. **Verify** the file appears in:
   - Project Navigator under the `App` folder
   - Build Phases > Copy Bundle Resources

### What's Declared

**Data Collected:**
- Email Address (for user accounts)
- Name (for business profile)
- Phone Number (for client management)
- Physical Address (for job sites)
- Payment Info (for Stripe integration)
- User Content (quotes, invoices, job data)
- Product Interaction (usage analytics)

**API Usage:**
- File timestamp APIs (for offline sync)
- User defaults (for app settings)
- Disk space (for offline storage)
- System boot time (for time measurements)

**Tracking:**
- NO tracking performed
- NO data sold to third parties
- NO tracking domains

### Updates Required

Update this manifest if you:
- Add new data collection
- Integrate new third-party SDKs
- Use new required reason APIs
- Enable tracking features

### Resources

- [Apple Privacy Manifest Documentation](https://developer.apple.com/documentation/bundleresources/privacy_manifest_files)
- [Required Reason API Reference](https://developer.apple.com/documentation/bundleresources/privacy_manifest_files/describing_use_of_required_reason_api)
- [Privacy Nutrition Labels](https://developer.apple.com/app-store/app-privacy-details/)
