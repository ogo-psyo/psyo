from pathlib import Path
import json,re,hashlib,subprocess
root=Path(__file__).resolve().parents[3];d=root/'docs/prerelease-20260909';agent=root.parent/'wt-pso-agent-20260908'
issues=[];surfaces=json.loads((d/'surface-register.json').read_text());apis=json.loads((d/'evidence/api-inventory.json').read_text())
ids=[r['id'] for r in surfaces]
if len(ids)!=len(set(ids)):issues.append('Duplicate surface ID')
for r in surfaces:
 for source in r['sources']:
  base=agent if source.startswith('@agent:') else root
  source=source.removeprefix('@agent:');f,ln=source.rsplit(':',1);p=base/f
  if not p.is_file():issues.append('Missing source '+str(p));continue
  if int(ln)>len(p.read_text().splitlines()):issues.append('Line out of range '+source)
actual={str(p.relative_to(root)) for p in (root/'app/api').rglob('route.ts')}
if actual!={a['source'] for a in apis}:issues.append('API inventory does not match source')
for a in apis:
 s=(root/a['source']).read_text();found=set()
 for pair in re.findall(r'export\s+(?:async\s+)?function\s+(GET|POST|PATCH|PUT|DELETE|OPTIONS)\b|export\s+const\s+(GET|POST|PATCH|PUT|DELETE|OPTIONS)\b',s):found.add(pair[0] or pair[1])
 for destructured in re.findall(r'export\s+const\s*\{([^}]+)\}',s):found.update(re.findall(r'\b(GET|POST|PATCH|PUT|DELETE|OPTIONS)\b',destructured))
 if found!=set(a['methods'].split(',')):issues.append('Method inventory mismatch '+a['path'])
for p in d.glob('*.md'):
 for dest in re.findall(r'\]\(([^)]+)\)',p.read_text()):
  if not dest.startswith(('http','#')) and not (p.parent/dest.split('#')[0]).exists():issues.append('Broken doc link '+dest)
source_sha=subprocess.check_output(['git','rev-parse','HEAD'],cwd=root,text=True).strip()
result={'status':'PASS' if not issues else 'FAIL','baseRevision':source_sha,'surfaceFamilies':len(surfaces),'apiFiles':len(apis),'methodExports':sum(len(a['methods'].split(',')) for a in apis),'checks':['Unique surface IDs','All referenced source files and line positions exist','All API route files inventoried','HTTP method exports match','Local document links resolve'],'issues':issues,'limits':'Documentation consistency, not semantic coverage proof or product acceptance'}
(d/'evidence/spec-validation.json').write_text(json.dumps(result,ensure_ascii=False,indent=2));print(json.dumps(result,ensure_ascii=False,indent=2));raise SystemExit(bool(issues))
