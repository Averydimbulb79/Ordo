import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const {version}=JSON.parse(await readFile('package.json','utf8')),versionCode=Number(process.env.GITHUB_RUN_NUMBER);
if(!Number.isSafeInteger(versionCode)||versionCode<1)throw Error('A positive GitHub run number is required for the APK update manifest.');
const sha256=createHash('sha256').update(await readFile('apk/Ordo-Android.apk')).digest('hex');
await writeFile('apk/update.json',JSON.stringify({version,versionCode,apkUrl:'https://github.com/Averydimbulb79/Ordo/releases/download/android-latest/Ordo-Android.apk',sha256,publishedAt:new Date().toISOString()},null,2)+'\n');
