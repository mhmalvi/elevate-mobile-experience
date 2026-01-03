# iOS Configuration Files

This directory contains configuration files required for iOS App Store submission.

## Privacy Manifest (PrivacyInfo.xcprivacy)

**Required:** Yes (Apple Privacy Manifest 2.0 requirement)
**When:** Before App Store submission

### Installation Steps

1. **Generate iOS project** (if not already done):
   ```bash
   npx cap add ios
   ```

2. **Copy Privacy Manifest**:
   ```bash
   cp ios-config/PrivacyInfo.xcprivacy ios/App/App/PrivacyInfo.xcprivacy
   ```

3. **Add to Xcode project**:
   - Open `ios/App/App.xcworkspace` in Xcode
   - Right-click on the "App" folder in Project Navigator
   - Select "Add Files to App..."
   - Select `PrivacyInfo.xcprivacy`
   - Ensure "Copy items if needed" is checked
   - Click "Add"

4. **Verify installation**:
   - File should appear in Xcode under App folder
   - Build the project to ensure no errors
   - Privacy manifest will be included in app bundle

### What This Declares

The privacy manifest declares:

**Data Collected:**
- Email address (authentication)
- Name, phone, address (client/user management)
- Financial information (invoices, quotes)
- User ID (authentication)

**API Usage:**
- UserDefaults (CA92.1) - Store preferences and auth tokens
- File Timestamps (0A2A.1) - Offline sync functionality
- Disk Space (E174.1) - Offline storage management

**Tracking:**
- NO tracking across apps/websites
- NO tracking domains

### Updates Required

If you add new features that collect different data types or use additional iOS APIs, update this manifest:

1. Edit `ios/App/App/PrivacyInfo.xcprivacy`
2. Add new data types or APIs
3. Reference: https://developer.apple.com/documentation/bundleresources/privacy_manifest_files

### Compliance

This manifest ensures compliance with:
- Apple Privacy Manifest 2.0 requirements
- App Store Review Guidelines 5.1.2
- iOS 17+ privacy requirements

**Note:** Failure to include this manifest may result in App Store rejection.

