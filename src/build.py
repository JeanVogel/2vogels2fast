import re, sys
import os, json, shutil
site = '--site' in sys.argv
prod = '--prod' in sys.argv or site
core = re.sub(r'^export ', '', open('core.js').read(), flags=re.M)
game = open('game.js').read()
if prod: game = '\n'.join(l for l in game.split('\n') if '__vr' not in l)
code = "import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';\n{\n" + core + "\n" + game + "\n}\n"
html = open('shell.html').read().replace('/*__CODE__*/', code)
if site:
    # site próprio (GitHub Pages): placar no Firebase, se a configuração existir
    cfg = 'site/firebase.json'
    if os.path.exists(cfg):
        html = html.replace('<script type="module">', '<script>window.VR_FIREBASE = ' + json.dumps(json.load(open(cfg))) + ';</script>\n<script type="module">', 1)
    os.makedirs('site', exist_ok=True)
    for f in ['c4vts.json', 'rsq3.json', 'p206.json', 'megane.json', 'p307.json', 'p308.json', 'city.json', 'abertura.jpg', 'logo.webp']: shutil.copy(f, 'site/' + f)
    open('site/index.html', 'w').write(html)
else:
    open('dist.html' if prod else 'index.html', 'w').write(html)
print(len(html))
