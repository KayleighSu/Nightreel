// Add purpose strings to the generated Capacitor iOS target before Xcode builds it.
// Generated ios/ files are not committed; this runs after `cap add ios`.
import { readFile, writeFile } from 'node:fs/promises';
const path='ios/App/App/Info.plist';
let xml=await readFile(path,'utf8');
const purpose='Nightreel uses your camera only when you choose to scan a friend’s QR code.';
if(!xml.includes('<key>NSCameraUsageDescription</key>')){
  const end=/<\/dict>\s*<\/plist>\s*$/;
  if(!end.test(xml))throw Error('Unexpected generated Info.plist format');
  xml=xml.replace(end,'  <key>NSCameraUsageDescription</key>\n  <string>'+purpose.replaceAll('&','&amp;')+'</string>\n</dict>\n</plist>\n');
  await writeFile(path,xml);
}
console.log('iOS camera permission description is configured.');
