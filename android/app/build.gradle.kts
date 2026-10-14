plugins { id("com.android.application"); id("org.jetbrains.kotlin.android") }
android {
    namespace = "me.opencodex.quota"
    compileSdk = 35
    defaultConfig { applicationId = "me.opencodex.quota"; minSdk = 26; targetSdk = 35; versionCode = (System.getenv("GITHUB_RUN_NUMBER") ?: "1").toInt(); versionName = "0.1.0" }
    signingConfigs {
        create("qa") {
            storeFile = file(System.getenv("ANDROID_KEYSTORE_PATH") ?: "missing.jks")
            storePassword = System.getenv("ANDROID_KEYSTORE_PASSWORD")
            keyAlias = "quota"
            keyPassword = System.getenv("ANDROID_KEYSTORE_PASSWORD")
        }
    }
    buildTypes {
        getByName("release") {
            isMinifyEnabled = false
            if (System.getenv("ANDROID_KEYSTORE_PATH") != null) signingConfig = signingConfigs.getByName("qa")
        }
    }
    compileOptions { sourceCompatibility = JavaVersion.VERSION_17; targetCompatibility = JavaVersion.VERSION_17 }
    kotlinOptions { jvmTarget = "17" }
}
dependencies {
    implementation("androidx.work:work-runtime-ktx:2.10.5")
    testImplementation("junit:junit:4.13.2")
}
