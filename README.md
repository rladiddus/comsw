# Static Assets For Apps Script

This folder is intended to be published with GitHub Pages.

Current asset:
- `assets/fonts/Paperlogy-8ExtraBold.woff2`
- `assets/fonts/paperlogy.css`

After GitHub Pages is enabled, the CSS URL should look like:

```text
https://<github-user>.github.io/<repo-name>/assets/fonts/paperlogy.css
```

The font URL should look like:

```text
https://<github-user>.github.io/<repo-name>/assets/fonts/Paperlogy-8ExtraBold.woff2
```

Once those URLs are live, replace the base64 `@font-face` in Apps Script `fonts.html`
with an external stylesheet or an external `woff2` URL.
