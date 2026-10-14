## Six-part GitHub upload (iPhone-friendly)

The ready-to-upload 5.27 MB source package has been split into six verified parts:

```
JC_Library_City_Tiles_595_ROOT.zip.part01
JC_Library_City_Tiles_595_ROOT.zip.part02
JC_Library_City_Tiles_595_ROOT.zip.part03
JC_Library_City_Tiles_595_ROOT.zip.part04
JC_Library_City_Tiles_595_ROOT.zip.part05
JC_Library_City_Tiles_595_ROOT.zip.part06
```

Upload all six **individual files** (not the wrapper ZIP) to the **root of main** using GitHub's Add file → Upload files. They can be uploaded in one or more commits; before all six arrive, the original safe map remains active. When the complete set is present, GitHub Actions rebuilds the original ZIP byte-for-byte, verifies SHA-256 `202a1196c9b6d79865d75a854a941741ddea9f5678019e0df965fb53d72bcaa3`, validates its ZIP integrity, expands all 595 city tile data files and 595 imagery files, and checks the 216,807 source building records. The upload does **not** commit 595 unpacked files to the repository: they are installed in the GitHub Pages build output.

Do not rename, concatenate manually, or upload a seven-file wrapper archive instead of six `.partXX` files. The workflow also accepts a single unsplit `JC_Library_City_Tiles_595_ROOT.zip` if you prefer it.

# JC — Activate Library city replacement

## Replacement city package

Upload **one file** named `JC_Library_City_Tiles_595_ROOT.zip` to the **root of the `main` branch**, using GitHub's **Add file → Upload files**. The GitHub Pages deployment workflow recognizes this exact filename, expands it into the site, verifies all 595 cells, verifies the full 216,807 building-record count, and checks for 595 aerial imagery tiles. It refuses a truncated or mismatched city package.

The asset ZIP is created offline from the user-owned Library file `Las_Vegas_Editable_City_Part_2.zip`. Its format is `jc-the-holy-og-assets/library-city/manifest.json`, `tiles/Cxx_Ryy.json` and `imagery/Cxx_Ryy.webp`. Data is source-derived; each tile stores real 2014 LiDAR scene node positions, height, width and depth. **It does not contain the original GLB polygon meshes or full-resolution textures**. See the archive's included README.

Once the upload commit deploys, open:

https://d0ubl3-a.github.io/jc-the-holy-og/real-city-climb-demo.html?mode=gta

The lightweight geographic renderer reads the converted manifest and automatically loads nearby 3D library buildings into the existing single city scene. Non-adjacent models and imagery are unloaded to keep memory bounded on iPhones. JC's camera, flight, powers, map, missions and controls remain untouched.

## Coverage safety

This archive covers `C18–C34, R00–R34` (eastern metro). **Do not delete C06–C17/Strip models**: they are geographically outside the replacement archive. Previously published legacy GLBs remain for areas absent from the new pack and explicit desktop full mode.

## Verify

1. GitHub Actions → `Deploy JC The Holy OG to GitHub Pages` → successful run, look for `PASS: installed all 595 library tiles, 216807 source buildings and 595 aerial textures`.
2. Game console → `window.JC_LIBRARY_CITY_STATUS` should show `installed:true` and `tileCount:595`.
3. Travel into coordinates covered by C18–C34 to see source buildings and aerial tiles appear; the default Strip start is outside this archive.
4. Verify collision and asset positioning in a real iPhone test. Integration is not a substitute for device validation.

If the package is not uploaded, the game intentionally retains the safe GTA Vegas geographic map; no missing-asset crashes or invented building-availability claims.
