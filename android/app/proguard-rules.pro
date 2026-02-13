# ==============================================================================
# TradieMate ProGuard / R8 Rules
# ==============================================================================
# These rules ensure Capacitor, WebView bridges, and critical dependencies
# work correctly when minifyEnabled = true.

# --- Capacitor Core ---
# Keep the Capacitor bridge and plugin classes
-keep class com.getcapacitor.** { *; }
-keep class com.capacitorjs.plugins.** { *; }
-dontwarn com.getcapacitor.**

# Keep the MainActivity and any Activity subclasses
-keep class com.tradiemate.app.MainActivity { *; }

# --- WebView JavaScript Interface ---
# Required for Capacitor's JS-to-native bridge
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# --- AndroidX ---
-keep class androidx.** { *; }
-dontwarn androidx.**

# --- Cordova Plugins (if any) ---
-keep class org.apache.cordova.** { *; }
-dontwarn org.apache.cordova.**

# --- Google Play Services ---
-keep class com.google.android.gms.** { *; }
-dontwarn com.google.android.gms.**

# --- Firebase ---
-keep class com.google.firebase.** { *; }
-dontwarn com.google.firebase.**

# --- RevenueCat ---
-keep class com.revenuecat.** { *; }
-dontwarn com.revenuecat.**

# --- Stripe ---
-keep class com.stripe.** { *; }
-dontwarn com.stripe.**

# --- Keep enums (used by various plugins) ---
-keepclassmembers enum * {
    public static **[] values();
    public static ** valueOf(java.lang.String);
}

# --- Keep Parcelables ---
-keepclassmembers class * implements android.os.Parcelable {
    public static final ** CREATOR;
}

# --- Keep serializable classes ---
-keepclassmembers class * implements java.io.Serializable {
    static final long serialVersionUID;
    private static final java.io.ObjectStreamField[] serialPersistentFields;
    !static !transient <fields>;
    private void writeObject(java.io.ObjectOutputStream);
    private void readObject(java.io.ObjectInputStream);
    java.lang.Object writeReplace();
    java.lang.Object readResolve();
}

# --- Remove debug logging in release ---
-assumenosideeffects class android.util.Log {
    public static int d(...);
    public static int v(...);
}

# --- Preserve line numbers for crash reporting ---
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile
