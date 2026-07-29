#!/usr/bin/env python3
"""
Regenerates sanctuary-mandela-options.html from template.html by inlining
the base64 asset fragments (fonts, hero day/night images) as data URIs.

Run from this directory:
    python3 build.py

Edit template.html (source of truth), then re-run this script, then
republish the output file via the Artifact tool.
"""
import pathlib

here = pathlib.Path(__file__).parent

with open(here / "template.html", "r") as f:
    html = f.read()

files = {
    "__FRAUNCES_ROMAN__": "fraunces-roman.b64",
    "__FRAUNCES_ITALIC__": "fraunces-italic.b64",
    "__WORKSANS__": "worksans.b64",
    "__PLEXMONO_REG__": "plexmono-reg.b64",
    "__PLEXMONO_MED__": "plexmono-med.b64",
    "__HERO__": "hero.b64",
    "__HERO_NIGHT__": "hero-night.b64",
}

for placeholder, fname in files.items():
    with open(here / fname, "r") as f:
        data = f.read().strip()
    n = html.count(placeholder)
    html = html.replace(placeholder, data)
    print(f"{placeholder} -> {fname}  ({n} occurrence(s))")

out_path = here / "sanctuary-mandela-options.html"
with open(out_path, "w") as f:
    f.write(html)

print(f"\nWrote {out_path} ({len(html):,} bytes)")
print("Next: publish this file via the Artifact tool to the existing URL")
print("  https://claude.ai/code/artifact/b6caa3cb-d2e7-4f99-b4f8-e6189842c3fe")
