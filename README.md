# Paramount Control+

Paramount Control+ is an unofficial extension for the Paramount+ website in desktop Chrome and Microsoft Edge. It can hide the playback sidebar, select among the video qualities a title offers, and show the current resolution and bitrate.

## Install on Windows

1. On this repository’s GitHub page, select **Code → Download ZIP**.
2. Right-click the downloaded ZIP and choose **Extract All**. Keep the extracted folder somewhere permanent. The browser loads the extension from that folder.
3. In Chrome, open `chrome://extensions`. In Edge, open `edge://extensions`. Turn on **Developer mode**.
4. Select **Load unpacked** and choose the folder that directly contains `manifest.json`.
5. Refresh any open Paramount+ tabs. Start a video, then open **Paramount Control+** from the browser’s **Extensions** menu.

Installation requires Chrome or Edge 111 or later and permission to load unpacked extensions. On a managed PC, your organization controls that permission.

## Playback controls

**Hide playback menu** hides the sidebar by default. Turn it off to restore the sidebar. **Dark mode** changes the popup’s appearance.

| Quality preference | How the player chooses video |
| --- | --- |
| **Auto** (default) | Paramount+ adjusts quality to your connection. |
| **Keep sharp** | Keeps the highest compatible resolution and bitrate in each group of video tracks. |
| **Manual** | Uses the selected resolution and the closest offered bitrate. If that resolution is unavailable, the player keeps its original choices. |

Changing quality reloads active playback. If playback fails after the extension narrows the available choices, it can reload once in Auto for that title. The popup labels bitrate values reported by the stream, advertised in the playlist, or estimated from recent video segments.

## Privacy and permissions

The extension runs on the HTTPS versions of `www.paramountplus.com` and `paramountplus.com`. Its `storage` permission saves your sidebar, appearance, and quality preferences in your browser profile.

Playback analysis happens in the tab using requests the player already makes. The popup receives resolution and bitrate information. The tab uses session storage to carry the quality setting across reloads. After a playback failure, it stores a fingerprint of the page address alongside the setting to prevent repeated reloads. The extension keeps this information on your device.

## Update or remove

To update, extract the new ZIP and replace the extension files in the same folder. Open the browser’s extensions page, click **Reload** on **Paramount Control+**, and refresh your Paramount+ tabs.

To uninstall, click **Remove** on the extension’s card. You can then delete the extracted folder.

## Attribution

Parts of the quality engine are adapted from Paramount Quality+ under the ISC license. [Third-party notice and license](quality/NOTICE.md)
