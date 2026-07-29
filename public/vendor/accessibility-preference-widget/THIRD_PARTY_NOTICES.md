# Third-party notices

## Material Design Icons

The inline SVG interface icons in the widget are adapted from icon path data published in Google's Material Design Icons project.

- Project: Material Design Icons
- Source: https://github.com/google/material-design-icons
- Copyright: Google LLC and project contributors
- License: Apache License 2.0
- Local license copy: [licenses/Apache-2.0.txt](licenses/Apache-2.0.txt)
- Modifications: icons are embedded as inline SVG path data; surrounding markup, sizing, colors, and accessibility attributes have been adapted for this widget.

No Google trademark or endorsement is claimed.

## Lucide icons and Feather-derived icons

Some stroke-based inline SVG controls are adapted from Lucide icons. Lucide is licensed under ISC, and its license identifies a subset derived from Feather under MIT.

- Project: Lucide
- Source: https://github.com/lucide-icons/lucide
- Copyright: Lucide Icons and Contributors
- License: ISC, with Feather-derived icons under MIT
- Local license copy: [licenses/Lucide-ISC-and-Feather-MIT.txt](licenses/Lucide-ISC-and-Feather-MIT.txt)
- Modifications: icons are embedded inline and their surrounding markup, sizing, colors, and accessibility attributes have been adapted.

## esbuild

esbuild is used only as a development dependency to minify the production bundle. Its implementation is not copied into the browser bundle.

- Project: esbuild
- Source: https://github.com/evanw/esbuild
- License: MIT

The installed dependency tree and exact versions are recorded in `package-lock.json`.

## jsdom

jsdom is used only by the Node.js test suite to exercise browser-like runtime behavior. It is not included in the distributed browser bundle.

- Project: jsdom
- Source: https://github.com/jsdom/jsdom
- License: MIT

jsdom's transitive development dependencies and exact versions are recorded in `package-lock.json`.

## Fonts and images

The public core bundles no third-party font or image files and makes no font CDN requests. The UI uses operating-system font stacks. The demo contains no remote images.

If a future contribution adds a font, image, icon set, or remote asset, its exact source, version, license, modifications, and redistribution requirements must be recorded here.
