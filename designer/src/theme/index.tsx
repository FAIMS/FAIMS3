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
 * Filename: index.tsx
 * Description:
 *   Taken from the main FAIMS3 proj source code: /src/gui/theme/index.tsx
 *   Amended to fit this project.
 */

import { createTheme, colors } from '@mui/material';

const theme = createTheme({
    palette: {
        background: {
            default: '#FAFAFB',
        },
        primary: {
            main: '#669911',
            light: '#a7e938',
            dark: '#141E03',
        },
        secondary: {
            main: '#E18200', //'#FFA000',
            contrastText: '#fff',
        },
        text: {
            primary: colors.blueGrey[900],
            secondary: colors.blueGrey[600],
        },
    },
    typography: {
        fontFamily: "'Open Sans', sans-serif",
        h1: {
            fontFamily: "'Lato', sans-serif",
            fontWeight: 900,
            fontSize: 35,
            letterSpacing: '-0.24px',
        },
        h2: {
            fontFamily: "'Lato', sans-serif",
            fontWeight: 900,
            fontSize: 29,
            letterSpacing: '-0.24px',
        },
        h3: {
            fontFamily: "'Lato', sans-serif",
            fontWeight: 900,
            fontSize: 24,
            letterSpacing: '-0.06px',
        },
        h4: {
            fontFamily: "'Lato', sans-serif",
            fontWeight: 900,
            fontSize: 20,
            letterSpacing: '-0.06px',
        },
        h5: {
            fontFamily: "'Lato', sans-serif",
            fontWeight: 900,
            fontSize: 16,
            letterSpacing: '-0.05px',
        },
    },
    // shadows: Array(25).fill('none') as Shadows,
    components: {
        MuiAppBar: {
            styleOverrides: {
                root: {
                    '&.MuiAppBar-root': {
                        boxShadow: 'none',
                    },
                },
                colorPrimary: {
                    backgroundColor: '#edeeeb',
                    color: '#324C08',
                    contrastText: '#fff',
                    textColor: '#fff',
                    indicatorColor: '#fff',
                    text: {
                        primary: '#fff',
                    },
                },
            },
        },
        MuiTabs: {
            styleOverrides: {
                root: {
                    '&.MuiTabs-root': {
                        boxShadow: 'none',
                        fontWeight: 'bold',
                    },
                    '&.MuiTab-root': {
                        fontWeight: '700 !important',
                    },
                    '&.Mui-selected': {
                        fontWeight: '700 !important',
                        color: 'white',
                        backgroundColor: '#DA9449',
                    },
                },
            },
        },
        MuiTab: {
            styleOverrides: {
                root: {
                    '&.MuiTab-root': {
                        fontWeight: 'bold',
                    },
                },
            },
        },
    },
});

export default theme;