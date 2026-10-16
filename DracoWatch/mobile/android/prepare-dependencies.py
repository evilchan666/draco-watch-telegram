"""Verified offline AndroidX dependency extraction; never resolves changing versions."""
import hashlib,json,pathlib,sys,zipfile
root=pathlib.Path(__file__).resolve().parent
out=root/'build'/'dependencies';out.mkdir(parents=True,exist_ok=True)
jars=[];resources=[];packages=[]
for item in json.loads((root/'dependencies/manifest.json').read_text()):
 p=root/'dependencies'/item['file']
 if hashlib.sha256(p.read_bytes()).hexdigest()!=item['sha256']:raise SystemExit('Dependency hash mismatch: '+p.name)
 if p.suffix=='.jar':jars.append(str(p));continue
 dest=out/p.stem;dest.mkdir(exist_ok=True)
 with zipfile.ZipFile(p) as z:
  for name in z.namelist():
   if name=='classes.jar' or name.startswith('res/'):
    z.extract(name,dest)
 jars.append(str(dest/'classes.jar'))
 if (dest/'res').exists():resources.append(str(dest/'res'))
 packages.append({'recyclerview-1.3.2':'androidx.recyclerview','core-1.13.1':'androidx.core','core-ktx-1.13.1':'androidx.core.ktx','customview-1.0.0':'androidx.customview','customview-poolingcontainer-1.0.0':'androidx.customview.poolingcontainer'}[p.stem])
(out/'jars.txt').write_text('\n'.join(jars)+'\n');(out/'resources.txt').write_text('\n'.join(resources)+'\n');(out/'packages.txt').write_text(':'.join(packages))
