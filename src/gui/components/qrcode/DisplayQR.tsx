/*
 * Copyright 2021 Macquarie University
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
 * Filename: DisplayQR.tsx
 * Description:
 *   Component to display QR codes
 */

import React, { useState } from 'react'
import QRCode from 'qrcode'
import './DisplayQR.css'
import Dialog from '@mui/material/Dialog';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Toolbar from '@mui/material/Toolbar';

export function DisplayQR({content}: {content: string}): JSX.Element {

    const [url, setUrl] = useState('')

    QRCode.toDataURL(content)
      .then((url: any) => {
        console.log(url)
        setUrl(url)
      })
      .catch((err: any) => {
        console.error(err)
      });

      return (
        <div className="qrcode">
            <img src={url} alt={content} />
        </div>
      )
}


export function DisplayQRModal({content}: {content: string}): JSX.Element {

    const [open, setOpen] = useState(false)

    const handleOpen = () => {
        setOpen(true)
    }

    const handleClose = () => {
        setOpen(false)
    }

    return (
        <div>
            <Button onClick={handleOpen}>{content}</Button>
            <Dialog
                fullScreen
                open={open}
                onClose={handleClose}
                >
            <Toolbar>
                <IconButton
                edge="start"
                color="inherit"
                onClick={handleClose}
                aria-label="close"
                >
                    X
                </IconButton>
            </Toolbar>

                <DisplayQR content={content} />
            </Dialog>
        </div>
    )
}

