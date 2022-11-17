/*
 * Copyright 2021, 2022 Macquarie University
 *
 * Licensed under the Apache License Version 2.0 (the, "License");
 * you may not use, this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing software
 * distributed under the License is distributed on an "AS IS" BASIS
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND either express or implied.
 * See, the License, for the specific language governing permissions and
 * limitations under the License.
 *
 * Filename: utils.ts
 * Description:
 *   Contains utility functions related to downloading and sharing
 */
import {Filesystem, Directory, Encoding} from '@capacitor/filesystem';
import {Share} from '@capacitor/share';

/// Downloads a blob as a file onto a user's device
export function downloadBlob(b: Blob, filename: string) {
  const u = URL.createObjectURL(b);
  const a = document.createElement('a');
  a.href = u;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(u);
}

export async function shareStringAsFileOnApp(
  s: string,
  title: string,
  dialogTitle: string,
  filename: string
) {
  const isodate = new Date().toJSON().slice(0, 10);
  console.debug('Starting writing of file');
  for (const dir of [
    Directory.Library,
    Directory.Cache,
    Directory.Documents,
    Directory.Data,
    Directory.External,
    Directory.ExternalStorage,
  ]) {
    try {
      console.debug('Trying ', dir);
      const url = (
        await Filesystem.writeFile({
          path: `${isodate}-${dir}-${filename}`,
          data: s,
          directory: dir,
          encoding: Encoding.UTF8,
          recursive: true,
        })
      ).uri;
      console.debug('Writing of file complete, sharing file', url);
      await Share.share({
        title: `${title} ${dir} ${isodate}.json`,
        text: dialogTitle,
        url: url,
        dialogTitle: dialogTitle,
      });
      break;
    } catch (err) {
      console.error('Sharing failed with', dir, err);
    }
  }
  console.debug('Shared file');
}
