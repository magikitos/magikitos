<?php
declare(strict_types=1);
/** Closed experiment: preserve its measured historical comparison, not today's changing art. */
$out=$argv[1] ?? throw new RuntimeException('Missing archive output');
$reference=json_decode(file_get_contents(__DIR__.'/reference.json'),true,flags:JSON_THROW_ON_ERROR);
if(!is_dir($out)) mkdir($out,0755,true);
foreach($reference['files'] as $name=>$sha) {
    $source=__DIR__.'/reference-art/'.$name;
    if(basename($name)!==$name || hash_file('sha256',$source)!==$sha)
        throw new RuntimeException('Corrupt archived art: '.$name);
    if(!copy($source,$out.'/'.$name)) throw new RuntimeException('Cannot copy archive');
}
echo "Archived definition study: verified original six-profile reference. Game files untouched.\n";
