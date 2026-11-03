# Sparkle 2 publishing on pixlume.app

Public feed: https://pixlume.app/appcast.xml. It is generated from the current database on every request, without caching. Publishing, editing, scheduling, unpublishing and deletion are reflected automatically. News and GitHub mirroring are independent and preserved. The feed and its checksum-pinned ZIP URLs are public even when marketing pages are beta locked.

## What the Mac build must produce
1. Build the actual release .app with the intended CFBundleShortVersionString (marketing version), CFBundleVersion (numeric build number) and minimum macOS version. Use the existing SUPublicEDKey; the website public key must match the installed app's key. Do not rotate keys merely to publish a release.
2. Package the final Mac app as a standard ZIP with Pixlume.app at the root. For example: `ditto -c -k --sequesterRsrc --keepParent /path/Pixlume.app /path/Pixlume-0.9.0.zip`. This website's verifier supports standard non-ZIP64 ZIP files up to 32 MiB to stay within the hosting memory limit. Larger or externally linked archives remain manual downloads; no verification shortcut is used.
3. Use the `bin/sign_update` executable from your Sparkle distribution on that exact final ZIP: `/path/to/Sparkle/bin/sign_update /path/to/Pixlume-0.9.0.zip`. Keep the existing private EdDSA key in the Mac Keychain/build secret store. Never upload it to the website, GitHub repository, admin forms or chat. sign_update prints a public `sparkle:edSignature="..."` and archive `length="..."`. Do not modify or recompress the ZIP after signing.
4. In Admin → Site content → Site, configure Sparkle public EdDSA key with the app's base64 SUPublicEDKey (32 bytes). This is a public verification key, not a signing key.
5. Create/save the release as a draft, enter the correct marketing version, build number, minimum OS and publication date, then upload the ZIP. The website computes the actual byte count and SHA-256. Confirm its size matches sign_update's length.
6. Paste only the base64 signature value (64 bytes, normally 88 base64 characters) into Sparkle EdDSA signature. Save/publish. The server verifies the signature cryptographically against the stored ZIP and configured public key. Incorrect signatures, damaged ZIPs, unsupported ZIPs, missing files, missing keys and size/hash mismatches are rejected. Nothing signs on the server.

A release without a signature remains downloadable manually and is excluded from automatic updates. Replacing its ZIP clears the signature; sign the replacement and save the new signature. Changing the configured public key invalidates eligibility of previously verified releases until their signatures are verified under that key. Existing unverified signature strings are not sufficient to enter the feed; re-save after configuring the key.

## Appcast contract and verification
Only published Mac ZIPs with elapsed publication dates, numeric build numbers, server-verified matching signatures, and existing size-matched stored objects appear. Each item includes publication date, build in sparkle:version, marketing version in sparkle:shortVersionString, minimum system version, release notes link and an enclosure with URL, exact byte length and sparkle:edSignature.
Enclosure URLs contain the release's SHA-256. Replacing an artifact makes an old enclosure URL fail with 410 rather than returning different bytes under an old signature. Removing/unpublishing makes it fail with 404. The native Sparkle verifier still verifies authenticity at installation time.

No private keys or app source are required on the website. This implementation does not modify SUFeedURL, SUPublicEDKey, Sparkle settings, the Mac build or the native app. If the app uses SURequireSignedFeed, dynamically generating XML alone is insufficient: the Mac build must separately sign the appcast and release notes; that mode is not enabled by this website. Otherwise set SUFeedURL in the app project to the public feed as a separate app-side change.

Official instructions: https://sparkle-project.org/documentation/publishing/
