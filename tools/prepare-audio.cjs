"use strict";
/** Offline import/normalization. Originals are immutable; only delivery copies are encoded. */
const fs = require("node:fs"),
  path = require("node:path"),
  crypto = require("node:crypto");
const { execFileSync } = require("node:child_process");
const root = path.resolve(__dirname, ".."),
  source = path.join(root, "data/audio"),
  output = path.join(root, "public/assets/audio"),
  index = path.join(source, "sources.json");
const hash = (file) =>
  crypto.createHash("md5").update(fs.readFileSync(file)).digest("hex");
const probe = (file) =>
  JSON.parse(
    execFileSync(
      "ffprobe",
      ["-v", "quiet", "-show_format", "-show_streams", "-of", "json", file],
      { encoding: "utf8" },
    ),
  );
function ffmpeg(args) {
  return execFileSync("ffmpeg", ["-hide_banner", "-nostdin", ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    maxBuffer: 2e6,
  });
}
fs.mkdirSync(source, { recursive: true });
fs.mkdirSync(output, { recursive: true });
const sources = fs.existsSync(index) ? JSON.parse(fs.readFileSync(index)) : [];
const importAt = process.argv.indexOf("--import");
if (importAt >= 0) {
  const dir = fs.realpathSync(process.argv[importAt + 1]);
  const candidates = fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith(".mp3"))
    .map((e) => ({ file: path.join(dir, e.name), kind: "music" }));
  const textures = path.join(dir, "sound-textures-loops");
  if (fs.existsSync(textures))
    for (const name of fs.readdirSync(textures)) {
      // New sound textures get explicit semantic IDs; never guess their world placement.
      if (name === "sound-loop-river.mp3")
        candidates.push({
          file: path.join(textures, name),
          kind: "ambience",
          key: "river",
        });
    }
  for (const entry of candidates) {
    const id = hash(entry.file),
      target = path.join(source, "originals", id + ".mp3");
    const info = probe(entry.file);
    if (!info.streams.some((s) => s.codec_type === "audio"))
      throw Error("Not audio: " + entry.file);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    if (!fs.existsSync(target))
      fs.copyFileSync(entry.file, target, fs.constants.COPYFILE_EXCL);
    if (hash(target) !== id) throw Error("Original checksum mismatch");
    if (!sources.some((s) => s.id === id))
      sources.push({
        id,
        kind: entry.kind,
        ...(entry.key ? { key: entry.key } : {}),
        originalName: path.basename(entry.file),
      });
    fs.writeFileSync(index + ".tmp", JSON.stringify(sources, null, 2) + "\n");
    fs.renameSync(index + ".tmp", index);
    // Explicit --import moves only a verified MP3; never removes the containing directory.
    if (path.resolve(entry.file) !== target) fs.unlinkSync(entry.file);
    console.log("Preserved original: data/audio/originals/" + id + ".mp3");
  }
}
const entries = [];
for (const entry of sources) {
  const original = path.join(source, "originals", entry.id + ".mp3"),
    target = path.join(output, entry.id + ".mp3");
  if (hash(original) !== entry.id) throw Error("Original changed: " + entry.id);
  if (!fs.existsSync(target) || process.argv.includes("--rebuild")) {
    const level = entry.kind === "music" ? -20 : -24;
    // spawnSync retains successful ffmpeg's stderr (where loudnorm writes its report).
    const analysis = require("node:child_process").spawnSync(
      "ffmpeg",
      [
        "-hide_banner",
        "-nostdin",
        "-i",
        original,
        "-af",
        `loudnorm=I=${level}:TP=-2:LRA=11:print_format=json`,
        "-f",
        "null",
        "-",
      ],
      { encoding: "utf8" },
    );
    if (analysis.status !== 0) throw Error("Audio analysis failed");
    const stderr = analysis.stderr;
    const m = JSON.parse(
      stderr.slice(stderr.lastIndexOf("{"), stderr.lastIndexOf("}") + 1),
    );
    const normalize = `loudnorm=I=${level}:TP=-2:LRA=11:measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}:measured_thresh=${m.input_thresh}:offset=${m.target_offset}:linear=true`;
    const args = ["-y", "-i", original];
    if (entry.kind === "ambience") {
      const duration = Number(probe(original).format.duration),
        blend = 0.6;
      args.push(
        "-filter_complex",
        `[0:a]asplit=3[a][b][c];[a]atrim=start=${blend}:end=${duration - blend},asetpts=PTS-STARTPTS[body];[b]atrim=start=${duration - blend},asetpts=PTS-STARTPTS[tail];[c]atrim=end=${blend},asetpts=PTS-STARTPTS[head];[tail][head]acrossfade=d=${blend}:c1=tri:c2=tri[join];[body][join]concat=n=2:v=0:a=1,${normalize}[out]`,
        "-map",
        "[out]",
      );
    } else args.push("-af", normalize, "-map", "0:a:0");
    // Never truncate a valid delivery copy while rebuilding. Stage outside
    // public assets so a failed encoder cannot leak a partial MP3 into a release.
    const pending = path.join(source, entry.id + ".tmp.mp3");
    ffmpeg([
      ...args,
      "-map_metadata",
      "-1",
      "-vn",
      "-ar",
      entry.kind === "music" ? "44100" : "32000",
      "-ac",
      entry.kind === "music" ? "2" : "1",
      "-c:a",
      "libmp3lame",
      "-b:a",
      entry.kind === "music" ? "128k" : "80k",
      pending,
    ]);
    if (!(Number(probe(pending).format.duration) > 0))
      throw Error("Encoded audio is invalid: " + entry.id);
    fs.renameSync(pending, target);
  }
  entries.push({
    id: entry.id,
    kind: entry.kind,
    ...(entry.key ? { key: entry.key } : {}),
    file: entry.id + ".mp3",
    duration: Number(probe(target).format.duration),
    bytes: fs.statSync(target).size,
  });
}
if (!entries.some((e) => e.kind === "music"))
  throw Error("Import music before building the catalogue");
fs.writeFileSync(
  path.join(source, "catalog.json.tmp"),
  JSON.stringify(
    {
      music: entries.filter((e) => e.kind === "music"),
      ambience: Object.fromEntries(
        entries.filter((e) => e.kind === "ambience").map((e) => [e.key, e]),
      ),
    },
    null,
    2,
  ) + "\n",
);
fs.renameSync(
  path.join(source, "catalog.json.tmp"),
  path.join(output, "catalog.json"),
);
console.log(
  "Audio delivery catalogue: " +
    entries.length +
    " files, " +
    entries.reduce((n, e) => n + e.bytes, 0) +
    " bytes. Originals excluded from delivery.",
);
