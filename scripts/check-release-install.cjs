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
  const first=installRelease(source,scratch);
  assert(!fs.existsSync(path.join(scratch,'public/game/current.json')),'Staging never activates');
  assert.equal(first.activated,false);
  installRelease(source,scratch,{activate:true});
  const pointer=fs.readFileSync(path.join(scratch,'public/game/current.json'),'utf8');
  assert.equal(JSON.parse(pointer).id,id);
  assert.equal(installRelease(source,scratch).id,id,'Idempotent verified staging');
  fs.appendFileSync(path.join(first.destination,'pages/es.html'),'tampered');
  assert.throws(()=>installRelease(source,scratch,{activate:true}),/checksum/);
  assert.equal(fs.readFileSync(path.join(scratch,'public/game/current.json'),'utf8'),pointer,'Failure preserves previous pointer');
  console.log('PASS immutable install: explicit activation, stage-only, checksums, idempotence and failed-stage rollback.');
} finally { fs.rmSync(scratch,{recursive:true}); }
