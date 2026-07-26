// genapl CLI — the pure APL builder lives in ./genapl-core.mjs (shared verbatim with the in-page
// sim verifier); this file is only the file-writing command-line wrapper.
import fs from 'fs';
import { pathToFileURL } from 'url';
import { build } from './genapl-core.mjs';


// CLI. Exit-code contract (shared by every instrument here): 0 = wrote an APL · 2 = could not.
// `if (process.argv[2])` alone meant a MISSING or EMPTY spec fell through to a silent exit 0 having
// written nothing — so `node genapl.mjs "$spec" out.json` with an unset $spec left a STALE out.json
// in place, and the runner then simmed the previous experiment's plan under this experiment's name.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (!process.argv[2]) {
    console.error('ERROR: usage: node tools/genapl.mjs \'<spec-json>\' [outfile]   (refusing to exit 0 without writing an APL)');
    process.exit(2);
  }
  let spec;
  try { spec = JSON.parse(process.argv[2]); }
  catch (e) { console.error(`ERROR: spec is not valid JSON — ${e.message}`); process.exit(2); }
  let apl;
  try { apl = build(spec); }
  catch (e) { console.error(`ERROR: ${e.message}`); process.exit(2); }
  const out = process.argv[3] || '/dev/stdout';
  fs.writeFileSync(out, JSON.stringify(apl, null, 1));
}
