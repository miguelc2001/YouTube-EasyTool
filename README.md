# YouTube EasyTool

A lightweight browser extension for Chrome and Firefox that tames the most annoying YouTube settings — translating titles you didn't ask for, filling your feed with Shorts, ignoring how many videos you actually want per row, and making the watch page sidebar less overbearing.

> **v1.0.0 now available on the [Chrome Web Store](https://chromewebstore.google.com/detail/youtube-easytool/mpobhamgihljgnjoeohcfigenodfclik)** 

> Firefox Add-ons submission is still pending review.

## Preview

<img src="docs/popup.png" alt="YouTube EasyTool popup" width="320">

## Features

**Grid Layout** — Set the exact number of video columns on the YouTube home and subscriptions pages, from 2 to 8. The change is instant and the setting is remembered across sessions.

**Sidebar Thumbnail Size** — Resize the video thumbnails in the watch page sidebar. Drag the slider from 50% to 130% of the default size. Only affects the related videos panel — all other pages are untouched.

**Hide Shorts** — Remove YouTube Shorts from your home feed, search results, and subscription feed. The Shorts section in the sidebar remains accessible if you want to browse it directly.

**Original Titles** — Prevent YouTube from auto-translating video titles into your browser's language. Titles are shown in their original language.

## Installation

### Chrome

Install directly from the **[Chrome Web Store](https://chromewebstore.google.com/detail/youtube-easytool/mpobhamgihljgnjoeohcfigenodfclik)**.

Alternatively, you can install it manually:

1. Download this repository — click **Code → Download ZIP** on GitHub and unzip it
2. Open Chrome and go to `chrome://extensions`
3. Enable **Developer Mode** (toggle in the top-right corner)
4. Click **Load unpacked** and select the folder you just unzipped
5. The YouTube EasyTool icon appears in your toolbar

### Firefox

**Temporary install** (removed when Firefox restarts):

1. Download and unzip the repository
2. Go to `about:debugging#/runtime/this-firefox`
3. Click **Load Temporary Add-on** and select `manifest.json` from the unzipped folder

**Permanent install** (without submitting to AMO):

1. Download and unzip the repository
2. Zip the contents of the unzipped folder and rename the file to `youtube-easytool.xpi`
3. Go to `about:addons`, click the gear icon, then **Install Add-on From File**
4. Select the `.xpi` file

> Note: Firefox requires Developer Edition or setting `xpinstall.signatures.required` to `false` in `about:config` for unsigned add-ons.

## How to use

Click the YouTube EasyTool icon in your browser toolbar while on any YouTube page. Toggle features on or off — changes take effect immediately on the current page.

## Upcoming features

- Auto-expand video descriptions
- Hide end screen cards

## Contributing

Pull requests are welcome. Please open an issue first to discuss significant changes.

## License

[MIT](LICENSE)
