# Nightreel: Windows → cloud Mac → TestFlight signing

**Current status:** The unsigned iOS Simulator build has passed on GitHub Actions. The signed workflow is committed at `.github/workflows/ios-testflight.yml`, but it will not run until you manually start it. **Never paste Apple private keys, .p12 passwords or GitHub secrets in chat or commit them to this repository.**

## 1. Register the App ID and app record

1. In [Apple Developer Identifiers](https://developer.apple.com/account/resources/identifiers/list), register an explicit App ID with Bundle ID `com.kayleighsu.nightreel` (unless you intend to rename the bundle before release).
2. In [App Store Connect](https://appstoreconnect.apple.com/apps), create a new **iOS** app named **Nightreel** tied to that Bundle ID. Use SKU `nightreel-ios-v1` or another unique string.
3. Take note of your **Apple Team ID** in the Developer account.

## 2. Create an Apple Distribution certificate from Windows

You'll need OpenSSL, available through Git for Windows/Git Bash or another trusted install. **Run the following locally on your Windows PC**, in a private folder; do not create keys inside your public GitHub checkout.

```bash
mkdir -p ~/nightreel-apple-signing
cd ~/nightreel-apple-signing
openssl genrsa -out nightreel-distribution.key 3072
openssl req -new -key nightreel-distribution.key -out nightreel.certSigningRequest -subj "/emailAddress=YOUR_EMAIL/CN=Nightreel Apple Distribution/C=US"
```

Change `YOUR_EMAIL` to the email associated with your Apple Developer account. Upload **only** `nightreel.certSigningRequest` to [Apple Developer Certificates](https://developer.apple.com/account/resources/certificates/list) and choose **Apple Distribution**. Download the resulting `.cer` certificate into the private folder.

Then convert the downloaded certificate into a password-protected `.p12`:

```bash
openssl x509 -inform DER -in distribution.cer -out distribution.pem
openssl pkcs12 -export -inkey nightreel-distribution.key -in distribution.pem -out nightreel-distribution.p12 -name "Nightreel Distribution"
```

Replace `distribution.cer` with the actual downloaded filename. Choose a **strong** password for the `.p12`, which you will store as a GitHub Actions secret. Keep the private key and original certificate backed up securely.

## 3. Create the App Store provisioning profile

In [Apple Developer Profiles](https://developer.apple.com/account/resources/profiles/list), create an **App Store Connect** distribution provisioning profile (the portal may label it **App Store**), choose the Nightreel App ID and your newly created Apple Distribution certificate, then download the `.mobileprovision` file into the same private folder.

## 4. Generate an App Store Connect API key

In [App Store Connect → Users and Access](https://appstoreconnect.apple.com/access/users), select **Integrations → App Store Connect API** and create a **Team API key** with an appropriate role for uploading app builds (typically App Manager). Record the **Key ID** and **Issuer ID**, and download the `.p8` once. Store this file securely: Apple will not let you download it again. Never commit it.

## 5. Store credentials in GitHub Actions secrets

Go to [Nightreel → Settings → Secrets and variables → Actions](https://github.com/KayleighSu/Nightreel/settings/secrets/actions). Create **repository secrets** with these *exact names*:

| Secret | Value |
|---|---|
| `APPLE_TEAM_ID` | Apple developer Team ID |
| `IOS_CERTIFICATE_P12_BASE64` | Base64 contents of the `.p12` file |
| `IOS_CERTIFICATE_PASSWORD` | Password chosen when exporting `.p12` |
| `IOS_PROVISIONING_PROFILE_BASE64` | Base64 contents of the `.mobileprovision` |
| `APPSTORE_API_KEY_ID` | App Store Connect API key ID |
| `APPSTORE_API_ISSUER_ID` | App Store Connect issuer ID |
| `APPSTORE_API_KEY_P8_BASE64` | Base64 contents of the private `.p8` file |

From **Windows PowerShell**, generate the base64 value of each binary file locally using:

```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("C:\path\to\nightreel-distribution.p12")) | Set-Clipboard
```

Paste the clipboard **only into the matching GitHub secret value**, then repeat for the provisioning profile and the `.p8`. Don't paste values into chat, source files, issues, build logs or public GitHub pages.

Base64 is an encoding, **not encryption**; GitHub Actions secrets provide the access protection. Consider restricting the `ios-testflight` GitHub environment to trusted reviewers and the `main` branch.

## 6. Start the signed TestFlight build

Open [Nightreel → Actions](https://github.com/KayleighSu/Nightreel/actions), select **Nightreel TestFlight (signed iOS build)** in the left sidebar, and click **Run workflow → main → Run workflow**.

The workflow:
1. Generates the Capacitor iOS app on a macOS runner.
2. Installs your distribution certificate and App Store provisioning profile in a temporary keychain.
3. Archives and signs Nightreel.
4. Exports an `.ipa`.
5. Authenticates to App Store Connect using the GitHub secret API key and uploads the `.ipa`.

After Apple finishes processing the upload, look in **App Store Connect → Nightreel → TestFlight**. Start with internal testing.

### Troubleshooting

- **Missing required secret:** Check its exact name and whether the repository can access it.
- **No matching provisioning profiles:** Confirm `com.kayleighsu.nightreel`, your Team ID, and the certificate selected in the provisioning profile.
- **Code signing failed:** Confirm the `.p12` contains the **private key** matching the certificate and the password is correct.
- **Upload rejected:** Confirm the App Store Connect app record and API permissions. New Apple Developer accounts may need additional agreements completed.
- **Build processing:** A successful upload is not the same as a TestFlight build being approved or available to install.

## Privacy and release gate

The TestFlight workflow provides technical packaging, not automatic App Store approval. Before external beta or public launch, complete device testing, privacy policy, support/contact details, rights/moderation procedures for anime art, and the remaining Supabase security checks. The simulator build artifact cannot be installed on an iPhone; the signed App Store Connect build can be distributed through TestFlight once processed by Apple.
