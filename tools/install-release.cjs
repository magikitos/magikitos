"use strict";
/** Stage an immutable artifact. Activating it is an explicit, separate decision. */
const fs = require('node:fs'), path = require('node:path');
const {verify} = require('./artifact.cjs');
function installRelease(source, website, {activate=false} = {}) {
  source = fs.realpathSync(source);
  website = fs.realpathSync(website);
  if(!fs.statSync(path.join(website,'public/index.php')).isFile())
    throw Error('Target must be a website root with public/index.php');
  const id = path.basename(source);
  const manifest = verify(source,id);
  const game = path.join(website,'public/game');
  const parent = path.join(game,'releases');
  // Do not allow a surprising symlink to redirect a release installation.
  for(const directory of [path.join(website,'public'),game,parent])
    if(fs.existsSync(directory) && fs.lstatSync(directory).isSymbolicLink())
      throw Error('Release target cannot be a symlink: '+directory);
  fs.mkdirSync(parent,{recursive:true});
  const destination = path.join(parent,id);
  if(fs.existsSync(destination)) {
    if(fs.lstatSync(destination).isSymbolicLink()) throw Error('Release cannot be a symlink');
    verify(destination,id);
  } else {
    const staging = fs.mkdtempSync(path.join(parent,'.install-'));
    try {
      fs.cpSync(source,staging,{recursive:true,errorOnExist:true,force:false});
      verify(staging,id);
      fs.renameSync(staging,destination);
    } finally {
      // This exact scratch directory was allocated above; installed/user data are never removed.
      if(fs.existsSync(staging)) fs.rmSync(staging,{recursive:true});
    }
  }
  if(activate) {
    const temporary=path.join(game,'.current-'+process.pid+'.json');
    fs.writeFileSync(temporary,JSON.stringify({id,routes:manifest.routes},null,2)+'\n',{flag:'wx'});
    fs.renameSync(temporary,path.join(game,'current.json'));
  }
  return {id,destination,activated:activate};
}
if(require.main===module) {
  const [source,website,mode]=process.argv.slice(2);
  if(!source || !website || !['--stage-only','--activate'].includes(mode))
    throw Error('Usage: node install-release.cjs RELEASE_DIRECTORY WEBSITE_ROOT --stage-only|--activate');
  console.log(JSON.stringify(installRelease(source,website,{activate:mode==='--activate'})));
}
module.exports={installRelease};
