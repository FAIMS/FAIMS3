# Synchronisation

While working online, or within range of an offline server, records will be continuously synchronised. If working offline and without a standalone server, records will be stored on the local device until the next opportunity to synchronise.

```{warning}
> Note that the **{{FAIMS}} App** must be open for synchronisation to work. If you exit the App, synchronisation will be paused and restart when you return to the App.
```

## Configuring Synchronisation

When you activate a {{notebook}}, record sync starts automatically. In **{{Notebook}} Settings**, use **Sync mode** to choose how record data moves between your device and the server:

| Mode                             | Behaviour                                                                                                  |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| **Sync off (local device only)** | Records stay on this device; nothing is sent to or received from the server.                               |
| **Upload only**                  | Your new and updated records upload to the server. Existing records from other devices are not downloaded. |
| **Upload and download**          | Full two-way sync (default for smaller {{notebooks}} when online).                                         |

When you activate a {{notebook}} while online, the app may set **Upload only** automatically for {{notebooks}} with very large numbers of records, to save storage and mobile data. If the record count cannot be fetched (offline or error), **Upload and download** is used instead.

On the record list, a banner may suggest switching to **Upload only** when a large {{notebook}} is still using two-way sync.

### Attachments from Other Users

Users can choose whether or not to synchronise files and attachments created by other users.

If enabled, the {{FAIMS}} will automatically download and show images and attachments created on other devices. As this may be resource intensive and affect your mobile data plan, this setting can be disabled to minimise network usage. Attachments are always uploaded to the server regardless of this setting. This option requires **Upload and download** sync mode.

By default, {{notebooks}} are set to not download files and attachments created by other users. To activate, go to the {{Notebook}} Settings and turn **Get attachments from other devices** to **On**.

## Verifying synchronisation

While online, or connected to the offline server, the App will continuously synchronise new and updated records on the device and the server. When on the project page, you will need to tap or click **Refresh** to reset the _Record List_ and show recently synced records.

```{note}
Large datasets with numerous images may take several minutes to fully synchronise (particularly if teams have been offline for several days), but the majority of records and edits will appear instantaneously.
```

An icon in the App header will provide a notification if you are offline or sync has been disrupted.

To verify your records have synced, check them on a different computer.

```{warning}
Unsynchronized data will be lost if the App is uninstalled from a device or the browser cache is wiped.
```
