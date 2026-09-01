#!/bin/bash
# BURNBOARD Android Build Script
# Builds both debug APK and release AAB for Play Store

set -e

echo "🔥 BURNBOARD Android Build"
echo "=========================="

# Step 1: Build the web app
echo ""
echo "📦 Step 1: Building web assets..."
npm run build

# Step 2: Copy to Android
echo ""
echo "📱 Step 2: Copying web assets to Android..."
npx cap copy android

# Step 3: Sync plugins
echo ""
echo "🔌 Step 3: Syncing Capacitor plugins..."
npx cap sync android

# Step 4: Build debug APK (for testing)
echo ""
echo "🔧 Step 4: Building debug APK..."
cd android
./gradlew assembleDebug
echo ""
echo "✅ Debug APK built: android/app/build/outputs/apk/debug/app-debug.apk"
echo "   Install with: adb install app/build/outputs/apk/debug/app-debug.apk"

# Step 5: Build release AAB (for Play Store)
echo ""
echo "📦 Step 5: Building release AAB for Play Store..."
./gradlew bundleRelease
echo ""
echo "✅ Release AAB built: android/app/build/outputs/bundle/release/app-release.aab"
echo "   Upload to Google Play Console"

cd ..

echo ""
echo "=========================="
echo "🎉 Build complete!"
echo ""
echo "📋 Next steps:"
echo "   1. Test APK: adb install android/app/build/outputs/apk/debug/app-debug.apk"
echo "   2. Open Android Studio: npx cap open android"
echo "   3. Build → Generate Signed Bundle for Play Store"
echo "   4. Upload AAB to Google Play Console"
echo "=========================="
