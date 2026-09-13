# Hash Plus integration

The supplied `Pasted markdown.md` is the production HTML shell of learn.ihashplus.com. It references compiled JavaScript/CSS chunks and external assets; those chunks contain the actual application behavior and are not included in the pasted HTML.

This project therefore integrates the concrete parts supported by that source: Arabic-first font loading, JetBrains Mono for Latin/tabular values, first-paint loading shell, theme color metadata, and a structure ready for the existing Hash Club pages.

The existing Hash Club pages/API remain the source of truth for application behavior; no unavailable production bundle code is copied or represented as if it were present.
