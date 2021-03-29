# FAIMS3

## Setup and development (quick-start)

Before you do anything (apart from cloning this repository), you should run `npm
install` to get all the dependencies for the scripts installed (If you have been
doing some development, either stashing or committing your changes before
running `npm install` would be wise).

Once the dependencies are installed, you should check any changes that have been
made, and commit them if needed.

There are a number of helper script (which can be seen in the `package.json`),
but the ones that should always exist are:

 * `npm run build`: builds the webapp (not the Android/iOS apps)
 * `npm run test`: runs the main test suite
 * `npm run serve`: runs the webapp in a browser (currently via capacitor's
   system, to ensure that the webapp and the phone apps are as similar as
   possible).

You should also be aware of the
[cli interface to capacitor](https://capacitorjs.com/docs/cli), as that does the
building/management of the Android/iOS apps.
