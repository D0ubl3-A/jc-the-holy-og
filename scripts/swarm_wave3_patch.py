#!/usr/bin/env python3
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
INDEX=ROOT/'index.html'
DISTRICT=ROOT/'jc-the-holy-og-assets'/'real-vegas-district-runtime.js'

def patch(path, old, new, label):
    s=path.read_text(encoding='utf-8')
    if old in s:
        s=s.replace(old,new,1)
        path.write_text(s,encoding='utf-8')
        print(label,'PATCHED')
    elif new in s:
        print(label,'ALREADY_PATCHED')
    else:
        raise SystemExit(f'{label}: pattern missing')

patch(INDEX,
 'if(typeof notice==="function")notice(playableMode==="satan"?"SATAN MODE — INFERNO ROUNDS ACTIVE":"JC MODE — DIVINE LIGHT ACTIVE")',
 'if(typeof showNotice==="function")showNotice(playableMode==="satan"?"SATAN MODE — INFERNO ROUNDS ACTIVE":"JC MODE — DIVINE LIGHT ACTIVE")',
 'playable-mode-notice')

patch(INDEX,
 'world:{time:worldTime,night,dynamicLighting:true,animatedNeonFrames:4},controls:',
 'world:{time:worldTime,night,dynamicLighting:true,animatedNeonFrames:4,playableMode,proceduralCityVisible:proceduralCity.visible,realDistrict:window.__JC_REAL_VEGAS_DISTRICTS_V1__?.activeDistrict||null,realCollisionActive:!!window.JC_REAL_VEGAS_COLLISION?.active?.()},controls:',
 'runtime-introspection')

patch(DISTRICT,
 'const fallback=state.scene?.getObjectByName("Generated city fallback");if(fallback)fallback.visible=!on;',
 'const fallback=state.scene?.getObjectByName("Generated city fallback"),realCity=state.scene?.getObjectByName("Las Vegas city LOD");if(fallback)fallback.visible=on?false:!realCity;',
 'real-city-prevents-fallback-reenable')

patch(DISTRICT,
 'if(!d){setProceduralSuppressed(false);return}',
 'if(!d){setProceduralSuppressed(false);window.JC_REAL_VEGAS_DISTRICT_STATUS={active:false,district:null,visibleTiles:0,builtTiles:state.builtTiles,loadedDistricts:state.loadedDistricts};return}',
 'district-status-clears-when-inactive')
