# Woodland kit · completed local source collection

Built-in image generation, one call per sprite/variant. 71 sprites plus one context
illustration. No CLI fallback. The owner explicitly authorised local matte removal;
all masters are preserved and their SHA-256 hashes are checked by the test suite.

See [the complete implementation and review](../../../../docs/WOODLAND-KIT.md).
`prompts.json` is the exact style/subject/native-size/anchor manifest.
`cutouts/` holds prepared alpha and provenance; `previews/` holds native QA sheets.

The fixed camera is retained. UI experiments are archived, not deleted.
No production writes, deployments or database imports.
