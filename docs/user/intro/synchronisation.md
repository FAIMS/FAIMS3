(intro/syncronisation)=
# Synchronisation

While working online, or within range of an offline server, records will be continuously synchronised. If working offline and without a standalone server, records will be stored on the local device until the next opportunity to synchronise.

:::{warning}
Note that Fieldmark must be open for synchronisation to work. If you exit the App, synchronisation will be paused and restart when you return to the App.
:::

## Configuring Synchronisation
Synchronisation is on by default. It does not need to be activated and if you are online, records will synchronise. If you wish to turn off synchronisation, go to the Notebook Settings and slide the 'Sync Notebook' toggle to 'Off'.

### Attachments from Other Users

Users can choose whether or not to synchronise files and attachments created by other users.

If enabled, the Fieldmark will automatically download and show images and attachments created on other devices. As this may be resource intensive and affect your mobile data plan, this setting can be disabled to minimise network usage. Attachments are always uploaded to the server regardless of this setting.

By default, notebooks are set to not download files and attachments created by other users. To activate, go to the Notebook Settings and slide the 'Get attachments from other devices' toggle to 'On'.

## Verifying synchronisation
While online, or connected to the offline server, the App will continuously synchronise new and updated records on the device and the server. When on the project page, you will need to click [refresh]{.refresh} to reset the datagrid and show recently synced records. Large datasets with numerous images may take several minutes to fully synchronise (particularly if teams have been offline for several days), but the majority of records and edits will appear instantaneously.   

An icon in the App header will provide a notification if you are offline or sync has been disrupted.    

To verify your records have synced, check them on a different computer.

:::{danger}
Unsynchronized data will be lost if the App is uninstalled from a device or the browser cache is wiped.
:::
