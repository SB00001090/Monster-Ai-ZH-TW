import java.util.Properties

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

val keystorePropsFile = rootProject.file("keystore.properties")
val keystoreProps = Properties()
if (keystorePropsFile.exists()) {
    keystorePropsFile.inputStream().use { keystoreProps.load(it) }
}

android {
    namespace = "ai.monster.callguard"
    compileSdk = 34

    defaultConfig {
        applicationId = "ai.monster.callguard"
        minSdk = 29
        targetSdk = 34
        versionCode = 9
        versionName = "1.0.8"
        buildConfigField("String", "THREAT_FEED_URL", "\"\"")
    }

    signingConfigs {
        create("release") {
            val storePath = keystoreProps.getProperty("storeFile", "keystore/monster-callguard.jks")
            storeFile = rootProject.file(storePath)
            storePassword = keystoreProps.getProperty("storePassword", "monster-callguard-2026")
            keyAlias = keystoreProps.getProperty("keyAlias", "callguard")
            keyPassword = keystoreProps.getProperty("keyPassword", "monster-callguard-2026")
        }
    }

    buildTypes {
        debug {
            isMinifyEnabled = false
            buildConfigField("String", "THREAT_FEED_URL", "\"\"")
        }
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro",
            )
            signingConfig = signingConfigs.getByName("release")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }
    buildFeatures { buildConfig = true }
}

dependencies {
    implementation("androidx.core:core-ktx:1.12.0")
    implementation("androidx.appcompat:appcompat:1.6.1")
    implementation("com.google.android.material:material:1.11.0")
    implementation("com.squareup.okhttp3:okhttp:4.12.0")
    implementation("androidx.work:work-runtime-ktx:2.9.0")
}