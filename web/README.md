# FAIMS3 Web Application

The web component of FAIMS3 (previously known as Conductor) is a web-based application that allows admin users to create and manage surveys, templates, and users. It also allows users to export data from surveys and perform various other tasks.

## Overview

The web/ directory contains the source code for the web application. It is built using the React framework and is deployed to a web server using Vite.

## Prerequisites

- Node.js (v20+)
- pnpm (v7+)
- npm (v8+)
- Vite (v4+)

## Installation

1. Install dependencies from the project root:

```bash
npm i
```

2. Create environment configuration and edit configuration as needed:

```bash
cp .env.dist .env
code .env
```

## Running the Development Server

Start the development server:

```bash
npm run dev
```

This will start the development server on port 3000 by default. Open your web browser and navigate to http://localhost:3000 to view the application.

## Building for Production

To build the application for production, run the following command:

```bash
npm run build
```

This will generate a production build in the `build` directory. The build artifacts will be optimized for production and will include only the necessary files for the application to run.

This will build the application and deploy it to the specified server.

## License

FAIMS3 is licensed under the Apache License, Version 2.0. See the [LICENSE](LICENSE) file for more information.
