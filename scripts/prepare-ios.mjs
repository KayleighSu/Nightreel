// Copy the existing GitHub Pages app into Capacitor's native web bundle.
// No secrets, private data or third-party build tools are needed here.
import { cp, mkdir, rm, stat } from 'node:fs/promises';
import { join } from 'node:path';
const root=process.cwd(),dest=join(root,'www');
const items=[
 'index.html','community-guidelines.html','privacy.html','support.html','config.js','original-collection.js',
 'app-enhancements.js','app-enhancements.css',
 'nightreel-releases.js','social-extras.js','nightreel-safety.js','nightreel-moderation.js','nightreel-casework.js','mobile-refresh.js',
 'icons','images','manifest.webmanifest'
];
await rm(dest,{recursive:true,force:true});
await mkdir(dest,{recursive:true});
for(const path of items){
 const source=join(root,path);
 try{await stat(source);}catch{throw Error('Missing required Nightreel asset: '+path);}
 await cp(source,join(dest,path),{recursive:true});
}
console.log('Prepared Nightreel web assets for Capacitor iOS (www/).');
