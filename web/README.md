# FAIMS3 Web Application

The web component of FAIMS3 (previously known as Conductor) is a web-based application that allows admin users to create and manage surveys, templates, and users. It also allows users to export data from surveys and perform various other tasks.

## Overview

The web/ directory contains the source code for the web application. It is built using the React framework and is deployed to a web server using Vite.

## Prerequisites

- Node.js (v20+)
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

## File Structure

The `/src` directory contains the source code for the application. Including:
- `/src/components` - React components for the application
    - `/src/components/ui` - ShadCN provided UI components
    - `/src/components/forms` - Form components leveraging `form.tsx`
    - `/src/components/tables` - Table components leveraging `/src/components/data-table`
- `src/context` - React context providers for the application
- `src/hooks` - React hooks for the application
- `src/lib` - Utility functions for the application
- `src/routes` - React routes for the application

## Adding a new route

To add a new route, create a new file in the `src/routes` directory with the following structure:

```typescript
import {createFileRoute} from '@tanstack/react-router';

export const Route = createFileRoute('/path/to/route')({
  component: RouteComponent,
});

function RouteComponent() {
  return <div>Hello World!</div>;
}
```

The `Route` object is the route definition, and the `RouteComponent` is the component that will be rendered when the route is accessed.

To add a new route to the sidebar, add the route to the `items` array in the `src/components/side-bar/nav-main.tsx` file.

## Adding ShadCN UI components

To add a new ShadCN UI component which is not present in the `src/components/ui` directory, run the following command:

```bash
npx shadcn@latest add
```

This will prompt you to select the component type, and then generate the necessary files and imports.

## Styling

Tailwind CSS is used for styling. The `src/index.css` file contains the base styles for the application. You can add custom styles to the `src/index.css` file or create a new file in the `src/components` directory to override the base styles.