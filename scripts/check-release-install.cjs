"use strict";
const assert=require('node:assert/strict'), fs=require('node:fs'), path=require('node:path'), os=require('node:os');
const {installRelease}=require('../tools/install-release.cjs');
const {out}=require('../tools/build.cjs');
const {id}=JSON.parse(fs.readFileSync(path.join(out,'current.json')));
const scratch=fs.mkdtempSync(path.join(os.tmpdir(),'magikitos-release-test-'));
try {
  fs.mkdirSync(path.join(scratch,'public'));
  fs.writeFileSync(path.join(scratch,'public/index.php'),'<?php');
  const source=path.join(out,'releases',id);
  // Staging must remain readable by a separate static web-server user even
  // under a restrictive deploy umask (mkdtemp itself always creates mode 0700).
  const previousMask=process.umask(0o077);
  let first;
  try {first=installRelease(source,scratch);} finally {process.umask(previousMask);}
  const mode=file=>fs.statSync(file).mode & 0o777;
  for(const dir of ['public/game','public/game/releases', 'public/game/releases/'+id])
    assert.equal(mode(path.join(scratch,dir)),0o755,'Public directory traversal '+dir);
  assert.equal(mode(path.join(first.destination,'assets/js/aventura.min.js')),0o644);
  assert(!fs.existsSync(path.join(scratch,'public/game/current.json')),'Staging never activates');
  assert.equal(first.activated,false);
  installRelease(source,scratch,{activate:true});
  const pointer=fs.readFileSync(path.join(scratch,'public/game/current.json'),'utf8');
  assert.equal(JSON.parse(pointer).id,id);
  assert.equal(mode(path.join(scratch,'public/game/current.json')),0o644);
  fs.chmodSync(first.destination,0o700);
  assert.equal(installRelease(source,scratch).id,id,'Idempotent verified staging');
  assert.equal(mode(first.destination),0o755,'Idempotent install restores public readability');
  fs.appendFileSync(path.join(first.destination,'pages/es.html'),'tampered');
  assert.throws(()=>installRelease(source,scratch,{activate:true}),/checksum/);
  assert.equal(fs.readFileSync(path.join(scratch,'public/game/current.json'),'utf8'),pointer,'Failure preserves previous pointer');
  console.log('PASS immutable install: activation, checksums, idempotence, restrictive umask/public readability and failed-stage rollback.');
} finally { fs.rmSync(scratch,{recursive:true}); }
