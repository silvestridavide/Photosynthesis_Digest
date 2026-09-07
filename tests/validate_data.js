// Compatibility entry point. Run the same canonical editorial checks from Node.
const {spawnSync}=require('node:child_process');
const {resolve}=require('node:path');
const r=spawnSync('python3',[resolve(__dirname,'validate_data.py')],{stdio:'inherit'});
process.exit(r.status??1);
