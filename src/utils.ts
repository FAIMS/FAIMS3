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
 *   Contains utility functions which lack a better location.
 */
import {Device} from '@capacitor/device';
import {Filesystem, Directory} from '@capacitor/filesystem';

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

export async function downloadStringOnApp(
  s: string,
  encoding: string,
  filename: string
) {
  const info = await Device.getInfo();
  if (info.platform === 'ios') {
    await Filesystem.writeFile({
      path: filename,
      data: s,
      directory: Directory.Documents,
      encoding: encoding,
    });
  } else if (info.platform === 'android') {
    const cache_res = await Filesystem.writeFile({
      path: filename,
      data: s,
      directory: Directory.Cache,
      encoding: encoding,
    });
    await Mediastore.saveToDownloads({
      path: filename,
      directory: cache_res.url,
    });
    await Filesystem.deleteFile({path: filename, directory: Directory.Cache});
  } else {
    throw Error('Do not know how to save on this platform');
  }
}
