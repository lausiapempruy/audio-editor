# Audio Editor

A lightweight, browser-based MP3 trimmer with an Apple-inspired interface. Files are decoded and processed locally in the browser; audio is not uploaded to an application server.

## Features

- Trim MP3 audio with start/end handles or editable timestamps.
- Waveform preview and selection playback.
- Export the selected range as an MP3.
- 30 MB maximum input file size.
- Responsive layout, liquid-glass-inspired surfaces, subtle morphing transitions, and reduced-motion support.
- No framework or build step required.

## Run locally

Open `index.html` in a modern browser, or serve the folder using any static web server. The MP3 encoder and Inter font are loaded from CDNs, so an internet connection is needed for those assets.

## Deploy

The project is static and can be deployed through GitHub Pages or any static hosting provider. For GitHub Pages, open **Settings → Pages**, select the deployment branch and root folder, then save.

## Notes

- Supported input: MP3, maximum 30 MB.
- Audio decoding depends on browser support and available device memory.
- MP3 export uses the LAME encoder loaded from jsDelivr. Export is performed on the user's device.
- This project is an independent tool and is not affiliated with Apple.
