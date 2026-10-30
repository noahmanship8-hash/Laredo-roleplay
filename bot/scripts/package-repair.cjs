// Build a cumulative repair ZIP without overwriting host configuration or saved data.
// Python's standard-library zipfile is used so no packaging dependencies are needed.
const { execFileSync } = require('node:child_process');
const path = require('node:path');
execFileSync('python3', ['-c', String.raw`
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
import re
root = Path('bot')
output = Path('downloads/Laredo-Complete-Repair.zip')
output.parent.mkdir(exist_ok=True)
preserved = {'config.js', 'content.js', 'shop.js', '.env'}
files = {}
for p in root.rglob('*'):
    rel = p.relative_to(root)
    if not p.is_file() or any(part in {'node_modules', 'data', 'assets', '.git'} for part in rel.parts):
        continue
    if rel.as_posix() in preserved:
        continue
    files[rel.as_posix()] = p
# Check local literal require paths, including command-factory, before publishing.
for name, p in files.items():
    if p.suffix not in {'.js', '.cjs'} or name.startswith(('tests/', 'scripts/')):
        continue
    for ref in re.findall(r"require\(['\"](\.[^'\"]+)['\"]\)", p.read_text()):
        target = (p.parent / ref).resolve()
        candidates = [target, Path(str(target) + '.js'), target / 'index.js']
        if not any(candidate.is_file() for candidate in candidates):
            raise RuntimeError(f'Missing source dependency: {name}: {ref}')
        # Config, content and shop are intentionally kept from the host.
        matches = [candidate.relative_to(root.resolve()).as_posix() for candidate in candidates if candidate.is_file() and candidate.is_relative_to(root.resolve())]
        if not any(match in files or match in preserved for match in matches):
            raise RuntimeError(f'Dependency omitted from repair: {name}: {ref}')
notes = '''COMPLETE CODE REPAIR - WYSPBYTE / WISPBYTE

1. Stop your bot and back up the whole folder.
2. Change the hosting Node.js version/image to Node.js 22 or newer.
3. Upload and extract this ZIP directly into /home/container.
   Allow replacement of included code files. Do not delete your old folders first.
4. KEEP your existing .env, config.js, content.js, shop.js, data/ and assets/.
   They are intentionally not in this archive. Do not delete them.
5. Check /home/container/utils/command-factory.js now exists, alongside the other
   utility files. Avoid accidental nesting such as /home/container/bot/utils.
6. Start with: npm ci && node deploy-commands.js && node index.js
7. After successful registration, normal startup can be node index.js.

This is a cumulative code repair, including previous dashboard, nickname,
logging and community features. It replaces standard command/utility files;
back up any custom code changes first. It does not backfill member roles.

If the host offers no Node version setting, ask hosting support to move the
server to a Node.js 22+ runtime. Do not just remove the package engine requirement.
'''
with ZipFile(output, 'w', ZIP_DEFLATED) as z:
    for name, p in sorted(files.items()):
        z.write(p, name)
    z.writestr('REPAIR-INSTALL.txt', notes)
with ZipFile(output) as z:
    assert z.testzip() is None
    assert 'utils/command-factory.js' in z.namelist()
    assert 'index.js' in z.namelist()
    assert not any(name in z.namelist() for name in preserved)
    print(f'Created {output} ({len(z.namelist())} entries); local require dependencies validated.')
`], { cwd: path.resolve(__dirname, '../..'), stdio: 'inherit' });
